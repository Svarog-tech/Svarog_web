// ============================================
// In-memory TTL cache for HestiaCP live data
// ============================================
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

function invalidateHestiaCache() {
  for (const key of hestiaCache.keys()) {
    if (key.startsWith('hestia:')) hestiaCache.delete(key);
  }
}

module.exports = { hestiaCache, getCached, setCache, invalidateHestiaCache };
