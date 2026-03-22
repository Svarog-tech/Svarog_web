const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const net = require('net');
const fetch = require('node-fetch');
const ipRangeCheck = require('ip-range-check');
const cron = require('node-cron');
require('dotenv').config();

// Utils a Middleware
const logger = require('./utils/logger');
const { AppError, errorHandler, asyncHandler, notFoundHandler } = require('./middleware/errorHandler');
const requestIdMiddleware = require('./middleware/requestId');
const {
  validateCreatePayment,
  validateCreateAccount,
  validateWebhook,
  validateUsername,
  validateCheckPayment
} = require('./middleware/validators');

// Payment Providers (Stripe + PayPal + GoPay)
const {
  StripeProvider,
  PayPalProvider,
  getPaymentProvider,
  activateOrderAfterPayment,
  stripe: stripeSDK
} = require('./services/paymentProviders');

// ============================================
// SECURITY: Environment Variables Validation
// ============================================
const requiredEnvVars = [];

// V produkci vyžadujeme kritické proměnné
if (process.env.NODE_ENV === 'production') {
  // MySQL (HestiaCP databáze) - povinné
  requiredEnvVars.push(
    'MYSQL_HOST',
    'MYSQL_USER',
    'MYSQL_PASSWORD',
    'MYSQL_DATABASE'
  );
  
  // JWT autentizace přes MySQL (authService.js) - povinné
  requiredEnvVars.push('JWT_SECRET');
  // REFRESH_TOKEN_SECRET nebo JWT_REFRESH_SECRET je také potřeba
  if (!process.env.REFRESH_TOKEN_SECRET && !process.env.JWT_REFRESH_SECRET) {
    requiredEnvVars.push('REFRESH_TOKEN_SECRET');
  }
}

const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  logger.error('❌ SECURITY ERROR: Chybí povinné environment variables:', { missing });
  console.error('❌ SECURITY ERROR: Chybí povinné environment variables:');
  missing.forEach(v => console.error(`   - ${v}`));
  console.error('');
  console.error('💡 Vytvořte .env soubor s těmito proměnnými.');
  process.exit(1);
}

// SECURITY: JWT_SECRET must be at least 32 characters
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be at least 32 characters');
  process.exit(1);
}

// SECURITY: V produkci zkontroluj HestiaCP konfiguraci a zaloguj varování pokud něco chybí
if (process.env.NODE_ENV === 'production') {
  const hestiaRequired = [
    'HESTIACP_URL',
    'HESTIACP_USERNAME',
    'HESTIACP_ACCESS_KEY',
    'HESTIACP_SECRET_KEY'
  ];
  const missingHestia = hestiaRequired.filter(v => !process.env[v]);
  if (missingHestia.length > 0) {
    logger.warn('HestiaCP integration is not fully configured (some env vars are missing). HestiaCP API features may be disabled.', {
      missingHestia
    });
  }
}

const hestiacp = require('./services/hestiacpService');

// MySQL Database Service (HestiaCP databáze)
const db = require('./services/databaseService');

// ============================================
// SECURITY: Audit logging helper
// ============================================
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

// === Route Modules ===
const createAuthRoutes = require('./routes/auth');
const createPaymentRoutes = require('./routes/payments');
const createOrderRoutes = require('./routes/orders');
const createBillingRoutes = require('./routes/billing');
const createHostingRoutes = require('./routes/hosting');
const createAdminRoutes = require('./routes/admin');
const createUserRoutes = require('./routes/users');
const createTicketRoutes = require('./routes/tickets');
const createDomainRoutes = require('./routes/domains');
const createPromoRoutes = require('./routes/promo');
const createCreditRoutes = require('./routes/credits');
const createAnalyticsRoutes = require('./routes/analytics');
const createMiscRoutes = require('./routes/misc');
const createTaxRoutes = require('./routes/tax');
const createEmailTemplateRoutes = require('./routes/emailTemplates');
const createKBRoutes = require('./routes/knowledgeBase');
const createAffiliateRoutes = require('./routes/affiliate');
const createGdprRoutes = require('./routes/gdpr');
const createStatusRoutes = require('./routes/status');

