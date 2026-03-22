const { AppError, asyncHandler } = require('./errorHandler');

/**
 * Factory for authentication middleware.
 * @param {{ db: object, logger: object }} deps
 */
module.exports = function createAuthMiddleware({ db, logger }) {

  // ============================================
  // SECURITY: CSRF guard for state-changing requests
  // ============================================
  function requireCsrfGuard(req, res, next) {
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next();
    }

    // Webhook endpointy mají vlastní validaci (IP whitelist)
    if (req.path.includes('/webhook')) {
      return next();
    }

    // Discord and public test endpoints (development only)
    if (process.env.NODE_ENV !== 'production' && (req.path.startsWith('/discord/') || req.path === '/tickets/public')) {
      return next();
    }

    // Public domain availability check (read-only DNS lookup, rate-limited)
    if (req.path === '/domains/check') {
      return next();
    }

    const csrfHeader = req.get('X-CSRF-Guard');
    if (!csrfHeader) {
      return next(new AppError('Missing CSRF protection header', 403));
    }

    next();
  }

  // ============================================
  // SECURITY: JWT authentication middleware
  // ============================================

  /**
   * Middleware pro ověření JWT tokenu z authService (MySQL-based)
   * BUG FIX: Wrapped in asyncHandler to properly catch AppError and pass to error handler
   */
  const authenticateUser = asyncHandler(async (req, res, next) => {
    // Webhook endpointy nepotřebují autentizaci (mají vlastní validaci)
    if (req.path.includes('/webhook')) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid authorization header', { requestId: req.id, path: req.path });
      throw new AppError('Missing or invalid authorization header', 401);
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      // Vlastní JWT z authService (MySQL-based)
      const authService = require('../services/authService');
      const user = await authService.getUserFromToken(token);

      if (!user) {
        logger.warn('Invalid or expired token', { requestId: req.id });
        throw new AppError('Invalid or expired token', 401);
      }

      // Přidej uživatele do requestu ve formátu kompatibilním s frontendem
      req.user = {
        id: user.id,
        email: user.email,
        is_admin: !!(user.is_admin),
        user_metadata: {
          first_name: user.first_name,
          last_name: user.last_name
        },
        app_metadata: {
          provider: user.provider || 'email'
        },
        email_confirmed_at: user.email_verified ? new Date().toISOString() : null
      };

      next();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.errorRequest(req, error, { context: 'authentication' });
      throw new AppError('Authentication failed', 401);
    }
  });

  // ============================================
  // SECURITY: Admin authorization middleware
  // ============================================

  /**
   * Middleware pro ověření admin práv
   * BUG FIX: Wrapped in asyncHandler to properly catch AppError and pass to error handler
   */
  const requireAdmin = asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    try {
      // PERFORMANCE: Použij is_admin z req.user (nastavený v authenticateUser z DB)
      // Tím se eliminuje duplicitní DB dotaz
      if (!req.user.is_admin) {
        throw new AppError('Admin access required', 403);
      }

      req.isAdmin = true;
      next();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.errorRequest(req, error, { context: 'admin_check' });
      throw new AppError('Failed to verify admin status', 500);
    }
  });

  return { authenticateUser, requireAdmin, requireCsrfGuard };
};
