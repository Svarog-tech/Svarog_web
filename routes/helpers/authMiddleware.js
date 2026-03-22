/**
 * Shared auth middleware for route modules.
 * These are re-exported from server.js at mount time via app.locals,
 * or can be required directly since server.js sets them on module.exports.
 *
 * This module lazily resolves the middleware from the running app context.
 * The actual middleware functions are defined in server.js and passed
 * through when the route factory is called.
 */

const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');

const authenticateUser = asyncHandler(async (req, res, next) => {
  // Webhook endpointy nepotrebuji autentizaci (maji vlastni validaci)
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
    const authService = require('../../services/authService');
    const user = await authService.getUserFromToken(token);

    if (!user) {
      logger.warn('Invalid or expired token', { requestId: req.id });
      throw new AppError('Invalid or expired token', 401);
    }

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

const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  try {
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

/**
 * CSRF guard for state-changing requests.
 * Re-checks the X-CSRF-Guard header on mutation endpoints.
 */
function requireCsrfGuard(req, res, next) {
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return next();
  }

  // Webhook endpointy maji vlastni validaci (IP whitelist)
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

module.exports = {
  authenticateUser,
  requireAdmin,
  requireCsrfGuard
};
