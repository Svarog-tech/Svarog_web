/**
 * Request ID tracking middleware
 * Přidá unikátní ID ke každému requestu pro lepší debugging
 */

const crypto = require('crypto');

// SECURITY: Kryptograficky bezpečná generace UUID
function generateSecureUUID() {
  return crypto.randomUUID();
}

// UUID formát validace
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Middleware pro generování request ID
 * SECURITY: Klientský X-Request-ID se validuje proti UUID formátu
 * aby se zabránilo log injection útokům
 */
const requestIdMiddleware = (req, res, next) => {
  const clientId = req.headers['x-request-id'];

  // Přijmi klientské ID pouze pokud je validní UUID (ochrana proti log injection)
  req.id = (clientId && UUID_REGEX.test(clientId)) ? clientId : generateSecureUUID();

  res.setHeader('X-Request-ID', req.id);

  next();
};

module.exports = requestIdMiddleware;
