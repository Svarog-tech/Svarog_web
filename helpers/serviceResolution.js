const path = require('path');
const { AppError } = require('../middleware/errorHandler');

/**
 * Factory for service resolution helpers.
 * @param {{ db: object, logger: object }} deps
 */
module.exports = function createServiceResolution({ db, logger }) {

  /**
   * SECURITY: Validace že ID parametr je kladné celé číslo
   * Zabraňuje SQL injection přes nevalidní ID (i přes prepared statements je to dobrá praxe)
   */
  function validateNumericId(id, paramName = 'id') {
    const num = parseInt(id, 10);
    if (isNaN(num) || num <= 0 || String(num) !== String(id)) {
      throw new AppError(`Invalid ${paramName}: must be a positive integer`, 400);
    }
    return num;
  }

  /**
   * Sanitizace cesty — ochrana proti path traversal
   */
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

  /**
   * Middleware: Najde službu, ověří vlastnictví, vrátí hestia_username
   */
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

  return { validateNumericId, sanitizeFilePath, resolveServiceForFiles };
};