// TemplateService for DB-backed email templates
const TemplateService = require('./services/templateService');

// Autentizace přes MySQL (authService.js) - používá JWT tokeny
// Žádný Supabase není potřeba

const app = express();
const PORT = process.env.PORT || 3001;

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

// SECURITY: Trust proxy – nutné za Nginx reverse proxy
// Bez toho req.ip vrací 127.0.0.1 a rate limiting/IP logging nefunguje
app.set('trust proxy', 1);

// ============================================
// SECURITY: Helmet.js - Security Headers
// ============================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://checkout.stripe.com", "https://api.stripe.com", "https://www.paypal.com", "https://www.sandbox.paypal.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "data:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// ============================================
// PERFORMANCE: Gzip/Brotli Compression
// ============================================
app.use(compression({
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// ============================================
// SECURITY: Rate Limiting
// ============================================
// Obecný rate limiter pro všechny requesty
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 300, // max 300 requestů za 15 minut (SPA potřebuje více – listing, detail, stats...)
  message: 'Příliš mnoho requestů z této IP, zkuste to později.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Přísnější limiter pro autentizaci
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 5, // max 5 pokusů o přihlášení/registraci
  message: 'Příliš mnoho pokusů o přihlášení, zkuste to za 15 minut.',
  skipSuccessfulRequests: true, // Nezapočítá úspěšné pokusy
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter pro citlivé operace (MFA, změna hesla)
const sensitiveOpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Příliš mnoho pokusů, zkuste to za 15 minut.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);

// ============================================
// Request ID Middleware (musí být brzy)
// ============================================
app.use(requestIdMiddleware);

// ============================================
// SECURITY: CORS Configuration
// ============================================
// CORS - podporuje více origins z .env
const allowedOrigins = process.env.SERVER_ALLOWED_ORIGINS
  ? process.env.SERVER_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // Requests without Origin: same-origin, server-to-server proxies (nginx), Vite proxy
    // CSRF protection is handled by X-CSRF-Guard header on mutation endpoints
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ============================================
// SECURITY: Request Body Size Limit
// ============================================
// STRIPE: Raw body parser MUST come before express.json() for webhook signature verification
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' })); // SECURITY: Default 1MB limit (DoS prevention)
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// SECURITY: Helper pro nastavení httpOnly refresh token cookie
const REFRESH_COOKIE_NAME = 'refresh_token';
function setRefreshTokenCookie(res, token, maxAgeMs) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: maxAgeMs || 7 * 24 * 60 * 60 * 1000, // 7 dní default
  });
}
function clearRefreshTokenCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
  });
}

// SECURITY: Globální CSRF guard pro všechny state-changing requesty
// Prohlížeč neumí přidat custom header přes cross-site form submit ani <img>/<form> tag
// Výjimky: webhooky (mají vlastní validaci přes IP whitelist) a health check
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
  if (csrfHeader !== '1') {
    return next(new AppError('Invalid CSRF protection header', 403));
  }

  next();
}

// SECURITY: Aplikuj CSRF guard globálně na /api/ endpointy
app.use('/api/', requireCsrfGuard);

// ============================================
// SECURITY: Autentizace middleware
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
    const authService = require('./services/authService');
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

// GoPay konfigurace z .env
const GOPAY_API_URL = process.env.GOPAY_ENVIRONMENT === 'PRODUCTION'
  ? 'https://gate.gopay.cz/api'
  : 'https://gw.sandbox.gopay.com/api';

const GOPAY_CLIENT_ID = process.env.GOPAY_CLIENT_ID;
const GOPAY_CLIENT_SECRET = process.env.GOPAY_CLIENT_SECRET;
const GOPAY_GO_ID = process.env.GOPAY_GO_ID;

