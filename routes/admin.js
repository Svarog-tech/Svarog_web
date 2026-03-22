const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

module.exports = function({ db, logger, hestiacp, authenticateUser, requireAdmin }) {
  const { asyncHandler, AppError } = require('../middleware/errorHandler');
  const { validateCreateAccount, validateUsername } = require('../middleware/validators');

  // Lazy-load emailService
  let _emailService;
  function getEmailService() {
    if (!_emailService) {
      _emailService = require('../services/emailService');
    }
    return _emailService;
  }

  // Limiter pro citlive operace (MFA, zmena hesla)
  const sensitiveOpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Prilis mnoho pokusu, zkuste to za 15 minut.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // In-memory TTL cache for HestiaCP live data
  const hestiaCache = new Map();
  const HESTIA_CACHE_TTL = 60 * 1000; // 60 seconds

  function getCached(key) {
    const entry = hestiaCache.get(key);
    if (entry && Date.now() - entry.timestamp < HESTIA_CACHE_TTL) {
      return entry.data;
    }
    hestiaCache.delete(key);
    return null;
  }

  function setCache(key, data) {
    hestiaCache.set(key, { data, timestamp: Date.now() });
  }

  // Audit logging helper
  async function auditLog(userId, action, targetType, targetId, details, req) {
    try {
      await db.execute(
        'INSERT INTO audit_log (user_id, action, target_type, target_id, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, action, targetType, targetId, details ? JSON.stringify(details) : null, req?.ip || null, req?.get('user-agent')?.substring(0, 500) || null]
      );
    } catch (err) {
      logger.error('Failed to write audit log', { error: err.message, action, userId });
    }
  }

  // Pagination helpers
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
  // HestiaCP PROVISIONING (admin-only)
  // ============================================

  /**
   * HestiaCP - Vytvoreni hosting uctu
   * POST /hestiacp/create-account
   */
  router.post('/hestiacp/create-account',
    authenticateUser,
    requireAdmin,
    validateCreateAccount,
    asyncHandler(async (req, res) => {
      logger.request(req, 'Creating HestiaCP hosting account');
      const { email, domain, package: pkg, username, password } = req.body;

      const result = await hestiacp.createHostingAccount({
        email,
        domain,
        package: pkg,
        username,
        password
      });

      if (!result.success) {
        logger.error('HestiaCP account creation failed', {
          requestId: req.id,
          error: result.error,
          email,
          domain
        });
        throw new AppError(result.error || 'Failed to create hosting account', 500);
      }

      logger.request(req, 'HestiaCP account created successfully', {
        username: result.username,
        domain: result.domain
      });

      await auditLog(req.user.id, 'hestiacp.create_account', 'hestiacp_account', result.username, { domain: result.domain, package: result.package }, req);

      res.json({
        success: true,
        username: result.username,
        domain: result.domain,
        cpanelUrl: result.cpanelUrl,
        package: result.package,
        message: 'Ucet vytvoren. Prihlasoovaci udaje byly ulozeny do profilu uzivatele.'
      });
    })
  );

  /**
   * HestiaCP - Vytvoreni WEB DOMENY pro existujiciho uzivatele
   * POST /hestiacp/create-domain
   */
  router.post('/hestiacp/create-domain',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      logger.request(req, 'Creating HestiaCP web domain (admin)', {
        body: { username: req.body?.username, domain: req.body?.domain }
      });

      const { username, domain, ip } = req.body || {};

      if (!username || typeof username !== 'string') {
        throw new AppError('Username is required', 400);
      }
      if (!domain || typeof domain !== 'string') {
        throw new AppError('Domain is required', 400);
      }

      const domainResult = await hestiacp.createWebDomain({ username, domain, ip });

      if (!domainResult.success) {
        logger.error('HestiaCP createWebDomain failed', {
          requestId: req.id,
          username,
          domain,
          error: domainResult.error
        });
        throw new AppError(domainResult.error || 'Failed to create web domain', 500);
      }

      res.json({
        success: true,
        domain: domainResult.domain,
        ip: domainResult.ip,
        message: domainResult.message
      });
    })
  );

  /**
   * HestiaCP - Nastaveni SSL (Let's Encrypt) pro domenu
   * POST /hestiacp/setup-ssl
   */
  router.post('/hestiacp/setup-ssl',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      logger.request(req, 'Setting up HestiaCP SSL (admin)', {
        body: { username: req.body?.username, domain: req.body?.domain }
      });

      const { username, domain } = req.body || {};

      if (!username || typeof username !== 'string') {
        throw new AppError('Username is required', 400);
      }
      if (!domain || typeof domain !== 'string') {
        throw new AppError('Domain is required', 400);
      }

      const sslResult = await hestiacp.setupSSL({ username, domain });

      if (!sslResult.success) {
        logger.warn('HestiaCP SSL setup failed', {
          requestId: req.id,
          username,
          domain,
          error: sslResult.error
        });
        return res.status(200).json({
          success: false,
          warning: sslResult.warning || 'SSL setup failed (domain DNS may not be ready yet)',
          error: sslResult.error
        });
      }

      res.json({
        success: true,
        message: 'SSL configured successfully'
      });
    })
  );

  /**
   * HestiaCP - Suspendovani uctu
   * POST /hestiacp/suspend-account
   */
  router.post('/hestiacp/suspend-account',
    sensitiveOpLimiter,
    authenticateUser,
    requireAdmin,
    validateUsername,
    asyncHandler(async (req, res) => {
      logger.request(req, 'Suspending HestiaCP account');
      const { username } = req.body;

      const result = await hestiacp.suspendUser(username);

      if (!result.success) {
        logger.error('HestiaCP account suspension failed', {
          requestId: req.id,
          username,
          error: result.error
        });
        throw new AppError(result.error || 'Failed to suspend account', 500);
      }

      logger.request(req, 'HestiaCP account suspended successfully', { username });
      await auditLog(req.user.id, 'hestiacp.suspend_account', 'hestiacp_account', username, null, req);

      res.json({
        success: true
      });
    })
  );

  /**
   * HestiaCP - Obnoveni uctu
   * POST /hestiacp/unsuspend-account
   */
  router.post('/hestiacp/unsuspend-account',
    sensitiveOpLimiter,
    authenticateUser,
    requireAdmin,
    validateUsername,
    asyncHandler(async (req, res) => {
      logger.request(req, 'Unsuspending HestiaCP account');
      const { username } = req.body;

      const result = await hestiacp.unsuspendUser(username);

      if (!result.success) {
        logger.error('HestiaCP account unsuspension failed', {
          requestId: req.id,
          username,
          error: result.error
        });
        throw new AppError(result.error || 'Failed to unsuspend account', 500);
      }

      logger.request(req, 'HestiaCP account unsuspended successfully', { username });
      await auditLog(req.user.id, 'hestiacp.unsuspend_account', 'hestiacp_account', username, null, req);

      res.json({
        success: true
      });
    })
  );

  /**
   * HestiaCP - Smazani uctu
   * POST /hestiacp/delete-account
   */
  router.post('/hestiacp/delete-account',
    sensitiveOpLimiter,
    authenticateUser,
    requireAdmin,
    validateUsername,
    asyncHandler(async (req, res) => {
      logger.request(req, 'Deleting HestiaCP account');
      const { username } = req.body;

      const result = await hestiacp.deleteUser(username);

      if (!result.success) {
        logger.error('HestiaCP account deletion failed', {
          requestId: req.id,
          username,
          error: result.error
        });
        throw new AppError(result.error || 'Failed to delete account', 500);
      }

      logger.request(req, 'HestiaCP account deleted successfully', { username });
      await auditLog(req.user.id, 'hestiacp.delete_account', 'hestiacp_account', username, null, req);

      res.json({
        success: true
      });
    })
  );

  // ============================================
  // ADMIN: HestiaCP Packages & Service Creation
  // ============================================

  /**
   * Admin: seznam HestiaCP balicku
   * GET /admin/hestiacp-packages
   */
  router.get('/admin/hestiacp-packages',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await hestiacp.listPackages();
      if (!result.success) {
        return res.status(502).json({
          success: false,
          error: result.error || 'HestiaCP packages unavailable'
        });
      }
      res.json({ success: true, packages: result.packages || [] });
    })
  );

  /**
   * Admin: vytvorit novou hosting sluzbu + HestiaCP ucet bez nakupu/platby
   * POST /admin/create-hosting-service
   */
  router.post('/admin/create-hosting-service',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { userId, domain, planId, planName, price, hestiaPackage } = req.body || {};

      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!userId || typeof userId !== 'string') {
        throw new AppError('userId is required', 400);
      }
      if (!UUID_REGEX.test(userId)) {
        throw new AppError('Invalid user ID format', 400);
      }
      if (!domain || typeof domain !== 'string') {
        throw new AppError('domain is required', 400);
      }

      const userProfile = await db.queryOne(
        'SELECT email, first_name, last_name, hestia_username FROM profiles WHERE id = ?',
        [userId]
      );

      if (!userProfile) {
        throw new AppError('Target user not found', 404);
      }

      const effectivePlanId = planId || 'admin_custom';
      const effectivePlanName = planName || 'Admin Webhosting';
      const effectivePrice = typeof price === 'number' && !Number.isNaN(price) ? price : 0;
      const hestiaPkg = (typeof hestiaPackage === 'string' && hestiaPackage.trim()) ? hestiaPackage.trim() : (process.env.HESTIACP_DEFAULT_PACKAGE || 'default');

      // 1) vytvor objednavku v user_orders (okamzite aktivni a zaplacena)
      const orderResult = await db.execute(
        `INSERT INTO user_orders (
           user_id, plan_id, plan_name, price, currency,
           billing_email, billing_name,
           customer_email, customer_name,
           status, payment_status,
           domain_name
         ) VALUES (?, ?, ?, ?, 'CZK', ?, ?, ?, ?, 'active', 'paid', ?)`,
        [
          userId,
          effectivePlanId,
          effectivePlanName,
          effectivePrice,
          userProfile.email,
          `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || userProfile.email,
          userProfile.email,
          `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || userProfile.email,
          domain
        ]
      );

      const orderId = orderResult.insertId;

      // 2) vytvor hosting sluzbu navazanou na tuto objednavku
      const serviceResult = await db.execute(
        `INSERT INTO user_hosting_services (
           user_id, order_id,
           plan_name, plan_id,
           status, price, billing_period,
           activated_at, expires_at, next_billing_date
         ) VALUES (
           ?, ?, ?, ?, 'pending', ?, 'monthly',
           NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY)
         )`,
        [
          userId,
          orderId,
          effectivePlanName,
          effectivePlanId,
          effectivePrice
        ]
      );

      const serviceId = serviceResult.insertId;

      // 3) Vytvor v HestiaCP web pro tohoto uzivatele
      const hestiaResult = await hestiacp.createHostingAccount({
        email: userProfile.email,
        domain,
        package: hestiaPkg,
        username: userProfile.hestia_username || undefined
      });

      if (!hestiaResult.success) {
        await db.execute(
          `UPDATE user_hosting_services
           SET hestia_created = FALSE,
               hestia_error = ?
           WHERE id = ?`,
          [hestiaResult.error || 'Unknown HestiaCP error', serviceId]
        );

        return res.status(200).json({
          success: false,
          warning: 'Sluzba byla vytvorena, ale HestiaCP ucet se nepodarilo zalozit',
          hestiaError: hestiaResult.error
        });
      }

      // 4) aktualizuj sluzbu s HestiaCP udaji
      await db.execute(
        `UPDATE user_hosting_services
         SET hestia_username = ?,
             hestia_domain = ?,
             hestia_package = ?,
             hestia_created = TRUE,
             hestia_created_at = NOW(),
             cpanel_url = ?,
             status = 'active'
         WHERE id = ?`,
        [
          hestiaResult.username,
          hestiaResult.domain || domain,
          hestiaResult.package || hestiaPkg,
          hestiaResult.cpanelUrl || null,
          serviceId
        ]
      );

      // 5) propoj profil vybraneho uzivatele s HestiaCP uctem
      await db.execute(
        'UPDATE profiles SET hestia_username = ?, hestia_created = TRUE, hestia_error = NULL WHERE id = ?',
        [hestiaResult.username, userId]
      );

      const service = await db.queryOne(
        'SELECT * FROM user_hosting_services WHERE id = ?',
        [serviceId]
      );

      res.status(201).json({
        success: true,
        service,
        orderId,
        hestia: {
          username: hestiaResult.username,
          domain: hestiaResult.domain || domain,
          cpanelUrl: hestiaResult.cpanelUrl,
          package: hestiaResult.package || effectivePlanId
        }
      });
    })
  );

  /**
   * Admin: get all tickets with user info
   * GET /admin/tickets
   */
  router.get('/admin/tickets',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { page, limit, offset } = parsePagination(req.query);

      const countResult = await db.query('SELECT COUNT(*) as total FROM support_tickets');
      const total = countResult[0]?.total || 0;

      const tickets = await db.query(
        `SELECT t.*,
                p.email AS user_email, p.first_name, p.last_name,
                ap.first_name AS assigned_first_name, ap.last_name AS assigned_last_name
         FROM support_tickets t
         LEFT JOIN profiles p ON p.id = t.user_id
         LEFT JOIN profiles ap ON ap.id = t.assigned_to
         ORDER BY t.created_at DESC LIMIT ? OFFSET ?`, [limit, offset]
      );

      const formatted = (tickets || []).map(t => ({
        id: t.id,
        user_id: t.user_id,
        subject: t.subject,
        message: t.message,
        status: t.status,
        priority: t.priority,
        category: t.category,
        assigned_to: t.assigned_to,
        last_reply_at: t.last_reply_at,
        created_at: t.created_at,
        user_email: t.user_email,
        user_name: `${t.first_name || ''} ${t.last_name || ''}`.trim(),
        assigned_name: t.assigned_to ? `${t.assigned_first_name || ''} ${t.assigned_last_name || ''}`.trim() : undefined
      }));

      res.json({
        success: true,
        tickets: formatted,
        pagination: paginationMeta(page, limit, total)
      });
    })
  );

  // ============================================
  // ADMIN: HestiaCP Live Data Endpoints
  // ============================================

  /**
   * GET /admin/hestiacp/users - Seznam vsech HestiaCP uzivatelu (live)
   */
  router.get('/admin/hestiacp/users',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const cacheKey = 'hestia:users';
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);

      const result = await hestiacp.listUsers();
      if (!result.success) {
        return res.status(502).json({ success: false, error: result.error || 'HestiaCP nedostupne' });
      }

      const localProfiles = await db.query(
        'SELECT id, email, hestia_username, first_name, last_name FROM profiles WHERE hestia_username IS NOT NULL'
      );
      const localMap = {};
      for (const p of (localProfiles || [])) {
        if (p.hestia_username) localMap[p.hestia_username] = p;
      }

      const users = result.users.map(u => ({
        ...u,
        is_system_admin: u.username === process.env.HESTIACP_USERNAME,
        linked_local_user: localMap[u.username] ? {
          id: localMap[u.username].id,
          email: localMap[u.username].email,
          name: `${localMap[u.username].first_name || ''} ${localMap[u.username].last_name || ''}`.trim()
        } : null
      }));

      const response = { success: true, users };
      setCache(cacheKey, response);
      res.json(response);
    })
  );

  /**
   * GET /admin/hestiacp/users/:username - Detail uzivatele
   */
  router.get('/admin/hestiacp/users/:username',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { username } = req.params;
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        throw new AppError('Neplatny format', 400);
      }

      const cacheKey = `hestia:user:${username}`;
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);

      const [userStats, webDomains, databases, mailDomains] = await Promise.all([
        hestiacp.getUserStats(username),
        hestiacp.listWebDomains(username),
        hestiacp.listDatabases(username),
        hestiacp.listMailDomains(username),
      ]);

      const localProfile = await db.queryOne(
        'SELECT id, email, first_name, last_name FROM profiles WHERE hestia_username = ?', [username]
      );

      const response = {
        success: true,
        username,
        stats: userStats.success ? userStats.stats : null,
        domains: webDomains.success ? (webDomains.domains || []) : [],
        databases: databases.success ? (databases.databases || []) : [],
        mail_domains: mailDomains.success ? (mailDomains.domains || []) : [],
        linked_local_user: localProfile || null,
      };

      setCache(cacheKey, response);
      res.json(response);
    })
  );

  /**
   * GET /admin/hestiacp/server-stats - Agregovane statistiky
   */
  router.get('/admin/hestiacp/server-stats',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const cacheKey = 'hestia:server-stats';
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);

      const result = await hestiacp.listUsers();
      if (!result.success) {
        return res.status(502).json({ success: false, error: result.error || 'HestiaCP nedostupne' });
      }

      const users = result.users.filter(u => u.username !== process.env.HESTIACP_USERNAME);
      const stats = {
        total_users: users.length,
        active_users: users.filter(u => !u.suspended).length,
        suspended_users: users.filter(u => u.suspended).length,
        total_web_domains: users.reduce((s, u) => s + u.web_domains, 0),
        total_databases: users.reduce((s, u) => s + u.databases, 0),
        total_mail_domains: users.reduce((s, u) => s + u.mail_domains, 0),
        total_disk_used_mb: users.reduce((s, u) => s + u.disk_used_mb, 0),
        total_bandwidth_used_mb: users.reduce((s, u) => s + u.bandwidth_used_mb, 0),
      };

      const response = { success: true, stats };
      setCache(cacheKey, response);
      res.json(response);
    })
  );

  return router;
};
