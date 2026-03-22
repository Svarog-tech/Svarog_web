const express = require('express');
const router = express.Router();
const path = require('path');
const rateLimit = require('express-rate-limit');

module.exports = function({ db, logger, hestiacp, authenticateUser, requireAdmin }) {
  const { asyncHandler, AppError } = require('../middleware/errorHandler');

  // Lazy-load emailService (only needed for expiring notifications)
  let _sendServiceExpiringEmail;
  function sendServiceExpiringEmail(...args) {
    if (!_sendServiceExpiringEmail) {
      _sendServiceExpiringEmail = require('../services/emailService').sendServiceExpiringEmail;
    }
    return _sendServiceExpiringEmail(...args);
  }

  // CSRF guard loaded from helpers (not duplicated in server.js)
  const { requireCsrfGuard } = require('./helpers/authMiddleware');

  // ============================================
  // Pagination helpers
  // ============================================
  function parsePagination(query, defaultLimit = 20, maxLimit = 100) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
  }

  function paginationMeta(page, limit, total) {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total
    };
  }

  // ============================================
  // SECURITY: Validace že ID parametr je kladné celé číslo
  // ============================================
  function validateNumericId(id, paramName = 'id') {
    const num = parseInt(id, 10);
    if (isNaN(num) || num <= 0 || String(num) !== String(id)) {
      throw new AppError(`Invalid ${paramName}: must be a positive integer`, 400);
    }
    return num;
  }

  // ============================================
  // Sanitizace cesty — ochrana proti path traversal
  // ============================================
  function sanitizeFilePath(requestedPath, hestiaUsername) {
    if (!requestedPath || typeof requestedPath !== 'string') {
      throw new AppError('Path is required', 400);
    }
    // SECURITY: Null bytes
    if (requestedPath.includes('\0')) {
      throw new AppError('Invalid path', 400);
    }
    // SECURITY: Reject control characters (newlines, tabs, etc.) that could break shell quoting
    if (/[\x00-\x1f\x7f]/.test(requestedPath)) {
      throw new AppError('Invalid path: control characters not allowed', 400);
    }
    // SECURITY: Max length check
    if (requestedPath.length > 4096) {
      throw new AppError('Path too long', 400);
    }
    // SECURITY: Reject encoded traversal attempts (%2e%2e, %2f)
    if (/%2e|%2f|%5c/i.test(requestedPath)) {
      throw new AppError('Invalid path encoding', 400);
    }
    const homeDir = `/home/${hestiaUsername}`;
    // Normalizuj cestu (POSIX style)
    const normalized = path.posix.normalize(requestedPath);
    // SECURITY: Po normalizaci znovu zkontroluj .. (double-encoding bypass)
    if (normalized.includes('..')) {
      throw new AppError('Access denied: path traversal detected', 403);
    }
    // Kontrola že cesta je uvnitř home adresáře
    if (!normalized.startsWith(homeDir + '/') && normalized !== homeDir) {
      throw new AppError('Access denied: path outside home directory', 403);
    }
    return normalized;
  }

  // ============================================
  // Middleware: Najde službu, ověří vlastnictví, vrátí hestia_username
  // ============================================
  async function resolveServiceForFiles(req) {
    const serviceId = validateNumericId(req.params.serviceId, 'serviceId');
    const service = await db.queryOne(
      'SELECT * FROM user_hosting_services WHERE id = ?',
      [serviceId]
    );
    if (!service) {
      throw new AppError('Service not found', 404);
    }
    if (service.user_id !== req.user.id && !req.user.is_admin) {
      throw new AppError('Forbidden', 403);
    }
    if (!service.hestia_created || !service.hestia_username) {
      throw new AppError('HestiaCP account not yet created', 400);
    }
    // SECURITY: Odmítni file operace na expirovaných/suspendovaných službách
    if (service.status === 'expired' || service.status === 'suspended' || service.status === 'cancelled') {
      throw new AppError('Service is not active. File operations are disabled.', 403);
    }
    if (service.expires_at && new Date(service.expires_at) < new Date()) {
      throw new AppError('Service has expired. Renew to access files.', 403);
    }
    // SECURITY: Validate hestia_username format to prevent command injection
    // HestiaCP usernames are alphanumeric with underscores/hyphens only
    if (!/^[a-zA-Z0-9_-]+$/.test(service.hestia_username)) {
      logger.error('Invalid hestia_username format detected', {
        serviceId: service.id,
        hestia_username: service.hestia_username
      });
      throw new AppError('Invalid hosting account configuration', 500);
    }
    return service;
  }

  // Rate limiter pro file operace (60 req/min)
  const fileOpsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { success: false, error: 'Too many file operations, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // SECURITY: Route-specific larger body limit for file upload/save (base64-encoded files need >1MB)
  const largeBodyParser = express.json({ limit: '10mb' });

  // ============================================
  // HOSTING SERVICES CRUD
  // ============================================

  /**
   * Get all hosting services (admin sees all, user sees own)
   * GET /hosting-services
   */
  router.get('/hosting-services',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const isAdmin = !!req.user.is_admin;
      const { page, limit, offset } = parsePagination(req.query);

      let countQuery, dataQuery, params, countParams;

      if (isAdmin) {
        countQuery = 'SELECT COUNT(*) as total FROM user_hosting_services';
        dataQuery = `SELECT h.*, p.email AS user_email, p.first_name AS user_first_name, p.last_name AS user_last_name
           FROM user_hosting_services h LEFT JOIN profiles p ON p.id = h.user_id
           ORDER BY h.created_at DESC LIMIT ? OFFSET ?`;
        countParams = [];
        params = [limit, offset];
      } else {
        countQuery = 'SELECT COUNT(*) as total FROM user_hosting_services WHERE user_id = ?';
        dataQuery = 'SELECT * FROM user_hosting_services WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
        countParams = [req.user.id];
        params = [req.user.id, limit, offset];
      }

      const countResult = await db.query(countQuery, countParams);
      const total = countResult[0]?.total || 0;
      const services = await db.query(dataQuery, params);

      res.json({
        success: true,
        services: services || [],
        pagination: paginationMeta(page, limit, total)
      });
    })
  );

  /**
   * Get active hosting services for current user
   * GET /hosting-services/active
   */
  router.get('/hosting-services/active',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const services = await db.query(
        `SELECT * FROM user_hosting_services
         WHERE user_id = ? AND status = 'active'
         ORDER BY created_at DESC`,
        [req.user.id]
      );

      res.json({
        success: true,
        services: services || []
      });
    })
  );

  /**
   * Get hosting service by ID
   * GET /hosting-services/:id
   */
  router.get('/hosting-services/:id',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const serviceId = validateNumericId(req.params.id);

      const service = await db.queryOne(
        'SELECT * FROM user_hosting_services WHERE id = ?',
        [serviceId]
      );

      if (!service) {
        throw new AppError('Service not found', 404);
      }

      if (service.user_id !== req.user.id && !req.user.is_admin) {
        throw new AppError('Forbidden', 403);
      }

      res.json({
        success: true,
        service
      });
    })
  );

  /**
   * Toggle auto-renewal for a hosting service
   * PUT /hosting-services/:id/auto-renewal
   */
  router.put('/hosting-services/:id/auto-renewal',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const serviceId = validateNumericId(req.params.id);
      const { auto_renewal, renewal_period } = req.body || {};

      const service = await db.queryOne(
        'SELECT * FROM user_hosting_services WHERE id = ?',
        [serviceId]
      );

      if (!service) {
        throw new AppError('Service not found', 404);
      }

      // Ownership check
      if (service.user_id !== req.user.id && !req.user.is_admin) {
        throw new AppError('Forbidden', 403);
      }

      if (typeof auto_renewal !== 'boolean') {
        throw new AppError('auto_renewal must be boolean', 400);
      }

      const updates = ['auto_renewal = ?'];
      const values = [auto_renewal ? 1 : 0];

      if (renewal_period && ['monthly', 'yearly'].includes(renewal_period)) {
        updates.push('renewal_period = ?');
        values.push(renewal_period);
      }

      values.push(serviceId);

      await db.execute(
        `UPDATE user_hosting_services SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      );

      const updated = await db.queryOne(
        'SELECT * FROM user_hosting_services WHERE id = ?',
        [serviceId]
      );

      res.json({
        success: true,
        service: updated,
      });
    })
  );

  /**
   * Job: renew hosting services that have auto_renewal enabled
   * POST /jobs/renew-services
   */
  router.post('/jobs/renew-services',
    authenticateUser,
    asyncHandler(async (req, res) => {
      // Only admin can trigger this job
      if (!req.user.is_admin) {
        throw new AppError('Forbidden', 403);
      }

      const servicesToRenew = await db.query(
        `SELECT h.*
         FROM user_hosting_services h
         WHERE h.auto_renewal = 1
           AND h.status = 'active'
           AND h.expires_at IS NOT NULL
           AND h.expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)
           AND (h.last_renewed_at IS NULL OR h.last_renewed_at < h.expires_at)`
      );

      const renewed = [];

      for (const service of servicesToRenew) {
        const lastOrder = await db.queryOne(
          'SELECT * FROM user_orders WHERE id = ?',
          [service.order_id]
        );

        if (!lastOrder) {
          continue;
        }

        const insertResult = await db.execute(
          `INSERT INTO user_orders (
             user_id, plan_id, plan_name, price, currency,
             billing_email, billing_name, billing_company, billing_address, billing_phone,
             customer_email, customer_name,
             status, payment_status,
             domain_name
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?)`,
          [
            service.user_id,
            lastOrder.plan_id,
            lastOrder.plan_name,
            lastOrder.price,
            lastOrder.currency || 'CZK',
            lastOrder.billing_email || null,
            lastOrder.billing_name || null,
            lastOrder.billing_company || null,
            lastOrder.billing_address || null,
            lastOrder.billing_phone || null,
            lastOrder.customer_email || null,
            lastOrder.customer_name || null,
            lastOrder.domain_name || null,
          ]
        );

        const newOrderId = insertResult.insertId;

        await db.execute(
          `UPDATE user_hosting_services
           SET last_renewed_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [service.id]
        );

        renewed.push({
          serviceId: service.id,
          newOrderId,
        });
      }

      // Notifikace o blížící se expiraci pro služby BEZ auto-renewal
      const expiringServices = await db.query(
        `SELECT h.*, p.email AS user_email
         FROM user_hosting_services h
         JOIN profiles p ON p.id = h.user_id
         WHERE h.auto_renewal = 0
           AND h.status = 'active'
           AND h.expires_at IS NOT NULL
           AND h.expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)
           AND h.expires_at > NOW()`
      );

      for (const svc of expiringServices) {
        if (svc.user_email) {
          sendServiceExpiringEmail(
            svc.user_email,
            svc.plan_name || 'Hosting',
            svc.hestia_domain,
            svc.expires_at
          ).catch(err => logger.error('Service expiring email failed', { error: err.message, serviceId: svc.id }));
        }
      }

      res.json({
        success: true,
        renewedCount: renewed.length,
        renewed,
        expiringNotified: expiringServices.length,
      });
    })
  );

  /**
   * Get hosting service real-time stats from HestiaCP
   * GET /hosting-services/:id/stats
   */
  router.get('/hosting-services/:id/stats',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const serviceId = validateNumericId(req.params.id);

      const service = await db.queryOne(
        'SELECT * FROM user_hosting_services WHERE id = ?',
        [serviceId]
      );

      if (!service) {
        throw new AppError('Service not found', 404);
      }

      if (service.user_id !== req.user.id && !req.user.is_admin) {
        throw new AppError('Forbidden', 403);
      }

      if (!service.hestia_username || !service.hestia_created) {
        return res.json({
          success: true,
          stats: null,
          message: 'HestiaCP account not yet created'
        });
      }

      const [statsResult, userResult] = await Promise.all([
        hestiacp.getUserStats(service.hestia_username),
        hestiacp.getUserInfo(service.hestia_username)
      ]);

      const stats = {
        disk_used_mb: statsResult.success ? statsResult.stats.disk_used_mb : 0,
        disk_limit_mb: userResult.success ? userResult.user.disk_quota_mb : (service.disk_space ? service.disk_space * 1024 : 0),
        bandwidth_used_mb: statsResult.success ? statsResult.stats.bandwidth_used_mb : 0,
        bandwidth_limit_mb: userResult.success ? userResult.user.bandwidth_limit_mb : (service.bandwidth ? service.bandwidth * 1024 : 0),
        email_accounts_used: statsResult.success ? statsResult.stats.mail_accounts : 0,
        email_accounts_limit: userResult.success ? userResult.user.mail_accounts_limit : (service.email_accounts || 0),
        databases_used: statsResult.success ? statsResult.stats.databases : 0,
        databases_limit: userResult.success ? userResult.user.databases_limit : (service.databases || 0),
        web_domains_used: statsResult.success ? statsResult.stats.web_domains : 0,
        web_domains_limit: userResult.success ? userResult.user.web_domains_limit : (service.domains || 0),
        suspended: userResult.success ? userResult.user.suspended : false,
      };

      res.json({
        success: true,
        stats,
        hestia_available: statsResult.success && userResult.success
      });
    })
  );

  /**
   * Get historical statistics for a service
   * GET /hosting-services/:id/statistics/history
   */
  router.get('/hosting-services/:id/statistics/history',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const serviceId = validateNumericId(req.params.id);
      const period = req.query.period || '7d';
      const metric = req.query.metric || 'all';

      const service = await db.queryOne(
        'SELECT * FROM user_hosting_services WHERE id = ?',
        [serviceId]
      );

      if (!service) {
        throw new AppError('Service not found', 404);
      }

      if (service.user_id !== req.user.id && !req.user.is_admin) {
        throw new AppError('Forbidden', 403);
      }

      const periodMap = {
        '24h': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90
      };
      const days = periodMap[period] || 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let selectFields = '*';
      if (metric === 'disk') {
        selectFields = 'recorded_at, disk_used_mb';
      } else if (metric === 'bandwidth') {
        selectFields = 'recorded_at, bandwidth_used_mb';
      }

      const statistics = await db.query(
        `SELECT ${selectFields} FROM service_statistics
         WHERE service_id = ? AND recorded_at >= ?
         ORDER BY recorded_at ASC`,
        [serviceId, startDate]
      );

      res.json({
        success: true,
        statistics,
        period,
        metric
      });
    })
  );

  // ============================================
  // ADMIN STATISTICS & ALERTS
  // ============================================

  /**
   * Admin: Get platform overview statistics
   * GET /admin/statistics/overview
   */
  router.get('/admin/statistics/overview',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const [
        totalServices,
        activeServices,
        totalUsers,
        totalTickets,
        totalRevenue,
        monthlyRevenue
      ] = await Promise.all([
        db.queryOne('SELECT COUNT(*) as count FROM user_hosting_services'),
        db.queryOne('SELECT COUNT(*) as count FROM user_hosting_services WHERE status = "active"'),
        db.queryOne('SELECT COUNT(*) as count FROM users'),
        db.queryOne('SELECT COUNT(*) as count FROM support_tickets'),
        db.queryOne('SELECT COALESCE(SUM(price), 0) as total FROM user_orders WHERE payment_status = "paid"'),
        db.queryOne('SELECT COALESCE(SUM(price), 0) as total FROM user_orders WHERE payment_status = "paid" AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)')
      ]);

      res.json({
        success: true,
        overview: {
          total_services: totalServices?.count || 0,
          active_services: activeServices?.count || 0,
          total_users: totalUsers?.count || 0,
          total_tickets: totalTickets?.count || 0,
          total_revenue: parseFloat(totalRevenue?.total || 0),
          monthly_revenue: parseFloat(monthlyRevenue?.total || 0)
        }
      });
    })
  );

  /**
   * Admin: Get service statistics summary
   * GET /admin/statistics/services
   */
  router.get('/admin/statistics/services',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const services = await db.query(
        `SELECT
          uhs.id,
          uhs.plan_name,
          uhs.status,
          uhs.created_at,
          p.email as user_email,
          (SELECT disk_used_mb FROM service_statistics WHERE service_id = uhs.id ORDER BY recorded_at DESC LIMIT 1) as disk_used_mb,
          (SELECT bandwidth_used_mb FROM service_statistics WHERE service_id = uhs.id ORDER BY recorded_at DESC LIMIT 1) as bandwidth_used_mb
        FROM user_hosting_services uhs
        LEFT JOIN profiles p ON uhs.user_id = p.id
        WHERE uhs.hestia_created = 1
        ORDER BY uhs.created_at DESC
        LIMIT 100`
      );

      res.json({
        success: true,
        services
      });
    })
  );

  /**
   * Admin/Cron: Collect stats for all active hosting services from HestiaCP
   * POST /admin/services/collect-stats
   */
  router.post('/admin/services/collect-stats',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const services = await db.query(
        `SELECT id, hestia_username, disk_space, bandwidth, plan_name
         FROM user_hosting_services
         WHERE status = 'active' AND hestia_created = 1 AND hestia_username IS NOT NULL`
      );

      let statsCollected = 0;
      let alertsCreated = 0;

      for (const service of services) {
        try {
          const [statsResult, userResult] = await Promise.all([
            hestiacp.getUserStats(service.hestia_username),
            hestiacp.getUserInfo(service.hestia_username)
          ]);

          if (!statsResult.success) continue;

          const diskUsedMb = statsResult.stats.disk_used_mb || 0;
          const bandwidthUsedMb = statsResult.stats.bandwidth_used_mb || 0;
          const diskLimitMb = userResult.success ? userResult.user.disk_quota_mb : (service.disk_space ? service.disk_space * 1024 : 0);
          const bandwidthLimitMb = userResult.success ? userResult.user.bandwidth_limit_mb : (service.bandwidth ? service.bandwidth * 1024 : 0);

          // Insert stats record
          await db.execute(
            `INSERT INTO service_statistics (service_id, disk_used_mb, bandwidth_used_mb, recorded_at)
             VALUES (?, ?, ?, NOW())`,
            [service.id, diskUsedMb, bandwidthUsedMb]
          );
          statsCollected++;

          // Check disk thresholds
          if (diskLimitMb > 0) {
            const diskPercent = (diskUsedMb / diskLimitMb) * 100;
            if (diskPercent > 95) {
              const existing = await db.queryOne(
                `SELECT id FROM service_alerts
                 WHERE service_id = ? AND alert_type = 'disk_limit' AND severity = 'critical' AND acknowledged = 0`,
                [service.id]
              );
              if (!existing) {
                await db.execute(
                  `INSERT INTO service_alerts (service_id, alert_type, severity, threshold_value, current_value, created_at)
                   VALUES (?, 'disk_limit', 'critical', 95, ?, NOW())`,
                  [service.id, diskPercent]
                );
                alertsCreated++;
              }
            } else if (diskPercent > 80) {
              const existing = await db.queryOne(
                `SELECT id FROM service_alerts
                 WHERE service_id = ? AND alert_type = 'disk_limit' AND severity = 'warning' AND acknowledged = 0`,
                [service.id]
              );
              if (!existing) {
                await db.execute(
                  `INSERT INTO service_alerts (service_id, alert_type, severity, threshold_value, current_value, created_at)
                   VALUES (?, 'disk_limit', 'warning', 80, ?, NOW())`,
                  [service.id, diskPercent]
                );
                alertsCreated++;
              }
            }
          }

          // Check bandwidth thresholds
          if (bandwidthLimitMb > 0) {
            const bwPercent = (bandwidthUsedMb / bandwidthLimitMb) * 100;
            if (bwPercent > 95) {
              const existing = await db.queryOne(
                `SELECT id FROM service_alerts
                 WHERE service_id = ? AND alert_type = 'bandwidth_limit' AND severity = 'critical' AND acknowledged = 0`,
                [service.id]
              );
              if (!existing) {
                await db.execute(
                  `INSERT INTO service_alerts (service_id, alert_type, severity, threshold_value, current_value, created_at)
                   VALUES (?, 'bandwidth_limit', 'critical', 95, ?, NOW())`,
                  [service.id, bwPercent]
                );
                alertsCreated++;
              }
            } else if (bwPercent > 80) {
              const existing = await db.queryOne(
                `SELECT id FROM service_alerts
                 WHERE service_id = ? AND alert_type = 'bandwidth_limit' AND severity = 'warning' AND acknowledged = 0`,
                [service.id]
              );
              if (!existing) {
                await db.execute(
                  `INSERT INTO service_alerts (service_id, alert_type, severity, threshold_value, current_value, created_at)
                   VALUES (?, 'bandwidth_limit', 'warning', 80, ?, NOW())`,
                  [service.id, bwPercent]
                );
                alertsCreated++;
              }
            }
          }
        } catch (err) {
          console.error(`Failed to collect stats for service ${service.id} (${service.hestia_username}):`, err.message);
        }
      }

      res.json({
        success: true,
        stats_collected: statsCollected,
        alerts_created: alertsCreated,
        services_checked: services.length
      });
    })
  );

  /**
   * Get unacknowledged alerts for a specific hosting service
   * GET /hosting-services/:serviceId/alerts
   */
  router.get('/hosting-services/:serviceId/alerts',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const serviceId = validateNumericId(req.params.serviceId);

      const service = await db.queryOne(
        'SELECT * FROM user_hosting_services WHERE id = ?',
        [serviceId]
      );

      if (!service) {
        throw new AppError('Service not found', 404);
      }

      if (service.user_id !== req.user.id && !req.user.is_admin) {
        throw new AppError('Forbidden', 403);
      }

      const alerts = await db.query(
        `SELECT id, service_id, alert_type, severity, threshold_value, current_value, created_at
         FROM service_alerts
         WHERE service_id = ? AND acknowledged = 0
         ORDER BY created_at DESC`,
        [serviceId]
      );

      res.json({
        success: true,
        alerts
      });
    })
  );

  /**
   * Acknowledge an alert for a specific hosting service
   * PUT /hosting-services/:serviceId/alerts/:alertId/acknowledge
   */
  router.put('/hosting-services/:serviceId/alerts/:alertId/acknowledge',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const serviceId = validateNumericId(req.params.serviceId);
      const alertId = validateNumericId(req.params.alertId);

      const service = await db.queryOne(
        'SELECT * FROM user_hosting_services WHERE id = ?',
        [serviceId]
      );

      if (!service) {
        throw new AppError('Service not found', 404);
      }

      if (service.user_id !== req.user.id && !req.user.is_admin) {
        throw new AppError('Forbidden', 403);
      }

      const alert = await db.queryOne(
        'SELECT * FROM service_alerts WHERE id = ? AND service_id = ?',
        [alertId, serviceId]
      );

      if (!alert) {
        throw new AppError('Alert not found', 404);
      }

      await db.execute(
        'UPDATE service_alerts SET acknowledged = 1, acknowledged_at = NOW() WHERE id = ?',
        [alertId]
      );

      res.json({
        success: true,
        message: 'Alert acknowledged'
      });
    })
  );

  /**
   * Get all unacknowledged alerts across all user's services (for notification bell)
   * GET /alerts/unread
   */
  router.get('/alerts/unread',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const alerts = await db.query(
        `SELECT sa.id, sa.service_id, uhs.plan_name, sa.alert_type, sa.threshold_value,
                sa.current_value, sa.severity, sa.created_at
         FROM service_alerts sa
         JOIN user_hosting_services uhs ON sa.service_id = uhs.id
         WHERE uhs.user_id = ? AND sa.acknowledged = 0
         ORDER BY sa.created_at DESC`,
        [req.user.id]
      );

      res.json({
        success: true,
        count: alerts.length,
        alerts
      });
    })
  );

  /**
   * Admin: Cleanup old service statistics (older than 90 days)
   * DELETE /admin/services/cleanup-stats
   */
  router.delete('/admin/services/cleanup-stats',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await db.execute(
        'DELETE FROM service_statistics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 90 DAY)'
      );

      res.json({
        success: true,
        deleted_count: result.affectedRows || 0,
        message: 'Old statistics cleaned up'
      });
    })
  );

  /**
   * Admin: update hosting service
   * PUT /hosting-services/:id
   */
  router.put('/hosting-services/:id',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const serviceId = validateNumericId(req.params.id);
      const updates = req.body || {};

      const allowedFields = [
        'status',
        'price',
        'billing_period',
        'disk_space',
        'bandwidth',
        'databases',
        'email_accounts',
        'domains',
        'ftp_host',
        'ftp_username',
        'db_host',
        'db_name',
        'notes',
        'hestia_username',
        'hestia_domain',
        'hestia_package',
        'hestia_created',
        'hestia_created_at',
        'hestia_error',
        'cpanel_url'
      ];

      const setParts = [];
      const values = [];

      for (const key of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(updates, key)) {
          setParts.push(`${key} = ?`);
          values.push(updates[key]);
        }
      }

      if (setParts.length === 0) {
        throw new AppError('No valid fields to update', 400);
      }

      const updateQuery = `
        UPDATE user_hosting_services
        SET ${setParts.join(', ')}, updated_at = NOW()
        WHERE id = ?
      `;
      values.push(serviceId);

      await db.execute(updateQuery, values);

      const service = await db.queryOne(
        'SELECT * FROM user_hosting_services WHERE id = ?',
        [serviceId]
      );

      res.json({
        success: true,
        service
      });
    })
  );

  // ============================================
  // FILE MANAGER API
  // ============================================

  /**
   * List directory contents
   * GET /hosting-services/:serviceId/files/list
   */
  router.get('/hosting-services/:serviceId/files/list',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const dirPath = sanitizeFilePath(
        req.query.path || `/home/${service.hestia_username}`,
        service.hestia_username
      );

      const result = await hestiacp.listDirectory(service.hestia_username, dirPath);
      if (!result.success) {
        throw new AppError(result.error || 'Failed to list directory', 502);
      }

      res.json({
        success: true,
        path: dirPath,
        entries: result.entries || []
      });
    })
  );

  /**
   * Read file content (text)
   * GET /hosting-services/:serviceId/files/read
   */
  router.get('/hosting-services/:serviceId/files/read',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const filePath = sanitizeFilePath(req.query.path, service.hestia_username);

      const result = await hestiacp.readFile(service.hestia_username, filePath);
      if (!result.success) {
        throw new AppError(result.error || 'Failed to read file', 502);
      }

      const contentSize = Buffer.byteLength(result.content || '', 'utf-8');
      if (contentSize > 5 * 1024 * 1024) {
        return res.json({
          success: true,
          too_large: true,
          size: contentSize,
          path: filePath
        });
      }

      res.json({
        success: true,
        content: result.content,
        path: filePath,
        size: contentSize
      });
    })
  );

  /**
   * Download file
   * GET /hosting-services/:serviceId/files/download
   */
  router.get('/hosting-services/:serviceId/files/download',
    // SECURITY: Vlastní auth middleware - podpora tokenu z query param pro download
    asyncHandler(async (req, res, next) => {
      if (!req.headers.authorization && req.query.token) {
        req.headers.authorization = `Bearer ${req.query.token}`;
      }
      next();
    }),
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const filePath = sanitizeFilePath(req.query.path, service.hestia_username);

      const result = await hestiacp.readFile(service.hestia_username, filePath);
      if (!result.success) {
        throw new AppError(result.error || 'Failed to download file', 502);
      }

      const rawFileName = path.posix.basename(filePath);
      const safeFileName = rawFileName.replace(/[^\w.\-]/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(result.content);
    })
  );

  /**
   * Save file content (create or overwrite)
   * POST /hosting-services/:serviceId/files/save
   */
  router.post('/hosting-services/:serviceId/files/save',
    largeBodyParser,
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const { path: filePath, content } = req.body;

      if (!filePath || content === undefined) {
        throw new AppError('Path and content are required', 400);
      }

      if (typeof filePath !== 'string' || typeof content !== 'string') {
        throw new AppError('Path and content must be strings', 400);
      }

      const safePath = sanitizeFilePath(filePath, service.hestia_username);

      const contentSize = Buffer.byteLength(content, 'utf-8');
      if (contentSize > 5 * 1024 * 1024) {
        throw new AppError('File content exceeds 5 MB limit', 413);
      }

      const createResult = await hestiacp.createFile(service.hestia_username, safePath);
      if (!createResult.success && !createResult.error?.includes('exists')) {
        throw new AppError(createResult.error || 'Failed to create file', 502);
      }

      const contentBuffer = Buffer.from(content, 'utf-8');
      const writeResult = await hestiacp.writeFileContent(service.hestia_username, safePath, contentBuffer);

      if (!writeResult.success) {
        throw new AppError('Failed to write file content', 502);
      }

      res.json({ success: true, path: safePath });
    })
  );

  /**
   * Upload file (base64 encoded)
   * POST /hosting-services/:serviceId/files/upload
   */
  router.post('/hosting-services/:serviceId/files/upload',
    largeBodyParser,
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const { path: dirPath, filename, content: base64Content } = req.body;

      if (!dirPath || !filename || !base64Content) {
        throw new AppError('Path, filename and content are required', 400);
      }

      if (typeof filename !== 'string' || filename.length > 255 || filename.length === 0) {
        throw new AppError('Invalid filename (must be 1-255 characters)', 400);
      }
      if (/[/\\\0]/.test(filename) || filename.includes('..') || filename.startsWith('.')) {
        throw new AppError('Invalid filename', 400);
      }
      if (!/^[\w.\- ]+$/.test(filename)) {
        throw new AppError('Filename contains invalid characters', 400);
      }

      const fullPath = sanitizeFilePath(
        path.posix.join(dirPath, filename),
        service.hestia_username
      );

      if (typeof base64Content !== 'string') {
        throw new AppError('Content must be a base64 encoded string', 400);
      }

      if (base64Content.length > 35 * 1024 * 1024) {
        throw new AppError('File exceeds 25 MB upload limit', 413);
      }

      const fileBuffer = Buffer.from(base64Content, 'base64');
      if (fileBuffer.length > 25 * 1024 * 1024) {
        throw new AppError('File exceeds 25 MB upload limit', 413);
      }

      await hestiacp.createFile(service.hestia_username, fullPath);

      const writeResult = await hestiacp.writeFileContent(service.hestia_username, fullPath, fileBuffer);

      if (!writeResult.success) {
        throw new AppError('Failed to write uploaded file', 502);
      }

      res.json({ success: true, path: fullPath });
    })
  );

  /**
   * Create directory
   * POST /hosting-services/:serviceId/files/create-directory
   */
  router.post('/hosting-services/:serviceId/files/create-directory',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const { path: dirPath } = req.body;

      if (!dirPath) {
        throw new AppError('Path is required', 400);
      }

      const safePath = sanitizeFilePath(dirPath, service.hestia_username);
      const result = await hestiacp.createDirectory(service.hestia_username, safePath);
      if (!result.success) {
        throw new AppError(result.error || 'Failed to create directory', 502);
      }

      res.json({ success: true, path: safePath });
    })
  );

  /**
   * Create empty file
   * POST /hosting-services/:serviceId/files/create-file
   */
  router.post('/hosting-services/:serviceId/files/create-file',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const { path: filePath } = req.body;

      if (!filePath) {
        throw new AppError('Path is required', 400);
      }

      const safePath = sanitizeFilePath(filePath, service.hestia_username);
      const result = await hestiacp.createFile(service.hestia_username, safePath);
      if (!result.success) {
        throw new AppError(result.error || 'Failed to create file', 502);
      }

      res.json({ success: true, path: safePath });
    })
  );

  /**
   * Delete file or directory
   * DELETE /hosting-services/:serviceId/files/delete
   */
  router.delete('/hosting-services/:serviceId/files/delete',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const { path: filePath, type } = req.body;

      if (!filePath || !type) {
        throw new AppError('Path and type are required', 400);
      }
      if (type !== 'file' && type !== 'directory') {
        throw new AppError('Type must be "file" or "directory"', 400);
      }

      const safePath = sanitizeFilePath(filePath, service.hestia_username);

      const homeDir = `/home/${service.hestia_username}`;
      if (safePath === homeDir) {
        throw new AppError('Cannot delete home directory', 403);
      }

      let result;
      if (type === 'directory') {
        result = await hestiacp.deleteDirectory(service.hestia_username, safePath);
      } else {
        result = await hestiacp.deleteFile(service.hestia_username, safePath);
      }

      if (!result.success) {
        throw new AppError(result.error || 'Failed to delete', 502);
      }

      res.json({ success: true });
    })
  );

  /**
   * Rename/move file or directory
   * POST /hosting-services/:serviceId/files/rename
   */
  router.post('/hosting-services/:serviceId/files/rename',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const { fromPath, toPath } = req.body;

      if (!fromPath || !toPath) {
        throw new AppError('fromPath and toPath are required', 400);
      }
      if (typeof fromPath !== 'string' || typeof toPath !== 'string') {
        throw new AppError('fromPath and toPath must be strings', 400);
      }

      const safeFrom = sanitizeFilePath(fromPath, service.hestia_username);
      const safeTo = sanitizeFilePath(toPath, service.hestia_username);

      const result = await hestiacp.moveFile(service.hestia_username, safeFrom, safeTo);
      if (!result.success) {
        throw new AppError(result.error || 'Failed to rename', 502);
      }

      res.json({ success: true, path: safeTo });
    })
  );

  /**
   * Copy file
   * POST /hosting-services/:serviceId/files/copy
   */
  router.post('/hosting-services/:serviceId/files/copy',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const { fromPath, toPath } = req.body;

      if (!fromPath || !toPath) {
        throw new AppError('fromPath and toPath are required', 400);
      }
      if (typeof fromPath !== 'string' || typeof toPath !== 'string') {
        throw new AppError('fromPath and toPath must be strings', 400);
      }

      const safeFrom = sanitizeFilePath(fromPath, service.hestia_username);
      const safeTo = sanitizeFilePath(toPath, service.hestia_username);

      const result = await hestiacp.copyFile(service.hestia_username, safeFrom, safeTo);
      if (!result.success) {
        throw new AppError(result.error || 'Failed to copy', 502);
      }

      res.json({ success: true, path: safeTo });
    })
  );

  /**
   * Change file permissions
   * POST /hosting-services/:serviceId/files/chmod
   */
  router.post('/hosting-services/:serviceId/files/chmod',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const { path: filePath, permissions } = req.body;

      if (!filePath || !permissions) {
        throw new AppError('Path and permissions are required', 400);
      }

      if (!/^[0-7]{3,4}$/.test(permissions)) {
        throw new AppError('Invalid permissions format (use octal, e.g. 0755)', 400);
      }

      const safePath = sanitizeFilePath(filePath, service.hestia_username);
      const result = await hestiacp.changePermissions(service.hestia_username, safePath, permissions);
      if (!result.success) {
        throw new AppError(result.error || 'Failed to change permissions', 502);
      }

      res.json({ success: true });
    })
  );

  // ============================================
  // EMAIL MANAGEMENT
  // ============================================

  /**
   * Seznam vsech email uctu pro sluzbu
   * GET /hosting-services/:serviceId/emails
   */
  router.get('/hosting-services/:serviceId/emails',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);

      if (!service.hestia_username || !service.hestia_created) {
        return res.json({
          success: true,
          emails: [],
          message: 'HestiaCP account not yet created'
        });
      }

      const domainsResult = await hestiacp.listWebDomains(service.hestia_username);

      if (!domainsResult.success) {
        throw new AppError('Failed to fetch domains', 502);
      }

      const allEmails = [];
      for (const domainInfo of domainsResult.domains || []) {
        const accountsResult = await hestiacp.listMailAccounts(service.hestia_username, domainInfo.domain);
        if (accountsResult.success && accountsResult.accounts) {
          for (const account of accountsResult.accounts) {
            allEmails.push({
              id: `${account.email}`,
              email: account.email,
              domain: domainInfo.domain,
              quota_used: account.quota_used,
              quota_limit: account.quota_limit,
              quota_percent: account.quota_limit > 0
                ? Math.round((account.quota_used / account.quota_limit) * 100)
                : 0,
              suspended: account.suspended,
            });
          }
        }
      }

      res.json({
        success: true,
        emails: allEmails
      });
    })
  );

  /**
   * Vytvoreni noveho email uctu
   * POST /hosting-services/:serviceId/emails
   */
  router.post('/hosting-services/:serviceId/emails',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const { domain, email, password } = req.body || {};

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      if (!domain || typeof domain !== 'string') {
        throw new AppError('Domain is required', 400);
      }
      if (!email || typeof email !== 'string') {
        throw new AppError('Email is required', 400);
      }
      if (!password || typeof password !== 'string' || password.length < 8) {
        throw new AppError('Password is required and must be at least 8 characters', 400);
      }

      const emailRegex = /^[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError('Invalid email format', 400);
      }

      const result = await hestiacp.createMailAccount(
        service.hestia_username,
        domain,
        email,
        password
      );

      if (!result.success) {
        throw new AppError(result.error || 'Failed to create email account', 502);
      }

      res.json({
        success: true,
        message: 'Email account created successfully'
      });
    })
  );

  /**
   * Smazani email uctu
   * DELETE /hosting-services/:serviceId/emails/:emailId
   */
  router.delete('/hosting-services/:serviceId/emails/:emailId',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const emailId = decodeURIComponent(req.params.emailId);

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      const emailParts = emailId.includes('@') ? emailId.split('@') : [emailId, ''];
      const emailLocal = emailParts[0];
      const domain = emailParts[1] || service.hestia_domain;

      if (!domain) {
        throw new AppError('Domain is required', 400);
      }

      const result = await hestiacp.deleteMailAccount(
        service.hestia_username,
        domain,
        emailLocal
      );

      if (!result.success) {
        throw new AppError(result.error || 'Failed to delete email account', 502);
      }

      res.json({
        success: true,
        message: 'Email account deleted successfully'
      });
    })
  );

  /**
   * Zmena hesla email uctu
   * PUT /hosting-services/:serviceId/emails/:emailId/password
   */
  router.put('/hosting-services/:serviceId/emails/:emailId/password',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const emailId = decodeURIComponent(req.params.emailId);
      const { password } = req.body || {};

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      if (!password || typeof password !== 'string' || password.length < 8) {
        throw new AppError('Password is required and must be at least 8 characters', 400);
      }

      const emailParts = emailId.includes('@') ? emailId.split('@') : [emailId, ''];
      const emailLocal = emailParts[0];
      const domain = emailParts[1] || service.hestia_domain;

      if (!domain) {
        throw new AppError('Domain is required', 400);
      }

      const result = await hestiacp.changeMailAccountPassword(
        service.hestia_username,
        domain,
        emailLocal,
        password
      );

      if (!result.success) {
        throw new AppError(result.error || 'Failed to change email password', 502);
      }

      res.json({
        success: true,
        message: 'Email password changed successfully'
      });
    })
  );

  /**
   * Quota email uctu
   * GET /hosting-services/:serviceId/emails/:emailId/quota
   */
  router.get('/hosting-services/:serviceId/emails/:emailId/quota',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const emailId = decodeURIComponent(req.params.emailId);

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      const emailParts = emailId.includes('@') ? emailId.split('@') : [emailId, ''];
      const emailLocal = emailParts[0];
      const domain = emailParts[1] || service.hestia_domain;

      if (!domain) {
        throw new AppError('Domain is required', 400);
      }

      const result = await hestiacp.getMailAccountQuota(
        service.hestia_username,
        domain,
        emailLocal
      );

      if (!result.success) {
        throw new AppError(result.error || 'Failed to get email quota', 502);
      }

      res.json({
        success: true,
        quota: result.quota
      });
    })
  );

  // ============================================
  // DOMAIN MANAGEMENT
  // ============================================

  /**
   * Seznam vsech web domen pro sluzbu
   * GET /hosting-services/:serviceId/domains
   */
  router.get('/hosting-services/:serviceId/domains',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);

      if (!service.hestia_username || !service.hestia_created) {
        return res.json({
          success: true,
          domains: [],
          message: 'HestiaCP account not yet created'
        });
      }

      const result = await hestiacp.listWebDomains(service.hestia_username);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to list domains', 502);
      }

      res.json({
        success: true,
        domains: result.domains || []
      });
    })
  );

  /**
   * Informace o konkretni domene
   * GET /hosting-services/:serviceId/domains/:domain
   */
  router.get('/hosting-services/:serviceId/domains/:domain',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const domain = decodeURIComponent(req.params.domain);

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      const result = await hestiacp.getWebDomainInfo(service.hestia_username, domain);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to get domain info', 502);
      }

      res.json({
        success: true,
        domain: result.domain
      });
    })
  );

  // ============================================
  // DATABASE MANAGEMENT
  // ============================================

  /**
   * Seznam vsech databazi pro sluzbu
   * GET /hosting-services/:serviceId/databases
   */
  router.get('/hosting-services/:serviceId/databases',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);

      if (!service.hestia_username || !service.hestia_created) {
        return res.json({
          success: true,
          databases: [],
          message: 'HestiaCP account not yet created'
        });
      }

      const result = await hestiacp.listDatabases(service.hestia_username);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to list databases', 502);
      }

      res.json({
        success: true,
        databases: result.databases || []
      });
    })
  );

  /**
   * Vytvoreni nove databaze
   * POST /hosting-services/:serviceId/databases
   */
  router.post('/hosting-services/:serviceId/databases',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const { database, dbuser, password } = req.body || {};

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      if (!database || typeof database !== 'string') {
        throw new AppError('Database name is required', 400);
      }
      if (!dbuser || typeof dbuser !== 'string') {
        throw new AppError('Database user is required', 400);
      }
      if (!password || typeof password !== 'string' || password.length < 8) {
        throw new AppError('Password is required and must be at least 8 characters', 400);
      }

      if (!/^[a-zA-Z0-9_]+$/.test(database)) {
        throw new AppError('Database name can only contain letters, numbers and underscores', 400);
      }

      const result = await hestiacp.createDatabase(
        service.hestia_username,
        database,
        dbuser,
        password
      );

      if (!result.success) {
        throw new AppError(result.error || 'Failed to create database', 502);
      }

      res.json({
        success: true,
        message: 'Database created successfully'
      });
    })
  );

  /**
   * Smazani databaze
   * DELETE /hosting-services/:serviceId/databases/:database
   */
  router.delete('/hosting-services/:serviceId/databases/:database',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const database = decodeURIComponent(req.params.database);

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      const result = await hestiacp.deleteDatabase(service.hestia_username, database);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to delete database', 502);
      }

      res.json({
        success: true,
        message: 'Database deleted successfully'
      });
    })
  );

  // ============================================
  // DNS Management API Endpoints
  // ============================================

  /**
   * Seznam DNS domen pro sluzbu
   * GET /hosting-services/:serviceId/dns/domains
   */
  router.get('/hosting-services/:serviceId/dns/domains',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);

      if (!service.hestia_username || !service.hestia_created) {
        return res.json({ success: true, domains: [] });
      }

      const result = await hestiacp.listDnsDomains(service.hestia_username);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to list DNS domains', 502);
      }

      res.json({
        success: true,
        domains: result.domains || []
      });
    })
  );

  /**
   * Seznam DNS zaznamu pro domenu
   * GET /hosting-services/:serviceId/dns/domains/:domain/records
   */
  router.get('/hosting-services/:serviceId/dns/domains/:domain/records',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const domain = decodeURIComponent(req.params.domain);

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      const result = await hestiacp.listDnsRecords(service.hestia_username, domain);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to list DNS records', 502);
      }

      res.json({
        success: true,
        records: result.records || []
      });
    })
  );

  /**
   * Pridani DNS zaznamu
   * POST /hosting-services/:serviceId/dns/domains/:domain/records
   */
  router.post('/hosting-services/:serviceId/dns/domains/:domain/records',
    authenticateUser,
    requireCsrfGuard,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const domain = decodeURIComponent(req.params.domain);
      const { name, type, value, priority, ttl } = req.body;

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      if (!name || !type || !value) {
        throw new AppError('Name, type and value are required', 400);
      }

      const validTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'];
      if (!validTypes.includes(type.toUpperCase())) {
        throw new AppError(`Invalid DNS record type. Valid types: ${validTypes.join(', ')}`, 400);
      }

      const result = await hestiacp.addDnsRecord(
        service.hestia_username,
        domain,
        name,
        type.toUpperCase(),
        value,
        priority || null,
        ttl || null
      );

      if (!result.success) {
        throw new AppError(result.error || 'Failed to add DNS record', 502);
      }

      res.json({
        success: true,
        message: 'DNS record added successfully'
      });
    })
  );

  /**
   * Smazani DNS zaznamu
   * DELETE /hosting-services/:serviceId/dns/domains/:domain/records/:recordId
   */
  router.delete('/hosting-services/:serviceId/dns/domains/:domain/records/:recordId',
    authenticateUser,
    requireCsrfGuard,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const domain = decodeURIComponent(req.params.domain);
      const recordId = decodeURIComponent(req.params.recordId);

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      const result = await hestiacp.deleteDnsRecord(service.hestia_username, domain, recordId);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to delete DNS record', 502);
      }

      res.json({
        success: true,
        message: 'DNS record deleted successfully'
      });
    })
  );

  /**
   * Pridani DNS domeny
   * POST /hosting-services/:serviceId/dns/domains
   */
  router.post('/hosting-services/:serviceId/dns/domains',
    authenticateUser,
    requireCsrfGuard,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const { domain, ip } = req.body;

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      if (!domain) {
        throw new AppError('Domain is required', 400);
      }

      const result = await hestiacp.addDnsDomain(service.hestia_username, domain, ip || null);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to add DNS domain', 502);
      }

      res.json({
        success: true,
        message: 'DNS domain added successfully'
      });
    })
  );

  /**
   * Smazani DNS domeny
   * DELETE /hosting-services/:serviceId/dns/domains/:domain
   */
  router.delete('/hosting-services/:serviceId/dns/domains/:domain',
    authenticateUser,
    requireCsrfGuard,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const domain = decodeURIComponent(req.params.domain);

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      const result = await hestiacp.deleteDnsDomain(service.hestia_username, domain);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to delete DNS domain', 502);
      }

      res.json({
        success: true,
        message: 'DNS domain deleted successfully'
      });
    })
  );

  // ============================================
  // FTP Management API Endpoints
  // ============================================

  /**
   * Seznam FTP uctu pro sluzbu
   * GET /hosting-services/:serviceId/ftp
   */
  router.get('/hosting-services/:serviceId/ftp',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const domain = req.query.domain || service.hestia_domain;

      if (!service.hestia_username || !service.hestia_created) {
        return res.json({ success: true, accounts: [] });
      }

      if (!domain) {
        return res.json({ success: true, accounts: [] });
      }

      const result = await hestiacp.listWebDomainFtp(service.hestia_username, domain);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to list FTP accounts', 502);
      }

      res.json({
        success: true,
        domain,
        accounts: result.accounts || []
      });
    })
  );

  /**
   * Pridani FTP uctu
   * POST /hosting-services/:serviceId/ftp
   */
  router.post('/hosting-services/:serviceId/ftp',
    authenticateUser,
    requireCsrfGuard,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const { domain, username, password, path } = req.body;

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      const useDomain = domain || service.hestia_domain;
      if (!useDomain) {
        throw new AppError('Domain is required', 400);
      }

      if (!username || !password) {
        throw new AppError('Username and password are required', 400);
      }

      if (password.length < 8) {
        throw new AppError('Password must be at least 8 characters', 400);
      }

      const result = await hestiacp.addWebDomainFtp(
        service.hestia_username,
        useDomain,
        username,
        password,
        path || 'public_html'
      );

      if (!result.success) {
        throw new AppError(result.error || 'Failed to add FTP account', 502);
      }

      res.json({
        success: true,
        message: 'FTP account created successfully'
      });
    })
  );

  /**
   * Smazani FTP uctu
   * DELETE /hosting-services/:serviceId/ftp/:domain/:ftpId
   */
  router.delete('/hosting-services/:serviceId/ftp/:domain/:ftpId',
    authenticateUser,
    requireCsrfGuard,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const domain = decodeURIComponent(req.params.domain);
      const ftpId = decodeURIComponent(req.params.ftpId);

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      const result = await hestiacp.deleteWebDomainFtp(service.hestia_username, domain, ftpId);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to delete FTP account', 502);
      }

      res.json({
        success: true,
        message: 'FTP account deleted successfully'
      });
    })
  );

  /**
   * Zmena hesla FTP uctu
   * PUT /hosting-services/:serviceId/ftp/:domain/:ftpId/password
   */
  router.put('/hosting-services/:serviceId/ftp/:domain/:ftpId/password',
    authenticateUser,
    requireCsrfGuard,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const domain = decodeURIComponent(req.params.domain);
      const ftpId = decodeURIComponent(req.params.ftpId);
      const { password } = req.body;

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      if (!password || password.length < 8) {
        throw new AppError('Password must be at least 8 characters', 400);
      }

      const result = await hestiacp.changeWebDomainFtpPassword(
        service.hestia_username,
        domain,
        ftpId,
        password
      );

      if (!result.success) {
        throw new AppError(result.error || 'Failed to change FTP password', 502);
      }

      res.json({
        success: true,
        message: 'FTP password changed successfully'
      });
    })
  );

  // ============================================
  // Backup Management API Endpoints
  // ============================================

  /**
   * Seznam zaloh pro sluzbu
   * GET /hosting-services/:serviceId/backups
   */
  router.get('/hosting-services/:serviceId/backups',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);

      if (!service.hestia_username || !service.hestia_created) {
        return res.json({ success: true, backups: [] });
      }

      const result = await hestiacp.listBackups(service.hestia_username);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to list backups', 502);
      }

      res.json({
        success: true,
        backups: result.backups || []
      });
    })
  );

  /**
   * Vytvoreni zalohy
   * POST /hosting-services/:serviceId/backups/create
   */
  router.post('/hosting-services/:serviceId/backups/create',
    authenticateUser,
    requireCsrfGuard,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const { notify } = req.body;

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      const result = await hestiacp.createBackup(service.hestia_username, notify || false);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to create backup', 502);
      }

      res.json({
        success: true,
        message: 'Backup creation started successfully'
      });
    })
  );

  /**
   * Obnoveni zalohy
   * POST /hosting-services/:serviceId/backups/:backupId/restore
   */
  router.post('/hosting-services/:serviceId/backups/:backupId/restore',
    authenticateUser,
    requireCsrfGuard,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const backupId = decodeURIComponent(req.params.backupId);

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      const result = await hestiacp.restoreBackup(service.hestia_username, backupId);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to restore backup', 502);
      }

      res.json({
        success: true,
        message: 'Backup restoration started successfully'
      });
    })
  );

  /**
   * Smazani zalohy
   * DELETE /hosting-services/:serviceId/backups/:backupId
   */
  router.delete('/hosting-services/:serviceId/backups/:backupId',
    authenticateUser,
    requireCsrfGuard,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const backupId = decodeURIComponent(req.params.backupId);

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      const result = await hestiacp.deleteBackup(service.hestia_username, backupId);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to delete backup', 502);
      }

      res.json({
        success: true,
        message: 'Backup deleted successfully'
      });
    })
  );

  // ============================================
  // Cron Jobs Management API Endpoints
  // ============================================

  /**
   * Seznam cron jobu pro sluzbu
   * GET /hosting-services/:serviceId/cron
   */
  router.get('/hosting-services/:serviceId/cron',
    authenticateUser,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);

      if (!service.hestia_username || !service.hestia_created) {
        return res.json({ success: true, cronJobs: [] });
      }

      const result = await hestiacp.listCronJobs(service.hestia_username);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to list cron jobs', 502);
      }

      res.json({
        success: true,
        cronJobs: result.cronJobs || []
      });
    })
  );

  /**
   * Vytvoreni cron jobu
   * POST /hosting-services/:serviceId/cron
   */
  router.post('/hosting-services/:serviceId/cron',
    authenticateUser,
    requireCsrfGuard,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const { min, hour, day, month, weekday, command } = req.body;

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      if (!min || !hour || !day || !month || !weekday || !command) {
        throw new AppError('Missing required fields: min, hour, day, month, weekday, command', 400);
      }

      const result = await hestiacp.addCronJob(
        service.hestia_username,
        min,
        hour,
        day,
        month,
        weekday,
        command
      );

      if (!result.success) {
        throw new AppError(result.error || 'Failed to create cron job', 502);
      }

      res.json({
        success: true,
        message: 'Cron job created successfully'
      });
    })
  );

  /**
   * Smazani cron jobu
   * DELETE /hosting-services/:serviceId/cron/:jobId
   */
  router.delete('/hosting-services/:serviceId/cron/:jobId',
    authenticateUser,
    requireCsrfGuard,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const jobId = decodeURIComponent(req.params.jobId);

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      const result = await hestiacp.deleteCronJob(service.hestia_username, jobId);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to delete cron job', 502);
      }

      res.json({
        success: true,
        message: 'Cron job deleted successfully'
      });
    })
  );

  /**
   * Pozastaveni/obnoveni cron jobu
   * PUT /hosting-services/:serviceId/cron/:jobId/suspend
   */
  router.put('/hosting-services/:serviceId/cron/:jobId/suspend',
    authenticateUser,
    requireCsrfGuard,
    fileOpsLimiter,
    asyncHandler(async (req, res) => {
      const service = await resolveServiceForFiles(req);
      const jobId = decodeURIComponent(req.params.jobId);
      const { suspend } = req.body;

      if (!service.hestia_username || !service.hestia_created) {
        throw new AppError('HestiaCP account not yet created', 400);
      }

      if (typeof suspend !== 'boolean') {
        throw new AppError('Missing or invalid suspend parameter', 400);
      }

      const result = await hestiacp.suspendCronJob(service.hestia_username, jobId, suspend);

      if (!result.success) {
        throw new AppError(result.error || `Failed to ${suspend ? 'suspend' : 'unsuspend'} cron job`, 502);
      }

      res.json({
        success: true,
        message: `Cron job ${suspend ? 'suspended' : 'unsuspended'} successfully`
      });
    })
  );

  return router;
};