/**
 * SECURITY: Fetch s timeoutem - zabraňuje visícím requestům při nedostupnosti externích API
 */
/**
 * Retry wrapper pro async funkce s exponential backoff
 */
async function withRetry(fn, { retries = 2, delayMs = 3000, label = 'operation' } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw error;
      const wait = delayMs * Math.pow(2, attempt);
      logger.warn(`${label} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${wait}ms`, {
        error: error.message
      });
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AppError(`Request timeout po ${timeoutMs / 1000}s: ${url}`, 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Získání OAuth access tokenu
 */
async function getAccessToken() {
  const credentials = Buffer.from(`${GOPAY_CLIENT_ID}:${GOPAY_CLIENT_SECRET}`).toString('base64');

  const res = await fetchWithTimeout(`${GOPAY_API_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: 'grant_type=client_credentials&scope=payment-all'
  });

  if (!res.ok) {
    const errorText = await res.text();
    logger.error('GoPay OAuth error', { error: errorText, status: res.status });
    throw new AppError(`Failed to get access token: ${res.statusText}`, 500);
  }

  const data = await res.json();
  return data.access_token;
}

// ============================================
// Mount Route Modules
// ============================================
// These modular routes take priority (Express first-match wins).
// Legacy inline routes below serve as fallback during migration.

// Initialize TemplateService and wire it into emailService
const templateService = new TemplateService(db);
const { setTemplateService: _setTemplateService } = require('./services/emailService');
_setTemplateService(templateService);

// Dependencies needed by route modules but defined later in legacy code
const { sendPaymentConfirmationEmail: _sendPaymentConfirmationEmail, sendServiceActivatedEmail: _sendServiceActivatedEmail } = require('./services/emailService');
const { parsePagination: _parsePagination, paginationMeta: _paginationMeta } = require('./helpers/pagination');

function _validateNumericId(id, paramName = 'id') {
  const num = parseInt(id, 10);
  if (isNaN(num) || num <= 0) {
    throw new AppError(`Invalid ${paramName}`, 400);
  }
  return num;
}

// Auth routes
app.use('/api/auth', createAuthRoutes({
  db, logger, hestiacp,
  authLimiter, sensitiveOpLimiter, authenticateUser, requireCsrfGuard,
  setRefreshTokenCookie, clearRefreshTokenCookie, REFRESH_COOKIE_NAME
}));

// Payment routes
app.use('/api', createPaymentRoutes({
  db, logger, hestiacp,
  stripeSDK: stripeSDK || null,
  activateOrderAfterPayment: activateOrderAfterPayment || null,
  getPaymentProvider: getPaymentProvider || null,
  StripeProvider: StripeProvider || null,
  PayPalProvider: PayPalProvider || null,
  withRetry, fetchWithTimeout,
  sendServiceActivatedEmail: _sendServiceActivatedEmail,
  sendPaymentConfirmationEmail: _sendPaymentConfirmationEmail,
  authenticateUser, requireAdmin,
  auditLog
}));

// Order routes
app.use('/api', createOrderRoutes({ db, logger, hestiacp, authenticateUser }));

// Billing routes
app.use('/api/billing', createBillingRoutes({ db, logger, stripeSDK: stripeSDK || null, authenticateUser }));

// Hosting routes
app.use('/api', createHostingRoutes({ db, logger, hestiacp, authenticateUser, requireAdmin }));

// Admin routes
app.use('/api', createAdminRoutes({ db, logger, hestiacp, authenticateUser, requireAdmin }));

// User routes
app.use('/api', createUserRoutes({
  db, logger, auditLog, authenticateUser, requireAdmin,
  parsePagination: _parsePagination, paginationMeta: _paginationMeta
}));

// Ticket routes
app.use('/api/tickets', createTicketRoutes({
  db, logger, authenticateUser,
  parsePagination: _parsePagination, paginationMeta: _paginationMeta,
  validateNumericId: _validateNumericId
}));

// Domain routes
app.use('/api', createDomainRoutes({ db, logger }));

// Promo code routes
app.use('/api', createPromoRoutes({ db, logger, authenticateUser, requireAdmin }));

// Credit routes
app.use('/api', createCreditRoutes({ db, logger, authenticateUser, requireAdmin, auditLog }));

// Analytics routes
app.use('/api', createAnalyticsRoutes({ db, logger, authenticateUser, requireAdmin }));

// Tax / VAT routes
app.use('/api', createTaxRoutes({ db, logger, authenticateUser, requireAdmin }));

// Email template routes (admin)
app.use('/api', createEmailTemplateRoutes({ db, logger, authenticateUser, requireAdmin, templateService }));

// Knowledge Base routes
app.use('/api', createKBRoutes({ db, logger, authenticateUser, requireAdmin }));

// Affiliate routes
app.use('/api', createAffiliateRoutes({ db, logger, authenticateUser, requireAdmin, auditLog }));

// GDPR routes (data export + account deletion)
app.use('/api', createGdprRoutes({ db, logger, hestiacp, authenticateUser }));

// Status page routes (public + admin)
app.use('/api', createStatusRoutes({ db, logger, hestiacp, authenticateUser, requireAdmin }));

// Referral redirect (before SPA fallback)
app.get('/ref/:code', (req, res) => {
  const code = req.params.code.replace(/[^a-zA-Z0-9]/g, '');
  if (code) {
    res.cookie('affiliate_ref', code, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax' });
  }
  res.redirect('/');
});

// Misc routes (health, sitemaps — no /api prefix)
app.use('/', createMiscRoutes({ db, hestiacp }));

// ============================================
// Imports needed by startup code / cron jobs
// (were previously embedded in legacy inline routes)
// ============================================
const { sendServiceExpiringEmail } = require('./services/emailService');
const { initializeDiscordBot, getDiscordBot } = require('./services/discordTicketBot');

/**
 * Discord Bot Test Endpoint (development only)
 * POST /api/discord/test - Creates a test ticket channel
 */
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/discord/test', asyncHandler(async (req, res) => {
    const discordBot = getDiscordBot();

    if (!discordBot || !discordBot.isReady) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot is not ready or not configured'
      });
    }

    const testTicket = {
      ticketId: Date.now(),
      subject: req.body.subject || 'Test Ticket',
      category: req.body.category || 'general',
      priority: req.body.priority || 'medium',
      email: req.body.email || 'test@example.com',
      message: req.body.message || 'This is a test ticket message from the API.'
    };

    const channelId = await discordBot.createTicketChannel(testTicket);

    if (channelId) {
      res.json({
        success: true,
        message: 'Test ticket channel created',
        channelId,
        ticketId: testTicket.ticketId
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create ticket channel'
      });
    }
  }));

  app.get('/api/discord/status', (req, res) => {
    const discordBot = getDiscordBot();
    res.json({
      configured: !!discordBot,
      ready: discordBot?.isReady || false,
      guildId: process.env.DISCORD_GUILD_ID || null,
      categoryId: process.env.DISCORD_TICKET_CATEGORY_ID || null,
      ticketRoleId: process.env.DISCORD_TICKET_ROLE_ID || null
    });
  });

  /**
   * Public ticket endpoint for testing (development only)
   * POST /api/tickets/public - Creates a ticket without auth, just Discord channel
   */
  app.post('/api/tickets/public', asyncHandler(async (req, res) => {
    const { subject, message, priority, category, email, name } = req.body;

    // Validation
    if (!subject?.trim() || !message?.trim()) {
      throw new AppError('Subject and message are required', 400);
    }

    const discordBot = getDiscordBot();
    if (!discordBot || !discordBot.isReady) {
      throw new AppError('Discord bot is not ready', 503);
    }

    const ticketId = Date.now();
    const ticketData = {
      ticketId,
      userId: 0,
      name: name?.trim() || 'Test User',
      email: email?.trim() || 'test@example.com',
      subject: subject.trim(),
      message: message.trim(),
      priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
      category: ['general', 'technical', 'billing', 'domain', 'hosting'].includes(category) ? category : 'general',
      status: 'open'
    };

    const channelId = await discordBot.createTicketChannel(ticketData);

    if (channelId) {
      logger.info(`[DEV] Public ticket #${ticketId} created`, { ticketId, channelId });
      res.json({
        success: true,
        ticketId,
        channelId,
        message: 'Ticket created (development mode - Discord only)'
      });
    } else {
      throw new AppError('Failed to create Discord channel', 500);
    }
  }));
}

