const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const dns = require('dns');
const { promisify } = require('util');
const crypto = require('crypto');
const fetch = require('node-fetch');

const dnsResolveNs = promisify(dns.resolveNs);

module.exports = function({ db, logger }) {
  const { asyncHandler, AppError } = require('../middleware/errorHandler');

  // Domain pricing (CZK/year)
  const DOMAIN_PRICES = {
    '.cz': '249 Kc', '.com': '299 Kc', '.eu': '199 Kc', '.sk': '349 Kc',
    '.net': '349 Kc', '.org': '349 Kc', '.info': '299 Kc', '.online': '149 Kc',
    '.store': '149 Kc', '.shop': '149 Kc'
  };

  // Wedos WAPI response codes
  const WAPI_AVAILABLE = 1000;
  const WAPI_REGISTERED = 3201;
  const WAPI_QUARANTINED = 3204;
  const WAPI_RESERVED = 3205;
  const WAPI_BLOCKED = 3206;

  /**
   * Generate Wedos WAPI auth hash
   * Formula: sha1(login + sha1(wapi_password) + current_hour_in_prague_tz)
   */
  function getWapiAuth() {
    const login = process.env.WEDOS_WAPI_LOGIN;
    const password = process.env.WEDOS_WAPI_PASSWORD;
    if (!login || !password) return null;

    // Get current hour in Europe/Prague timezone
    const pragueHour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Prague',
      hour: '2-digit',
      hour12: false,
    }).format(new Date());
    const hour = pragueHour.padStart(2, '0');

    const passwordHash = crypto.createHash('sha1').update(password).digest('hex');
    const authString = login + passwordHash + hour;
    return crypto.createHash('sha1').update(authString).digest('hex');
  }

  /**
   * Check domains via Wedos WAPI (supports batch up to 30 comma-separated)
   */
  async function checkDomainsWapi(domains) {
    const login = process.env.WEDOS_WAPI_LOGIN;
    const auth = getWapiAuth();
    if (!auth) return null; // WAPI not configured, fallback to DNS

    const requestData = {
      request: {
        user: login,
        auth: auth,
        command: 'domain-check',
        clTRID: `alatyr-${Date.now()}`,
        data: {
          name: domains.join(','),
        },
      },
    };

    try {
      const response = await fetch('https://api.wedos.com/wapi/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'request=' + encodeURIComponent(JSON.stringify(requestData)),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return null;

      const json = await response.json();
      const resp = json.response;

      if (!resp) return null;

      // Single domain response
      if (resp.data && resp.data.name && !Array.isArray(resp.data)) {
        const code = parseInt(resp.code);
        return [{
          domain: resp.data.name,
          available: code === WAPI_AVAILABLE,
          status: code === WAPI_AVAILABLE ? 'available' :
                  code === WAPI_QUARANTINED ? 'quarantined' :
                  code === WAPI_RESERVED ? 'reserved' :
                  code === WAPI_BLOCKED ? 'blocked' : 'registered',
        }];
      }

      // Multiple domains response - data contains array
      if (resp.data && Array.isArray(resp.data)) {
        return resp.data.map(item => ({
          domain: item.name,
          available: parseInt(item.code) === WAPI_AVAILABLE,
          status: parseInt(item.code) === WAPI_AVAILABLE ? 'available' :
                  parseInt(item.code) === WAPI_QUARANTINED ? 'quarantined' :
                  parseInt(item.code) === WAPI_RESERVED ? 'reserved' :
                  parseInt(item.code) === WAPI_BLOCKED ? 'blocked' : 'registered',
        }));
      }

      return null;
    } catch (err) {
      logger.warn('Wedos WAPI check failed, falling back to DNS', { error: err.message });
      return null;
    }
  }

  /**
   * DNS fallback check for a single domain
   */
  async function checkDomainDns(domain) {
    try {
      await dnsResolveNs(domain);
      return { domain, available: false };
    } catch (err) {
      if (err.code === 'ENOTFOUND' || err.code === 'ENODATA' || err.code === 'SERVFAIL') {
        return { domain, available: true };
      }
      return { domain, available: false, error: 'Nepodarilo se overit dostupnost' };
    }
  }

  // Domain check rate limiter
  const domainCheckLimiter = rateLimit({
    windowMs: 60000,
    max: 20,
    message: { success: false, error: 'Prilis mnoho pozadavku. Zkuste to za minutu.' }
  });

  /**
   * Check domain availability
   * POST /domains/check
   */
  router.post('/domains/check',
    domainCheckLimiter,
    asyncHandler(async (req, res) => {
      const { domains } = req.body;

      if (!domains || !Array.isArray(domains) || domains.length === 0) {
        return res.status(400).json({ success: false, error: 'Zadejte alespon jednu domenu.' });
      }

      if (domains.length > 15) {
        return res.status(400).json({ success: false, error: 'Maximalne 15 domen najednou.' });
      }

      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
      for (const d of domains) {
        if (!domainRegex.test(d)) {
          return res.status(400).json({ success: false, error: `Neplatny format domeny: ${d}` });
        }
      }

      // Try Wedos WAPI first (more accurate WHOIS), fall back to DNS
      let wapiResults = null;
      if (process.env.WEDOS_WAPI_LOGIN && process.env.WEDOS_WAPI_PASSWORD) {
        wapiResults = await checkDomainsWapi(domains);
      }

      const results = await Promise.all(domains.map(async (domain) => {
        const ext = '.' + domain.split('.').slice(1).join('.');
        const price = DOMAIN_PRICES[ext] || '399 Kc';

        // Use WAPI result if available
        if (wapiResults) {
          const wapiResult = wapiResults.find(r => r.domain === domain);
          if (wapiResult) {
            const statusText = wapiResult.status === 'quarantined' ? 'V karantene' :
                              wapiResult.status === 'reserved' ? 'Rezervovana' :
                              wapiResult.status === 'blocked' ? 'Blokovana' : undefined;
            return {
              domain,
              available: wapiResult.available,
              price,
              ...(statusText && { error: statusText }),
              source: 'wedos',
            };
          }
        }

        // DNS fallback
        const dnsResult = await checkDomainDns(domain);
        return { ...dnsResult, price, source: 'dns' };
      }));

      res.json({ success: true, results });
    })
  );

  return router;
};
