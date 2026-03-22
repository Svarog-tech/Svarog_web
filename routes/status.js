const express = require('express');
const router = express.Router();

module.exports = function({ db, logger, hestiacp, authenticateUser, requireAdmin }) {
  const { asyncHandler, AppError } = require('../middleware/errorHandler');

  // ============================================
  // GET /status — Public server status page data
  // ============================================
  router.get('/status', asyncHandler(async (req, res) => {
    const services = [
      { name: 'Web Hosting', key: 'web_hosting', status: 'operational', uptime_30d: 99.9 },
      { name: 'Email', key: 'email', status: 'operational', uptime_30d: 99.8 },
      { name: 'DNS', key: 'dns', status: 'operational', uptime_30d: 100 },
      { name: 'Platebn\u00ed syst\u00e9m', key: 'payment', status: 'operational', uptime_30d: 99.95 },
      { name: 'Z\u00e1kaznick\u00e1 podpora', key: 'support', status: 'operational', uptime_30d: 100 }
    ];

    // Check HestiaCP connectivity
    try {
      if (hestiacp && typeof hestiacp.listUsers === 'function') {
        await Promise.race([
          hestiacp.listUsers(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
      }
    } catch (err) {
      const webHosting = services.find(s => s.key === 'web_hosting');
      if (webHosting) {
        webHosting.status = 'degraded';
        webHosting.uptime_30d = Math.max(webHosting.uptime_30d - 0.1, 95);
      }
      logger.warn('Status check: HestiaCP connectivity issue', { error: err.message });
    }

    // Check DB connectivity
    try {
      await db.queryOne('SELECT 1 as ok');
    } catch (err) {
      // If DB is down, all services are affected
      for (const svc of services) {
        svc.status = 'major_outage';
      }
      logger.error('Status check: DB connectivity issue', { error: err.message });
    }

    // Check Stripe API status
    try {
      if (process.env.STRIPE_SECRET_KEY) {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await Promise.race([
          stripe.balance.retrieve(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
      }
    } catch (err) {
      const payment = services.find(s => s.key === 'payment');
      if (payment) {
        payment.status = 'degraded';
        payment.uptime_30d = Math.max(payment.uptime_30d - 0.1, 95);
      }
      logger.warn('Status check: Stripe connectivity issue', { error: err.message });
    }

    // Check for active incidents affecting services
    let incidents = [];
    try {
      incidents = await db.query(
        `SELECT id, title, description, severity, status, affected_services, started_at, resolved_at, created_at
         FROM status_incidents
         WHERE status != 'resolved' OR (status = 'resolved' AND resolved_at > DATE_SUB(NOW(), INTERVAL 7 DAY))
         ORDER BY started_at DESC
         LIMIT 20`
      ) || [];

      // Update service status based on active incidents
      const activeIncidents = incidents.filter(i => i.status !== 'resolved');
      for (const incident of activeIncidents) {
        let affectedList = [];
        try {
          affectedList = typeof incident.affected_services === 'string'
            ? JSON.parse(incident.affected_services)
            : (incident.affected_services || []);
        } catch (e) {
          affectedList = [];
        }

        for (const affectedKey of affectedList) {
          const svc = services.find(s => s.key === affectedKey);
          if (svc) {
            if (incident.severity === 'critical') {
              svc.status = 'major_outage';
            } else if (svc.status !== 'major_outage') {
              svc.status = 'degraded';
            }
          }
        }
      }
    } catch (err) {
      // Table might not exist yet
      logger.warn('Status incidents query failed (table may not exist)', { error: err.message });
    }

    // Determine overall status
    let overall_status = 'operational';
    if (services.some(s => s.status === 'major_outage')) {
      overall_status = 'major_outage';
    } else if (services.some(s => s.status === 'degraded')) {
      overall_status = 'degraded';
    }

    // Clean response (remove internal keys)
    const cleanServices = services.map(({ key, ...rest }) => rest);

    res.json({
      overall_status,
      services: cleanServices,
      incidents: incidents.map(i => ({
        ...i,
        affected_services: typeof i.affected_services === 'string'
          ? JSON.parse(i.affected_services)
          : (i.affected_services || [])
      }))
    });
  }));

  // ============================================
  // POST /admin/status/incident — Create incident (admin only)
  // ============================================
  router.post('/admin/status/incident',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { title, description, severity, affected_services } = req.body;

      if (!title || !title.trim()) {
        throw new AppError('Title is required', 400);
      }

      const validSeverities = ['minor', 'major', 'critical'];
      const sev = validSeverities.includes(severity) ? severity : 'minor';

      const result = await db.execute(
        `INSERT INTO status_incidents (title, description, severity, status, affected_services, created_by)
         VALUES (?, ?, ?, 'investigating', ?, ?)`,
        [
          title.trim(),
          description || null,
          sev,
          affected_services ? JSON.stringify(affected_services) : null,
          req.user.id
        ]
      );

      logger.info('Status incident created', {
        incidentId: result.insertId,
        title: title.trim(),
        severity: sev,
        createdBy: req.user.id
      });

      res.status(201).json({
        success: true,
        incident: {
          id: result.insertId,
          title: title.trim(),
          description: description || null,
          severity: sev,
          status: 'investigating',
          affected_services: affected_services || null
        }
      });
    })
  );

  // ============================================
  // PUT /admin/status/incident/:id — Update incident (admin only)
  // ============================================
  router.put('/admin/status/incident/:id',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { title, description, severity, status, affected_services } = req.body;

      const incident = await db.queryOne(
        'SELECT * FROM status_incidents WHERE id = ?',
        [id]
      );

      if (!incident) {
        throw new AppError('Incident not found', 404);
      }

      const updateFields = [];
      const updateValues = [];

      if (title !== undefined) {
        updateFields.push('title = ?');
        updateValues.push(title.trim());
      }
      if (description !== undefined) {
        updateFields.push('description = ?');
        updateValues.push(description);
      }
      if (severity !== undefined) {
        const validSeverities = ['minor', 'major', 'critical'];
        if (validSeverities.includes(severity)) {
          updateFields.push('severity = ?');
          updateValues.push(severity);
        }
      }
      if (status !== undefined) {
        const validStatuses = ['investigating', 'identified', 'monitoring', 'resolved'];
        if (validStatuses.includes(status)) {
          updateFields.push('status = ?');
          updateValues.push(status);
          if (status === 'resolved') {
            updateFields.push('resolved_at = NOW()');
          }
        }
      }
      if (affected_services !== undefined) {
        updateFields.push('affected_services = ?');
        updateValues.push(JSON.stringify(affected_services));
      }

      if (updateFields.length === 0) {
        throw new AppError('No fields to update', 400);
      }

      updateValues.push(id);

      await db.execute(
        `UPDATE status_incidents SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      logger.info('Status incident updated', { incidentId: id, updatedBy: req.user.id });

      const updated = await db.queryOne('SELECT * FROM status_incidents WHERE id = ?', [id]);

      res.json({
        success: true,
        incident: {
          ...updated,
          affected_services: typeof updated.affected_services === 'string'
            ? JSON.parse(updated.affected_services)
            : (updated.affected_services || [])
        }
      });
    })
  );

  return router;
};