// ============================================
// Serve React Build (Production)
// MUST BE LAST - after all API routes
// ============================================
if (process.env.NODE_ENV === 'production') {
  // PERFORMANCE: Serve static files with long cache (hashed filenames from Vite)
  app.use(express.static(path.join(__dirname, 'build'), {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
      // index.html must not be cached (SPA routing)
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));

  // Serve llms.txt for LLM discoverability
  app.get('/llms.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(__dirname, 'public', 'llms.txt'));
  });

  // Return 404 for non-existent sitemap/XML requests (before SPA fallback)
  app.get(['/sitemap_index.xml', '/sitemap-index.xml', '/sitemaps.xml', '/sitemap1.xml', '/post-sitemap.xml'], (req, res) => {
    res.status(404).send('Not Found');
  });

  // Handle React routing - return all requests to React app
  // (API routes are handled above, so they won't reach here)
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// ============================================
// CRON JOBS - Scheduled tasks
// ============================================
if (process.env.ENABLE_CRON !== 'false') {
  try {
    const cron = require('node-cron');

    // Every hour: collect service statistics from HestiaCP
    cron.schedule('0 * * * *', async () => {
      logger.info('[CRON] Collecting service statistics...');
      try {
        const services = await db.query(
          `SELECT id, hestia_username, disk_space, bandwidth, plan_name
           FROM user_hosting_services
           WHERE status = 'active' AND hestia_created = 1 AND hestia_username IS NOT NULL`
        );

        let statsCollected = 0;
        let alertsCreated = 0;

        for (const service of services) {
          try {
            const [statsResult, userResult] = await Promise.all([
              hestiacp.getUserStats(service.hestia_username),
              hestiacp.getUserInfo(service.hestia_username)
            ]);

            if (!statsResult.success) continue;

            const diskUsedMb = statsResult.stats.disk_used_mb || 0;
            const bandwidthUsedMb = statsResult.stats.bandwidth_used_mb || 0;
            const diskLimitMb = userResult.success ? userResult.user.disk_quota_mb : (service.disk_space ? service.disk_space * 1024 : 0);
            const bandwidthLimitMb = userResult.success ? userResult.user.bandwidth_limit_mb : (service.bandwidth ? service.bandwidth * 1024 : 0);

            await db.execute(
              `INSERT INTO service_statistics (service_id, disk_used_mb, bandwidth_used_mb, recorded_at)
               VALUES (?, ?, ?, NOW())`,
              [service.id, diskUsedMb, bandwidthUsedMb]
            );
            statsCollected++;

            // Check disk thresholds
            if (diskLimitMb > 0) {
              const diskPercent = (diskUsedMb / diskLimitMb) * 100;
              if (diskPercent > 95) {
                const existing = await db.queryOne(
                  `SELECT id FROM service_alerts WHERE service_id = ? AND alert_type = 'disk_limit' AND severity = 'critical' AND acknowledged = 0`,
                  [service.id]
                );
                if (!existing) {
                  await db.execute(
                    `INSERT INTO service_alerts (service_id, alert_type, severity, threshold_value, current_value, created_at) VALUES (?, 'disk_limit', 'critical', 95, ?, NOW())`,
                    [service.id, diskPercent]
                  );
                  alertsCreated++;
                }
              } else if (diskPercent > 80) {
                const existing = await db.queryOne(
                  `SELECT id FROM service_alerts WHERE service_id = ? AND alert_type = 'disk_limit' AND severity = 'warning' AND acknowledged = 0`,
                  [service.id]
                );
                if (!existing) {
                  await db.execute(
                    `INSERT INTO service_alerts (service_id, alert_type, severity, threshold_value, current_value, created_at) VALUES (?, 'disk_limit', 'warning', 80, ?, NOW())`,
                    [service.id, diskPercent]
                  );
                  alertsCreated++;
                }
              }
            }

            // Check bandwidth thresholds
            if (bandwidthLimitMb > 0) {
              const bwPercent = (bandwidthUsedMb / bandwidthLimitMb) * 100;
              if (bwPercent > 95) {
                const existing = await db.queryOne(
                  `SELECT id FROM service_alerts WHERE service_id = ? AND alert_type = 'bandwidth_limit' AND severity = 'critical' AND acknowledged = 0`,
                  [service.id]
                );
                if (!existing) {
                  await db.execute(
                    `INSERT INTO service_alerts (service_id, alert_type, severity, threshold_value, current_value, created_at) VALUES (?, 'bandwidth_limit', 'critical', 95, ?, NOW())`,
                    [service.id, bwPercent]
                  );
                  alertsCreated++;
                }
              } else if (bwPercent > 80) {
                const existing = await db.queryOne(
                  `SELECT id FROM service_alerts WHERE service_id = ? AND alert_type = 'bandwidth_limit' AND severity = 'warning' AND acknowledged = 0`,
                  [service.id]
                );
                if (!existing) {
                  await db.execute(
                    `INSERT INTO service_alerts (service_id, alert_type, severity, threshold_value, current_value, created_at) VALUES (?, 'bandwidth_limit', 'warning', 80, ?, NOW())`,
                    [service.id, bwPercent]
                  );
                  alertsCreated++;
                }
              }
            }
          } catch (err) {
            logger.error(`[CRON] Failed to collect stats for service ${service.id}`, { error: err.message });
          }
        }

        logger.info('[CRON] Stats collection complete', { statsCollected, alertsCreated, servicesChecked: services.length });
      } catch (err) {
        logger.error('[CRON] Stats collection failed', { error: err.message });
      }
    });

    // Every day at 6:00 AM: check for expiring services, auto-suspend expired unpaid services
    cron.schedule('0 6 * * *', async () => {
      logger.info('[CRON] Running daily service check...');
      try {
        // 1. Auto-suspend expired services without auto-renewal
        const expiredServices = await db.query(
          `SELECT h.*, p.email AS user_email
           FROM user_hosting_services h
           LEFT JOIN profiles p ON p.id = h.user_id
           WHERE h.status = 'active'
             AND h.expires_at < NOW()
             AND h.auto_renewal = 0`
        );

        let suspendedCount = 0;
        for (const service of expiredServices) {
          try {
            // Suspend in HestiaCP if account exists
            if (service.hestia_username && service.hestia_created) {
              const result = await hestiacp.suspendUser(service.hestia_username);
              if (!result.success) {
                logger.error('[CRON] Failed to suspend HestiaCP account', { username: service.hestia_username, error: result.error });
              }
            }

            // Update service status to suspended
            await db.execute(
              `UPDATE user_hosting_services SET status = 'suspended', updated_at = NOW() WHERE id = ?`,
              [service.id]
            );
            suspendedCount++;

            logger.info('[CRON] Service auto-suspended', { serviceId: service.id, username: service.hestia_username });
          } catch (err) {
            logger.error('[CRON] Failed to suspend service', { serviceId: service.id, error: err.message });
          }
        }

        // 2. Send expiration reminder emails (7 days, 3 days, 1 day)
        const reminderIntervals = [
          { days: 7, label: '7 days' },
          { days: 3, label: '3 days' },
          { days: 1, label: '1 day' },
        ];

        let remindersCount = 0;
        for (const interval of reminderIntervals) {
          const expiringServices = await db.query(
            `SELECT h.*, p.email AS user_email
             FROM user_hosting_services h
             JOIN profiles p ON p.id = h.user_id
             WHERE h.auto_renewal = 0
               AND h.status = 'active'
               AND h.expires_at IS NOT NULL
               AND h.expires_at > NOW()
               AND h.expires_at <= DATE_ADD(NOW(), INTERVAL ? DAY)
               AND h.expires_at > DATE_ADD(NOW(), INTERVAL ? DAY)`,
            [interval.days, interval.days - 1]
          );

          for (const svc of expiringServices) {
            if (svc.user_email) {
              sendServiceExpiringEmail(
                svc.user_email,
                svc.plan_name || 'Hosting',
                svc.hestia_domain,
                svc.expires_at
              ).catch(err => logger.error('[CRON] Expiring email failed', { error: err.message, serviceId: svc.id }));
              remindersCount++;
            }
          }
        }

        logger.info('[CRON] Daily check complete', { suspendedCount, remindersCount });
      } catch (err) {
        logger.error('[CRON] Daily check failed', { error: err.message });
      }
    });

    // Every day at 2:00 AM: auto-renew services with auto_renewal=1
    cron.schedule('0 2 * * *', async () => {
      logger.info('[CRON] Running auto-renewal...');
      try {
        const servicesToRenew = await db.query(
          `SELECT h.*
           FROM user_hosting_services h
           WHERE h.auto_renewal = 1
             AND h.status = 'active'
             AND h.expires_at IS NOT NULL
             AND h.expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)
             AND (h.last_renewed_at IS NULL OR h.last_renewed_at < h.expires_at)`
        );

        let renewedCount = 0;
        for (const service of servicesToRenew) {
          try {
            const lastOrder = await db.queryOne(
              'SELECT * FROM user_orders WHERE id = ?',
              [service.order_id]
            );
            if (!lastOrder) continue;

            const insertResult = await db.execute(
              `INSERT INTO user_orders (
                 user_id, plan_id, plan_name, price, currency,
                 billing_email, billing_name, billing_company, billing_address, billing_phone,
                 customer_email, customer_name,
                 status, payment_status,
                 domain_name
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?)`,
              [
                service.user_id,
                lastOrder.plan_id,
                lastOrder.plan_name,
                lastOrder.price,
                lastOrder.currency || 'CZK',
                lastOrder.billing_email || null,
                lastOrder.billing_name || null,
                lastOrder.billing_company || null,
                lastOrder.billing_address || null,
                lastOrder.billing_phone || null,
                lastOrder.customer_email || null,
                lastOrder.customer_name || null,
                lastOrder.domain_name || null,
              ]
            );

            await db.execute(
              `UPDATE user_hosting_services SET last_renewed_at = NOW(), updated_at = NOW() WHERE id = ?`,
              [service.id]
            );
            renewedCount++;
          } catch (err) {
            logger.error('[CRON] Failed to renew service', { serviceId: service.id, error: err.message });
          }
        }

        logger.info('[CRON] Auto-renewal complete', { renewedCount, checked: servicesToRenew.length });
      } catch (err) {
        logger.error('[CRON] Auto-renewal failed', { error: err.message });
      }
    });

    // Every day at 3:00 AM: cleanup old stats (>90 days) and acknowledged alerts (>30 days)
    cron.schedule('0 3 * * *', async () => {
      logger.info('[CRON] Cleaning old statistics...');
      try {
        await db.execute('DELETE FROM service_statistics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 90 DAY)');
        await db.execute('DELETE FROM service_alerts WHERE acknowledged = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');
        logger.info('[CRON] Cleanup complete');
      } catch (err) {
        logger.error('[CRON] Cleanup failed', { error: err.message });
      }
    });

    logger.info('[CRON] Scheduled jobs initialized');
  } catch (err) {
    // node-cron not installed - skip cron jobs gracefully
    logger.warn('[CRON] node-cron not available, scheduled jobs disabled. Install with: npm install node-cron', { error: err.message });
  }
}

// ============================================
// Error Handler (MUST BE LAST)
// ============================================
app.use(notFoundHandler); // 404 handler
app.use(errorHandler); // Global error handler

const server = app.listen(PORT, async () => {
  console.log('================================================');
  console.log('  GoPay & HestiaCP Proxy Server');
  console.log('================================================');

  // Test MySQL připojení
  let mysqlStatus = '❌ Not connected';
  let mysqlConnected = false;
  try {
    await db.query('SELECT 1 as test');
    mysqlStatus = '✅ Connected';
    mysqlConnected = true;
    logger.info('MySQL connection successful');
    // NOTE: Cleanup expired refresh tokenů probíhá v authService.js (setInterval + setTimeout)
  } catch (error) {
    logger.error('MySQL connection failed', { error: error.message });
    console.error('❌ MySQL connection failed:', error.message);
  }

  // Initialize Discord Ticket Bot (works with or without MySQL)
  try {
    const discordBot = await initializeDiscordBot(mysqlConnected ? db : null);
    if (discordBot) {
      logger.info('Discord Ticket Bot initialized successfully');
      console.log('  Discord Bot: ✅ Connected');
    } else {
      logger.warn('Discord Ticket Bot not initialized (missing configuration or credentials)');
      console.log('  Discord Bot: ⚠️ Not configured');
    }
  } catch (discordError) {
    logger.error('Failed to initialize Discord Bot', { error: discordError.message });
    console.log('  Discord Bot: ❌ Failed to connect');
  }

  logger.info('Server starting', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    mysqlStatus
  });

  console.log(`Server běží na: http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`GoPay Environment: ${process.env.GOPAY_ENVIRONMENT || 'SANDBOX'}`);
  console.log(`GoID: ${GOPAY_GO_ID}`);
  console.log(`Allowed Origins: ${allowedOrigins.join(', ')}`);
  console.log('================================================');
  console.log('');
  console.log('Database:');
  console.log(`  MySQL (HestiaCP): ${mysqlStatus}`);
  console.log(`  MySQL Host: ${process.env.MYSQL_HOST || 'not configured'}`);
  console.log(`  MySQL Database: ${process.env.MYSQL_DATABASE || 'not configured'}`);
  console.log(`  JWT Auth: ${process.env.JWT_SECRET ? '✅ Configured' : '❌ Not configured'}`);
  console.log('');
  console.log('GoPay Endpoints:');
  console.log(`  POST /api/gopay/create-payment`);
  console.log(`  POST /api/gopay/check-payment`);
  console.log(`  POST /api/gopay/webhook`);
  console.log('');
  console.log('HestiaCP Endpoints:');
  console.log(`  POST /api/hestiacp/create-account`);
  console.log(`  POST /api/hestiacp/suspend-account`);
  console.log(`  POST /api/hestiacp/unsuspend-account`);
  console.log(`  POST /api/hestiacp/delete-account`);
  console.log('');
  console.log('Other:');
  console.log(`  GET  /health`);
  console.log(`  GET  /health/live`);
  console.log(`  GET  /health/ready`);
  console.log('');
  console.log('HestiaCP Status:', process.env.HESTIACP_URL ? '✅ Configured' : '❌ Not configured');
  console.log('================================================');
});

// ============================================
// Graceful Shutdown
// ============================================
function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await db.getPool().end();
      logger.info('Database pool drained');
    } catch (err) {
      logger.error('Error draining DB pool', { error: err.message });
    }
    process.exit(0);
  });

  // Force exit after 30s if connections don't close
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
