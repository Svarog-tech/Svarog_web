/**
 * Request ID tracking middleware
 * Přidá unikátní ID ke každému requestu pro lepší debugging
 */

let uuidv4;
try {
  uuidv4 = require('uuid').v4;
} catch (e) {
  // Fallback pokud uuid není nainstalováno
  uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}

/**
 * Middleware pro generování request ID
 */
const requestIdMiddleware = (req, res, next) => {
  // Zkus získat request ID z headeru (pokud přichází z proxy)
  req.id = req.headers['x-request-id'] || uuidv4();
  
  // Přidat do response headeru
  res.setHeader('X-Request-ID', req.id);
  
  next();
};

module.exports = requestIdMiddleware;
