const express = require('express');
const router = express.Router();

module.exports = function({ db, hestiacp }) {
  const { asyncHandler } = require('../middleware/errorHandler');
  const logger = require('../utils/logger');

  /**
   * Health check endpoint
   * GET /health
   */
  router.get('/health', asyncHandler(async (req, res) => {
    // Zkontroluj MySQL pripojeni
    let mysqlStatus = 'unknown';
    let mysqlError = null;
    try {
      await db.query('SELECT 1 as test');
      mysqlStatus = 'connected';
    } catch (error) {
      mysqlStatus = 'error';
      mysqlError = error.message;
      logger.error('MySQL health check failed', {
        requestId: req.id,
        error: error.message
      });
    }

    const overallStatus = mysqlStatus === 'connected' ? 'ok' : 'error';
    const httpStatus = mysqlStatus === 'connected' ? 200 : 503;

    const healthResponse = {
      status: overallStatus,
      database: {
        mysql: mysqlStatus
      }
    };

    // V development modu pridat error message
    if (process.env.NODE_ENV !== 'production' && mysqlError) {
      healthResponse.database.mysql_error = mysqlError;
    }

    // V development modu pridat vice informaci
    if (process.env.NODE_ENV !== 'production') {
      healthResponse.database.mysql_host = process.env.MYSQL_HOST || 'not configured';
      healthResponse.database.mysql_database = process.env.MYSQL_DATABASE || 'not configured';
      healthResponse.gopay_environment = process.env.GOPAY_ENVIRONMENT || 'SANDBOX';
      healthResponse.hestiacp_configured = !!(process.env.HESTIACP_URL && process.env.HESTIACP_ACCESS_KEY);
      healthResponse.jwt_auth_configured = !!(process.env.JWT_SECRET);
    } else {
      // V produkci pouze zakladni status
      healthResponse.hestiacp_configured = !!(process.env.HESTIACP_URL && process.env.HESTIACP_ACCESS_KEY);
      healthResponse.jwt_auth_configured = !!(process.env.JWT_SECRET);
    }

    res.status(httpStatus).json(healthResponse);
  }));

  /**
   * Liveness probe - proces bezi (bez kontroly DB).
   * GET /health/live
   */
  router.get('/health/live', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  /**
   * Readiness probe - aplikace je pripravena prijimat traffic (kontrola DB).
   * GET /health/ready
   */
  router.get('/health/ready', asyncHandler(async (req, res) => {
    let mysqlStatus = 'unknown';
    let mysqlError = null;
    try {
      await db.query('SELECT 1 as test');
      mysqlStatus = 'connected';
    } catch (error) {
      mysqlStatus = 'error';
      mysqlError = error.message;
      logger.error('MySQL readiness check failed', { requestId: req.id, error: error.message });
    }
    const ok = mysqlStatus === 'connected';
    const httpStatus = ok ? 200 : 503;
    const body = { status: ok ? 'ok' : 'error', database: { mysql: mysqlStatus } };
    if (process.env.NODE_ENV !== 'production' && mysqlError) body.database.mysql_error = mysqlError;
    res.status(httpStatus).json(body);
  }));

  /**
   * Return 404 for non-existent sitemap/XML requests (before SPA fallback)
   * These are only relevant in production but defined here for clarity.
   */
  router.get(['/sitemap_index.xml', '/sitemap-index.xml', '/sitemaps.xml', '/sitemap1.xml', '/post-sitemap.xml'], (req, res) => {
    res.status(404).send('Not Found');
  });

  return router;
};
