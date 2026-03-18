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

// Autentizace přes MySQL (authService.js) - používá JWT tokeny
// Žádný Supabase není potřeba

const app = express();
const PORT = process.env.PORT || 3001;

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
      connectSrc: ["'self'"],
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
  if (!csrfHeader) {
    return next(new AppError('Missing CSRF protection header', 403));
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

/**
 * Vytvoření platby v GoPay
 * SECURITY: Vyžaduje autentizaci
 */
app.post('/api/gopay/create-payment', 
  authenticateUser, 
  validateCreatePayment,
  asyncHandler(async (req, res) => {
    logger.request(req, 'Creating GoPay payment');
    const paymentData = req.body;

    const accessToken = await getAccessToken();

    // BUG FIX: customerName a customerEmail jsou volitelné - použij fallback z req.user
    // Zkontroluj, zda paymentData.customerName existuje, je string a není prázdný
    let customerName = (paymentData.customerName && 
                       typeof paymentData.customerName === 'string' && 
                       paymentData.customerName.trim()) 
      ? paymentData.customerName.trim()
      : null;
    
    // Pokud není v paymentData, zkus z req.user
    if (!customerName) {
      if (req.user?.user_metadata?.first_name && req.user?.user_metadata?.last_name) {
        const fullName = `${req.user.user_metadata.first_name} ${req.user.user_metadata.last_name}`.trim();
        if (fullName) {
          customerName = fullName;
        }
      }
      
      // Pokud stále není jméno, zkus z emailu (pouze pokud email obsahuje @)
      if (!customerName && req.user?.email && typeof req.user.email === 'string' && req.user.email.includes('@')) {
        customerName = req.user.email.split('@')[0];
      }
    }
    
    // Fallback na 'Customer' pokud stále není jméno
    customerName = (customerName && typeof customerName === 'string' && customerName.trim()) || 'Customer';
    
    // BUG FIX: customerEmail - zkontroluj, zda existuje, je string, není prázdný a obsahuje @
    let customerEmail = (paymentData.customerEmail && 
                        typeof paymentData.customerEmail === 'string' && 
                        paymentData.customerEmail.trim() &&
                        paymentData.customerEmail.includes('@'))
      ? paymentData.customerEmail.trim()
      : null;
    
    // Pokud není v paymentData, použij z req.user (pouze pokud je validní email)
    if (!customerEmail && req.user?.email && typeof req.user.email === 'string' && req.user.email.includes('@')) {
      customerEmail = req.user.email.trim();
    }
    
    // BUG FIX: Neposílat platbu do GoPay s prázdným emailem – API může odmítnout nebo špatně zpracovat.
    // Pokud po všech fallbackách nemáme platný email, vrátit 400 a vyžadovat ho od klienta.
    if (!customerEmail || typeof customerEmail !== 'string' || !customerEmail.trim() || !customerEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid customer email is required for payment. Please provide a valid email or ensure your profile has one.'
      });
    }
    customerEmail = customerEmail.trim();

    // BUG FIX: customerName je nyní vždy neprázdný string (minimálně 'Customer'), takže split je bezpečný
    const nameParts = customerName.split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || '';

    const payment = {
      payer: {
        default_payment_instrument: 'PAYMENT_CARD',
        allowed_payment_instruments: ['PAYMENT_CARD'],
        contact: {
          first_name: firstName,
          last_name: lastName,
          email: customerEmail
        }
      },
      target: {
        type: 'ACCOUNT',
        goid: parseInt(GOPAY_GO_ID)
      },
      amount: Math.round(paymentData.amount * 100),
      currency: paymentData.currency,
      order_number: paymentData.orderId.toString(),
      order_description: paymentData.description,
      items: [{
        name: paymentData.description,
        amount: Math.round(paymentData.amount * 100),
        count: 1
      }],
      callback: {
        return_url: paymentData.returnUrl,
        notification_url: paymentData.notifyUrl
      },
      lang: 'CS'
    };

    logger.debug('Sending payment request to GoPay', { 
      requestId: req.id,
      orderNumber: payment.order_number,
      amount: payment.amount 
    });

    const response = await fetchWithTimeout(`${GOPAY_API_URL}/payments/payment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payment)
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error('GoPay API error', {
        requestId: req.id,
        status: response.status,
        error: data 
      });
      // BUG FIX: AppError constructor expects (message, statusCode, isOperational)
      // gopayError musí být přidán jako vlastnost po vytvoření error objektu
      const error = new AppError('GoPay API error', response.status, true);
      error.gopayError = data;
      throw error;
    }

    logger.request(req, 'Payment created successfully', {
      paymentId: data.id,
      orderNumber: payment.order_number
    });

    res.json({
      success: true,
      paymentId: data.id.toString(),
      paymentUrl: data.gw_url,
      state: data.state
    });
  })
);

/**
 * GoPay Webhook endpoint pro notifikace o změně stavu platby
 * SECURITY: IP whitelisting, signature validation (pokud GoPay podporuje)
 * Webhook nepotřebuje autentizaci (má vlastní validaci)
 */
/**
 * Wrapper middleware pro webhook validaci
 * BUG FIX: Zachytí validační chyby a vždy vrátí 200 OK (aby GoPay neopakoval webhook)
 * BUG FIX: express-validator 7.x řetězce voláme přes .run(req); položka validate v poli nemá .run(),
 *          proto ji nepoužíváme – místo toho kontrolu výsledků děláme zde přes validationResult(req).
 *          Webhook input JE validován: řetězce naplní req, validationResult() je přečte a při chybách throw.
 */
const validateWebhookSafe = async (req, res, next) => {
  try {
    // Full validation coverage: run all chain validators (.run()); skip the final validate() in the array
    // (it has no .run()) and replace it with validationResult() check below – same outcome, no double next().
    for (const validator of validateWebhook) {
      if (typeof validator.run === 'function') {
        await validator.run(req);
      }
      // Položky bez .run() (např. validate) přeskočíme – nevoláme je, abychom nezpůsobili dvojí next()
    }

    // Položka validate v validateWebhook nemá .run(), proto ji nevoláme; výsledky kontrolujeme zde.
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      }));

      const error = new AppError('Validation failed', 400);
      error.validationErrors = errorMessages;
      throw error;
    }
    
    // Všechny validace prošly
    next();
  } catch (error) {
    // BUG FIX: Validační chyba - zaloguj a vrať 200 OK (aby GoPay neopakoval webhook)
    logger.warn('GoPay webhook validation failed', {
      requestId: req.id,
      error: error.message,
      validationErrors: error.validationErrors,
      body: req.body
    });
    
    // Vždy vraťme 200 OK, i když validace selhala
    return res.status(200).json({
      success: false,
      error: 'Webhook validation failed',
      message: error.message
    });
  }
};

/**
 * GoPay Webhook endpoint
 * BUG FIX: NENÍ zabalený v asyncHandler - musí vždy vrátit 200, aby GoPay neopakoval webhook
 * BUG FIX: validateWebhook middleware může vyhodit AppError - používáme validateWebhookSafe wrapper
 * Všechny chyby (včetně validačních) jsou zachyceny a vždy se vrátí 200 OK
 */
app.post('/api/gopay/webhook', 
  validateWebhookSafe,
  async (req, res, next) => {
    const handleWebhook = async (req, res) => {
      try {
    // SECURITY: IP whitelisting - povolit pouze GoPay IP adresy
    // BUG FIX: Safely extract IP address - check if req.connection exists before accessing properties
    // BUG FIX: Zkontroluj, zda výsledek není prázdný string (x-forwarded-for může být prázdný string)
    let clientIp = req.ip || 
      (req.connection && req.connection.remoteAddress) || 
      (req.socket && req.socket.remoteAddress) ||
      null;
    
    // Pokud stále není IP, zkus x-forwarded-for
    if (!clientIp && req.headers['x-forwarded-for']) {
      const forwardedIp = req.headers['x-forwarded-for'].split(',')[0].trim();
      // BUG FIX: Zkontroluj, zda není prázdný string
      if (forwardedIp) {
        clientIp = forwardedIp;
      }
    }
    
    const allowedGoPayIPs = [
      // GoPay produkční IP adresy (zkontrolujte v GoPay dokumentaci)
      '185.71.76.0/27',
      '185.71.77.0/27',
      // GoPay sandbox IP adresy
      '185.71.76.32/27'
    ];

    // V produkci kontrolovat IP whitelisting
    if (process.env.NODE_ENV === 'production') {
      // BUG FIX: Pokud IP není k dispozici, blokovat webhook (bezpečnější než povolit)
      // ipRangeCheck očekává validní IP adresu, ne 'unknown'
      if (!clientIp) {
        logger.warn('GoPay webhook blocked - IP address not available', {
          requestId: req.id,
          ip: 'unknown',
          path: req.path,
          headers: {
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'x-real-ip': req.headers['x-real-ip']
          }
        });
        // BUG FIX: Vždy vraťme 200, i když IP není k dispozici (aby GoPay neopakoval)
        return res.status(200).json({
          success: false,
          error: 'Forbidden'
        });
      }
      
      // BUG FIX: Použít net.isIP() pro správnou validaci IPv4 i IPv6 (struktura, segmenty, ::).
      // Původní regex /^[0-9a-fA-F:]+$/ byl příliš permisivní (::::::::, aaaaaaaa).
      const isValidIp = net.isIP(clientIp) !== 0;
      
      if (!isValidIp) {
        logger.warn('GoPay webhook blocked - invalid IP address format', {
          requestId: req.id,
          ip: clientIp,
          path: req.path
        });
        return res.status(200).json({
          success: false,
          error: 'Forbidden'
        });
      }
      
      const isAllowed = allowedGoPayIPs.some(range => 
        ipRangeCheck(clientIp, range)
      );
      
      if (!isAllowed) {
        logger.warn('GoPay webhook blocked - unauthorized IP', {
          requestId: req.id,
          ip: clientIp,
          path: req.path
        });
        // BUG FIX: Vždy vraťme 200, i když IP není povolená (aby GoPay neopakoval)
        return res.status(200).json({
          success: false,
          error: 'Forbidden'
        });
      }
    }
    
    // Fallback pro logging - použij 'unknown' pouze pro logování, ne pro IP check
    const clientIpForLogging = clientIp || 'unknown';

    logger.request(req, 'GoPay webhook received', {
      ip: clientIpForLogging,
      paymentId: req.body.id,
      state: req.body.state
    });

    const webhookData = req.body;

    const paymentId = webhookData.id.toString();
    const paymentState = webhookData.state;
    const orderNumber = webhookData.order_number;

    // SECURITY: Webhook idempotency — zabraní duplicitnímu zpracování
    try {
      await db.execute(
        'INSERT INTO webhook_events (payment_id, event_type) VALUES (?, ?)',
        [paymentId, paymentState]
      );
    } catch (dupError) {
      // Pokud tabulka neexistuje, pokračuj (zpětná kompatibilita)
      if (dupError.code === 'ER_DUP_ENTRY') {
        logger.info('GoPay webhook duplicate ignored', { paymentId, paymentState });
        return res.status(200).json({ success: true, message: 'Already processed' });
      }
      // ER_NO_SUCH_TABLE — tabulka ještě nebyla vytvořena, pokračuj normálně
      if (dupError.code !== 'ER_NO_SUCH_TABLE') {
        logger.warn('Webhook idempotency check failed', { error: dupError.message });
      }
    }

    // Najdi objednávku podle order_number nebo payment_id v MySQL (HestiaCP databáze)
    // BUG FIX: orderNumber z GoPay webhooku je ID objednávky (orderId), který jsme poslali jako order_number do GoPay
    // Při vytváření platby: order_number: paymentData.orderId.toString()
    // Takže orderNumber z webhooku = ID objednávky v databázi
    let order = null;
    if (orderNumber) {
      // BUG FIX: orderNumber z GoPay je vlastně ID objednávky (které jsme poslali jako order_number do GoPay)
      // Hledej podle id (orderNumber je ID objednávky) nebo payment_id
      const orderNumberAsId = parseInt(orderNumber);
      if (!isNaN(orderNumberAsId)) {
        order = await db.queryOne(
          'SELECT * FROM user_orders WHERE id = ? OR payment_id = ? LIMIT 1',
          [orderNumberAsId, paymentId]
        );
      } else {
        // Pokud orderNumber není číslo, hledej pouze podle payment_id
        order = await db.queryOne(
          'SELECT * FROM user_orders WHERE payment_id = ? LIMIT 1',
          [paymentId]
        );
      }
    } else {
      // Najdi podle payment_id
      order = await db.queryOne(
        'SELECT * FROM user_orders WHERE payment_id = ? LIMIT 1',
        [paymentId]
      );
    }

    if (!order) {
      logger.warn('GoPay webhook - order not found', {
        requestId: req.id,
        paymentId,
        orderNumber
      });
      // Vrátíme 200, aby GoPay neopakoval webhook
      return res.status(200).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Mapování GoPay stavů na naše stavy
    const stateMapping = {
      'CREATED': 'unpaid',
      'PAID': 'paid',
      'CANCELED': 'cancelled',
      'TIMEOUTED': 'timeout',
      'REFUNDED': 'refunded',
      'PARTIALLY_REFUNDED': 'partially_refunded'
    };

    const paymentStatus = stateMapping[paymentState] || 'unpaid';
    const isPaid = paymentState === 'PAID';

    // SECURITY: Aktualizace objednávky a vytvoření služby v jedné DB transakci
    let shouldCreateHestiaAccount = false;
    try {
      await db.transaction(async (connection) => {
        const updateFields = [
          'payment_status = ?',
          'gopay_status = ?',
          'payment_id = ?'
        ];
        const updateValues = [paymentStatus, paymentState, paymentId];

        if (isPaid) {
          updateFields.push('payment_date = NOW()');
          updateFields.push('status = ?');
          updateValues.push('active');

          // Vystav fakturu pokud ještě nemá číslo faktury
          if (!order.invoice_number) {
            updateFields.push('invoice_number = ?');
            updateFields.push('invoice_issued_at = NOW()');
            updateValues.push(`INV-${order.id}`);
          }
        }

        updateValues.push(order.id);

        const updateQuery = `
          UPDATE user_orders
          SET ${updateFields.join(', ')}
          WHERE id = ?
        `;

        await connection.execute(updateQuery, updateValues);

        logger.request(req, 'GoPay webhook - order updated', {
          orderId: order.id,
          paymentStatus,
          gopayStatus: paymentState
        });

        // Pokud je platba zaplacená, vytvoř hosting službu v rámci stejné transakce
        if (isPaid && order.payment_status !== 'paid') {
          logger.request(req, 'Payment confirmed, activating service', { orderId: order.id });

          const [existingRows] = await connection.execute(
            'SELECT * FROM user_hosting_services WHERE order_id = ?',
            [order.id]
          );
          const existingService = existingRows.length > 0 ? existingRows[0] : null;

          if (!existingService) {
            const [serviceResult] = await connection.execute(
              `INSERT INTO user_hosting_services
               (user_id, order_id, plan_name, plan_id, status, price, billing_period, activated_at, expires_at, next_billing_date)
               VALUES (?, ?, ?, ?, 'pending', ?, 'monthly', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY))`,
              [order.user_id, order.id, order.plan_name, order.plan_id, order.price]
            );

            logger.info('Hosting service created', {
              requestId: req.id,
              serviceId: serviceResult.insertId,
              orderId: order.id
            });

            shouldCreateHestiaAccount = true;
          }
        }
      }); // konec transakce

      // HestiaCP účet se vytváří MIMO transakci (asynchronně po commitu)
      // TODO: V produkci použít queue (Bull, RabbitMQ) místo setImmediate
      if (shouldCreateHestiaAccount) {
        setImmediate(async () => {
            try {
              const userProfile = await db.queryOne(
                'SELECT email, first_name, last_name FROM profiles WHERE id = ?',
                [order.user_id]
              );

              if (userProfile) {
                const userEmail = (userProfile.email && String(userProfile.email).trim()) || (order.billing_email && String(order.billing_email).trim()) || null;
                // Fallback username: z emailu, jinak user_{user_id} nebo order_{order_id}. HestiaCP: 8–32 znaků.
                const rawUsername = userEmail && userEmail.includes('@')
                  ? userEmail.split('@')[0]
                  : order.user_id
                    ? `user${String(order.user_id).replace(/-/g, '').substring(0, 8)}`
                    : `order${String(order.id).substring(0, 8)}`;
                const username = rawUsername.length > 32 ? rawUsername.substring(0, 32) : rawUsername;

                // HestiaCP vyžaduje platný email – bez něj nevolat API
                if (!userEmail || !userEmail.includes('@')) {
                  await db.execute(
                    `UPDATE user_hosting_services SET hestia_error = ?, hestia_created = FALSE WHERE order_id = ?`,
                    ['Missing or invalid email for HestiaCP account', order.id]
                  );
                  logger.warn('HestiaCP account skipped: missing/invalid email', {
                    requestId: req.id,
                    orderId: order.id
                  });
                } else {
                  const hestiaResult = await withRetry(
                    () => hestiacp.createHostingAccount({
                      email: userEmail,
                      domain: order.domain_name || `${order.id}.alatyr.cz`,
                      package: order.plan_id,
                      username: username
                    }),
                    { retries: 2, delayMs: 5000, label: `HestiaCP account creation (order ${order.id})` }
                  );

                if (hestiaResult.success) {
                  // Aktualizuj hosting službu s HestiaCP údaji
                  await db.execute(
                    `UPDATE user_hosting_services 
                     SET hestia_username = ?, hestia_domain = ?, hestia_package = ?, 
                         hestia_created = TRUE, hestia_created_at = NOW(), 
                         status = 'active', cpanel_url = ?
                     WHERE order_id = ?`,
                    [
                      hestiaResult.username,
                      hestiaResult.domain,
                      hestiaResult.package,
                      hestiaResult.cpanelUrl,
                      order.id
                    ]
                  );

                  // Aktualizuj profil uživatele
                  await db.execute(
                    `UPDATE profiles 
                     SET hestia_username = ?, hestia_package = ?, hestia_created = TRUE, hestia_created_at = NOW()
                     WHERE id = ?`,
                    [hestiaResult.username, hestiaResult.package, order.user_id]
                  );

                  logger.info('HestiaCP account created successfully', {
                    requestId: req.id,
                    orderId: order.id,
                    username: hestiaResult.username
                  });

                  // Notifikace o aktivaci služby
                  if (userEmail) {
                    const svc = await db.queryOne(
                      'SELECT plan_name, hestia_domain, expires_at FROM user_hosting_services WHERE order_id = ?',
                      [order.id]
                    );
                    sendServiceActivatedEmail(
                      userEmail,
                      svc?.plan_name || order.plan_name || 'Hosting',
                      svc?.hestia_domain || order.domain_name,
                      svc?.expires_at
                    ).catch(err => logger.error('Service activated email failed', { error: err.message }));
                  }
                } else {
                  // Ulož chybu do databáze
                  await db.execute(
                    `UPDATE user_hosting_services 
                     SET hestia_error = ?, hestia_created = FALSE
                     WHERE order_id = ?`,
                    [hestiaResult.error || 'Unknown error', order.id]
                  );
                  logger.error('HestiaCP account creation failed', {
                    requestId: req.id,
                    orderId: order.id,
                    error: hestiaResult.error
                  });
                }
                }
              }
            } catch (error) {
              logger.errorRequest(req, error, { context: 'webhook_hestiacp_creation' });
            }
          });
        }
    } catch (webhookError) {
      logger.errorRequest(req, webhookError, { context: 'webhook_transaction' });
    }

    // SECURITY: Idempotency - vždy vraťme 200, aby GoPay neopakoval webhook
    // BUG FIX: Všechny chyby jsou zachyceny výše, takže vždy dojdeme sem a vrátíme 200
    res.status(200).json({
      success: true,
      message: 'Webhook processed'
    });
      } catch (error) {
        // BUG FIX: Catch všechny neočekávané chyby a vždy vraťme 200
        logger.errorRequest(req, error, { context: 'webhook_unexpected_error' });
        res.status(200).json({
          success: false,
          error: 'Webhook processing error (logged)'
        });
      }

      // Po úspěšném zpracování webhooku a případném vystavení faktury pošli potvrzovací email (best-effort)
      if (isPaid && order.payment_status !== 'paid') {
        try {
          const profile = await db.queryOne(
            'SELECT email FROM profiles WHERE id = ?',
            [order.user_id]
          );
          const toEmail = profile?.email || order.billing_email || order.customer_email;
          if (toEmail) {
            const appUrl = process.env.APP_URL || 'http://localhost:3000';
            const invoiceUrl = `${appUrl.replace(/\/+$/, '')}/api/orders/${order.id}/invoice`;
            const amount = Number(order.price) || 0;
            const currency = order.currency || 'CZK';
            await sendPaymentConfirmationEmail(
              toEmail,
              invoiceUrl,
              amount.toLocaleString('cs-CZ', { style: 'currency', currency }),
              currency,
              order.id
            );
          }
        } catch (emailError) {
          logger.error('Failed to send payment confirmation email', {
            requestId: req.id,
            error: emailError.message || emailError,
            orderId: order.id,
          });
        }
      }
    };
    try {
      await handleWebhook(req, res);
    } catch (err) {
      logger.errorRequest(req, err, { context: 'webhook_handler_rejection' });
      if (!res.headersSent) {
        res.status(200).json({ success: false, error: 'Webhook processing error (logged)' });
      }
    }
  });

/**
 * Kontrola statusu platby
 * SECURITY:
 *  - Vyžaduje autentizaci
 *  - Uživatel může zkontrolovat pouze platby svých objednávek
 *  - Admin může zkontrolovat libovolnou platbu
 */
app.post('/api/gopay/check-payment', 
  authenticateUser, 
  validateCheckPayment,
  asyncHandler(async (req, res) => {
    const { paymentId } = req.body || {};
    logger.request(req, 'Checking payment status', { paymentId, userId: req.user.id });

    if (!paymentId || typeof paymentId !== 'string' || !paymentId.trim()) {
      throw new AppError('paymentId is required', 400);
    }

    // SECURITY: Než zavoláme GoPay API, ověř, že paymentId patří objednávce
    // aktuálně přihlášeného uživatele (nebo že je volající admin).
    const order = await db.queryOne(
      'SELECT id, user_id FROM user_orders WHERE payment_id = ? LIMIT 1',
      [paymentId.trim()]
    );

    if (!order) {
      // Neprozrazujeme, jestli paymentId vůbec existuje v systému – jen 404
      throw new AppError('Order not found for this payment', 404);
    }

    // PERFORMANCE: Použij is_admin z req.user (nastavený v authenticateUser)
    const isAdmin = !!req.user.is_admin;

    // Pokud není admin a objednávka nepatří jemu, odmítni
    if (order.user_id !== req.user.id && !isAdmin) {
      throw new AppError('Forbidden', 403);
    }

    const accessToken = await getAccessToken();

    const response = await fetchWithTimeout(`${GOPAY_API_URL}/payments/payment/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error('GoPay API error', {
        requestId: req.id,
        status: response.status,
        error: data 
      });
      // BUG FIX: AppError constructor expects (message, statusCode, isOperational)
      // gopayError musí být přidán jako vlastnost po vytvoření error objektu
      const error = new AppError('GoPay API error', response.status, true);
      error.gopayError = data;
      throw error;
    }

    logger.request(req, 'Payment status checked', {
      paymentId,
      status: data.state
    });

    res.json({
      success: true,
      status: data.state,
      isPaid: data.state === 'PAID',
      data: data
    });
  })
);

/**
 * HestiaCP - Vytvoření hosting účtu
 * SECURITY: Vyžaduje admin práva (běžný uživatel nemůže vytvářet HestiaCP účty přímo)
 * HestiaCP účty se vytvářejí automaticky při registraci (authService) a po platbě (webhook)
 */
app.post('/api/hestiacp/create-account',
  authenticateUser,
  requireAdmin,
  validateCreateAccount,
  asyncHandler(async (req, res) => {
    logger.request(req, 'Creating HestiaCP hosting account');
    const { email, domain, package: pkg, username, password } = req.body;

    const result = await hestiacp.createHostingAccount({
      email,
      domain,
      package: pkg,
      username,
      password
    });

    if (!result.success) {
      logger.error('HestiaCP account creation failed', {
        requestId: req.id,
        error: result.error,
        email,
        domain
      });
      throw new AppError(result.error || 'Failed to create hosting account', 500);
    }

    logger.request(req, 'HestiaCP account created successfully', {
      username: result.username,
      domain: result.domain
    });

    // SECURITY: Heslo se NEposílá v API odpovědi - je uloženo v DB a mělo by se posílat emailem
    res.json({
      success: true,
      username: result.username,
      domain: result.domain,
      cpanelUrl: result.cpanelUrl,
      package: result.package,
      message: 'Účet vytvořen. Přihlašovací údaje byly uloženy do profilu uživatele.'
    });
  })
);

/**
 * HestiaCP - Vytvoření WEB DOMÉNY pro existujícího uživatele
 * SECURITY: Vyžaduje admin práva
 */
app.post('/api/hestiacp/create-domain',
  authenticateUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    logger.request(req, 'Creating HestiaCP web domain (admin)', {
      body: { username: req.body?.username, domain: req.body?.domain }
    });

    const { username, domain, ip } = req.body || {};

    if (!username || typeof username !== 'string') {
      throw new AppError('Username is required', 400);
    }
    if (!domain || typeof domain !== 'string') {
      throw new AppError('Domain is required', 400);
    }

    const domainResult = await hestiacp.createWebDomain({ username, domain, ip });

    if (!domainResult.success) {
      logger.error('HestiaCP createWebDomain failed', {
        requestId: req.id,
        username,
        domain,
        error: domainResult.error
      });
      throw new AppError(domainResult.error || 'Failed to create web domain', 500);
    }

    res.json({
      success: true,
      domain: domainResult.domain,
      ip: domainResult.ip,
      message: domainResult.message
    });
  })
);

/**
 * HestiaCP - Nastavení SSL (Let\'s Encrypt) pro doménu
 * SECURITY: Vyžaduje admin práva
 */
app.post('/api/hestiacp/setup-ssl',
  authenticateUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    logger.request(req, 'Setting up HestiaCP SSL (admin)', {
      body: { username: req.body?.username, domain: req.body?.domain }
    });

    const { username, domain } = req.body || {};

    if (!username || typeof username !== 'string') {
      throw new AppError('Username is required', 400);
    }
    if (!domain || typeof domain !== 'string') {
      throw new AppError('Domain is required', 400);
    }

    const sslResult = await hestiacp.setupSSL({ username, domain });

    if (!sslResult.success) {
      // SSL může selhat kvůli DNS, takže vracíme 200, ale s warningem
      logger.warn('HestiaCP SSL setup failed', {
        requestId: req.id,
        username,
        domain,
        error: sslResult.error
      });
      return res.status(200).json({
        success: false,
        warning: sslResult.warning || 'SSL setup failed (domain DNS may not be ready yet)',
        error: sslResult.error
      });
    }

    res.json({
      success: true,
      message: 'SSL configured successfully'
    });
  })
);

/**
 * HestiaCP - Suspendování účtu
 * SECURITY: Vyžaduje admin práva
 */
app.post('/api/hestiacp/suspend-account', 
  authenticateUser, 
  requireAdmin, 
  validateUsername,
  asyncHandler(async (req, res) => {
    logger.request(req, 'Suspending HestiaCP account');
    const { username } = req.body;

    const result = await hestiacp.suspendUser(username);

    if (!result.success) {
      logger.error('HestiaCP account suspension failed', {
        requestId: req.id,
        username,
        error: result.error
      });
      throw new AppError(result.error || 'Failed to suspend account', 500);
    }

    logger.request(req, 'HestiaCP account suspended successfully', { username });

    res.json({
      success: true
    });
  })
);

/**
 * HestiaCP - Obnovení účtu
 * SECURITY: Vyžaduje admin práva
 */
app.post('/api/hestiacp/unsuspend-account', 
  authenticateUser, 
  requireAdmin, 
  validateUsername,
  asyncHandler(async (req, res) => {
    logger.request(req, 'Unsuspending HestiaCP account');
    const { username } = req.body;

    const result = await hestiacp.unsuspendUser(username);

    if (!result.success) {
      logger.error('HestiaCP account unsuspension failed', {
        requestId: req.id,
        username,
        error: result.error
      });
      throw new AppError(result.error || 'Failed to unsuspend account', 500);
    }

    logger.request(req, 'HestiaCP account unsuspended successfully', { username });

    res.json({
      success: true
    });
  })
);

/**
 * HestiaCP - Smazání účtu
 * SECURITY: Vyžaduje admin práva
 */
app.post('/api/hestiacp/delete-account', 
  authenticateUser, 
  requireAdmin, 
  validateUsername,
  asyncHandler(async (req, res) => {
    logger.request(req, 'Deleting HestiaCP account');
    const { username } = req.body;

    const result = await hestiacp.deleteUser(username);

    if (!result.success) {
      logger.error('HestiaCP account deletion failed', {
        requestId: req.id,
        username,
        error: result.error
      });
      throw new AppError(result.error || 'Failed to delete account', 500);
    }

    logger.request(req, 'HestiaCP account deleted successfully', { username });

    res.json({
      success: true
    });
  })
);

/**
 * Health check (must be before React routing)
 */
// ============================================
// Authentication Endpoints (MySQL-based)
// ============================================
const authService = require('./services/authService');
const { sendPaymentConfirmationEmail, sendTicketNotificationEmail, sendServiceActivatedEmail, sendServiceExpiringEmail } = require('./services/emailService');

/**
 * Registrace nového uživatele
 */
app.post('/api/auth/register', 
  authLimiter,
  asyncHandler(async (req, res) => {
    logger.request(req, 'User registration attempt');
    
    const { email, password, firstName, lastName } = req.body;

    // Validace
    if (!email || !password || !firstName || !lastName) {
      throw new AppError('Všechna pole jsou povinná', 400);
    }

    // SECURITY: Validace email formátu
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError('Neplatný formát emailu', 400);
    }

    // SECURITY: Validace minimální délky hesla
    if (typeof password !== 'string' || password.length < 8) {
      throw new AppError('Heslo musí mít alespoň 8 znaků', 400);
    }

    // SECURITY: Validace délky jmen (prevence long input attacks)
    if (typeof firstName !== 'string' || firstName.length > 100 ||
        typeof lastName !== 'string' || lastName.length > 100) {
      throw new AppError('Jméno a příjmení nesmí být delší než 100 znaků', 400);
    }

    const result = await authService.register(email, password, firstName, lastName);

    if (result.success) {
      logger.request(req, 'User registered successfully', { userId: result.user.id });
      // SECURITY: Refresh token do httpOnly cookie, ne do response body
      setRefreshTokenCookie(res, result.refreshToken);
      res.status(201).json({
        success: true,
        user: result.user,
        accessToken: result.accessToken,
        message: result.message
      });
    } else {
      logger.warn('Registration failed', { requestId: req.id, error: result.error });
      throw new AppError(result.error || 'Registrace se nezdařila', 400);
    }
  })
);

/**
 * Přihlášení uživatele
 */
app.post('/api/auth/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    logger.request(req, 'User login attempt');
    
    const { email, password, mfaCode, recoveryCode } = req.body || {};

    if (!email || !password) {
      throw new AppError('Email a heslo jsou povinné', 400);
    }

    // SECURITY: Validate types to prevent NoSQL-style injection
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new AppError('Email a heslo musí být textové řetězce', 400);
    }

    const result = await authService.login(email, password, mfaCode, recoveryCode);

    if (result.success) {
      logger.request(req, 'User logged in successfully', { userId: result.user.id });
      // SECURITY: Refresh token do httpOnly cookie
      setRefreshTokenCookie(res, result.refreshToken);
      res.json({
        success: true,
        user: result.user,
        accessToken: result.accessToken,
      });
    } else {
      if (result.mfaRequired) {
        logger.warn('Login MFA required', { requestId: req.id, email });
        return res.status(401).json({
          success: false,
          error: result.error || 'Je vyžadován ověřovací kód',
          mfaRequired: true,
        });
      }
      logger.warn('Login failed', { requestId: req.id, email });
      throw new AppError(result.error || 'Nesprávný email nebo heslo', 401);
    }
  })
);

/**
 * Refresh access token
 */
app.post('/api/auth/refresh',
  requireCsrfGuard,
  asyncHandler(async (req, res) => {
    // SECURITY: Čti refresh token z httpOnly cookie (fallback na body pro zpětnou kompatibilitu)
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (!refreshToken) {
      throw new AppError('Refresh token je povinný', 400);
    }

    const result = await authService.refreshAccessToken(refreshToken);

    if (result.success) {
      // SECURITY: Refresh token rotation – ulož nový refresh token do httpOnly cookie
      if (result.refreshToken) {
        setRefreshTokenCookie(res, result.refreshToken);
      }
      res.json({
        success: true,
        accessToken: result.accessToken,
        user: result.user
      });
    } else {
      clearRefreshTokenCookie(res);
      throw new AppError(result.error || 'Neplatný refresh token', 401);
    }
  })
);

/**
 * Odhlášení uživatele
 */
app.post('/api/auth/logout',
  requireCsrfGuard,
  asyncHandler(async (req, res) => {
    // SECURITY: Čti refresh token z httpOnly cookie (fallback na body)
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    // Smaž cookie
    clearRefreshTokenCookie(res);
    res.json({ success: true, message: 'Odhlášení úspěšné' });
  })
);

/**
 * Odhlášení ze všech zařízení (invalidace všech refresh tokenů uživatele)
 * POST /api/auth/logout-all
 */
app.post('/api/auth/logout-all',
  authenticateUser,
  requireCsrfGuard,
  sensitiveOpLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const result = await authService.logoutAll(userId);

    if (!result.success) {
      throw new AppError(result.error || 'Odhlášení ze všech zařízení se nezdařilo', 500);
    }

    clearRefreshTokenCookie(res);
    res.json({
      success: true,
      message: `Byl jste odhlášen ze všech zařízení (${result.deletedCount || 0} relací)`
    });
  })
);

// ============================================
// OAuth Endpoints (Google, GitHub)
// ============================================
const oauthService = require('./services/oauthService');

// Dočasné úložiště pro OAuth state (prevence CSRF)
// V produkci by mělo být v Redis/DB, ale pro malý provoz stačí in-memory s TTL
const oauthStates = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of oauthStates) {
    if (now - value.createdAt > 10 * 60 * 1000) { // 10 minut TTL
      oauthStates.delete(key);
    }
  }
}, 60 * 1000);

/**
 * Zahájení OAuth flow – přesměruje na provider
 */
app.get('/api/auth/oauth/:provider/start',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { provider } = req.params;
    const { redirect } = req.query;

    if (!['google', 'github'].includes(provider)) {
      throw new AppError(`Nepodporovaný OAuth provider: ${provider}`, 400);
    }

    if (!oauthService.isProviderConfigured(provider)) {
      throw new AppError(`OAuth provider ${provider} není nakonfigurovaný. Nastavte ${provider.toUpperCase()}_CLIENT_ID a ${provider.toUpperCase()}_CLIENT_SECRET v .env`, 500);
    }

    // Generuj state token pro CSRF ochranu
    const state = require('crypto').randomBytes(32).toString('hex');
    oauthStates.set(state, {
      provider,
      frontendRedirect: redirect || '/',
      createdAt: Date.now(),
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const callbackUrl = `${appUrl.replace(/\/+$/, '')}/api/auth/oauth/${provider}/callback`;

    const authorizationUrl = oauthService.getAuthorizationUrl(provider, callbackUrl, state);
    res.redirect(authorizationUrl);
  })
);

/**
 * OAuth callback – provider přesměruje sem po autorizaci
 */
app.get('/api/auth/oauth/:provider/callback',
  asyncHandler(async (req, res) => {
    const { provider } = req.params;
    const { code, state, error: oauthError } = req.query;

    // Zjisti frontend redirect z uloženého state
    const stateData = state ? oauthStates.get(state) : null;
    const frontendRedirect = stateData?.frontendRedirect || '/auth/callback';
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    // Podporovat plnou URL (https://...) i relativní cestu
    let frontendUrl;
    if (/^https?:\/\//i.test(frontendRedirect)) {
      // Frontend posílá celou URL – ověř že doména odpovídá APP_URL
      try {
        const redirectHost = new URL(frontendRedirect).hostname.replace(/^www\./, '');
        const appHost = new URL(appUrl).hostname.replace(/^www\./, '');
        if (redirectHost === appHost) {
          frontendUrl = frontendRedirect;
        } else {
          frontendUrl = `${appUrl.replace(/\/+$/, '')}/auth/callback`;
        }
      } catch {
        frontendUrl = `${appUrl.replace(/\/+$/, '')}/auth/callback`;
      }
    } else {
      frontendUrl = `${appUrl.replace(/\/+$/, '')}${frontendRedirect.startsWith('/') ? frontendRedirect : '/' + frontendRedirect}`;
    }

    // Vyčisti state
    if (state) {
      oauthStates.delete(state);
    }

    // Chyba od providera
    if (oauthError) {
      logger.warn('OAuth error from provider', { provider, error: oauthError });
      return res.redirect(`${frontendUrl}?error=${encodeURIComponent(oauthError)}`);
    }

    // Validace
    if (!code || !state || !stateData) {
      logger.warn('OAuth callback missing code or invalid state', { provider, hasCode: !!code, hasState: !!state });
      return res.redirect(`${frontendUrl}?error=${encodeURIComponent('Neplatný OAuth požadavek')}`);
    }

    if (stateData.provider !== provider) {
      logger.warn('OAuth state provider mismatch', { expected: stateData.provider, got: provider });
      return res.redirect(`${frontendUrl}?error=${encodeURIComponent('Neplatný OAuth požadavek')}`);
    }

    try {
      const callbackUrl = `${appUrl.replace(/\/+$/, '')}/api/auth/oauth/${provider}/callback`;

      // Vyměň code za access token
      const oauthAccessToken = await oauthService.exchangeCodeForToken(provider, code, callbackUrl);

      // Získej profil uživatele
      const profile = await oauthService.getUserProfile(provider, oauthAccessToken);

      // Najdi nebo vytvoř uživatele
      const user = await oauthService.findOrCreateUser(provider, profile);

      // Vydej JWT tokeny
      const accessToken = authService.generateAccessToken(user);
      const refreshToken = authService.generateRefreshToken(user);

      // Ulož refresh token do DB
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await db.execute(
        `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
        [user.id, refreshToken, expiresAt]
      );

      // Nastav refresh token cookie
      setRefreshTokenCookie(res, refreshToken);

      logger.info('OAuth login successful', { provider, userId: user.id, email: user.email });

      // Redirect na frontend s access tokenem v URL fragment (bezpečnější než query string – neodesílá se na server)
      res.redirect(`${frontendUrl}#access_token=${accessToken}`);

    } catch (err) {
      logger.error('OAuth callback error', { provider, error: err.message });
      res.redirect(`${frontendUrl}?error=${encodeURIComponent(err.message || 'OAuth přihlášení se nezdařilo')}`);
    }
  })
);

/**
 * Získání aktuálního uživatele
 */
app.get('/api/auth/user',
  authenticateUser,
  asyncHandler(async (req, res) => {
    // Načti plný profil uživatele z MySQL (users + profiles)
    const fullUser = await db.queryOne(
      `SELECT 
         u.id,
         u.email,
         u.email_verified,
         u.mfa_enabled,
         u.provider,
         u.created_at,
         u.updated_at,
         p.first_name,
         p.last_name,
         p.is_admin,
         p.avatar_url
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!fullUser) {
      throw new AppError('User not found', 404);
    }

    // Response tvar přizpůsobený frontend typům UserProfile / AppUser
    res.json({
      success: true,
      user: {
        id: fullUser.id,
        email: fullUser.email,
        first_name: fullUser.first_name,
        last_name: fullUser.last_name,
        is_admin: !!fullUser.is_admin,
        avatar_url: fullUser.avatar_url,
        email_verified: !!fullUser.email_verified,
        created_at: fullUser.created_at,
        updated_at: fullUser.updated_at,
        two_factor_enabled: !!fullUser.mfa_enabled
      }
    });
  })
);

/**
 * Aktualizace profilu přihlášeného uživatele (first_name, last_name, avatar_url)
 * PUT /api/auth/user
 * body: { first_name?, last_name?, avatar_url? }
 */
app.put('/api/auth/user',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const { first_name, last_name, avatar_url } = req.body || {};
    const userId = req.user.id;

    const fields = [];
    const values = [];

    if (typeof first_name === 'string') {
      fields.push('first_name = ?');
      values.push(first_name.trim());
    }
    if (typeof last_name === 'string') {
      fields.push('last_name = ?');
      values.push(last_name.trim());
    }
    if (typeof avatar_url === 'string') {
      // SECURITY: Validace avatar URL - povoleny jen http(s) protokoly (prevence javascript: XSS)
      const trimmedUrl = avatar_url.trim();
      if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
        throw new AppError('Avatar URL must start with http:// or https://', 400);
      }
      fields.push('avatar_url = ?');
      values.push(trimmedUrl);
    }

    if (fields.length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    fields.push('updated_at = NOW()');
    values.push(userId);

    await db.execute(
      `UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ success: true });
  })
);

/**
 * Resetování hesla - žádost
 */
app.post('/api/auth/reset-password-request',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Email je povinný', 400);
    }

    const result = await authService.requestPasswordReset(email);
    res.json(result);
  })
);

/**
 * Resetování hesla - změna hesla
 */
app.post('/api/auth/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      throw new AppError('Token a nové heslo jsou povinné', 400);
    }

    const result = await authService.resetPassword(token, newPassword);
    
    if (result.success) {
      res.json(result);
    } else {
      throw new AppError(result.error || 'Resetování hesla se nezdařilo', 400);
    }
  })
);

/**
 * Ověření emailu pomocí tokenu
 */
app.post('/api/auth/verify-email',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token } = req.body || {};

    if (!token) {
      throw new AppError('Verifikační token je povinný', 400);
    }

    const result = await authService.verifyEmail(token);

    if (result.success) {
      res.json(result);
    } else {
      throw new AppError(result.error || 'Ověření emailu se nezdařilo', 400);
    }
  })
);

/**
 * Zaslat znovu ověřovací email (pouze přihlášený uživatel)
 */
app.post('/api/auth/resend-verification',
  authenticateUser,
  authLimiter,
  asyncHandler(async (req, res) => {
    const email = req.user.email;

    if (!email) {
      throw new AppError('Uživatel nemá nastavený email', 400);
    }

    try {
      await authService.createEmailVerificationForUser(req.user.id, email);
    } catch (error) {
      logger.errorRequest(req, error, { context: 'resend_verification' });
      throw new AppError('Odeslání ověřovacího emailu se nezdařilo', 500);
    }

    res.json({
      success: true,
      message: 'Pokud email ještě není ověřen, byl odeslán nový ověřovací email',
    });
  })
);

/**
 * MFA: Začátek nastavení (vytvoření secretu a recovery kódů)
 */
app.post('/api/auth/mfa/setup',
  sensitiveOpLimiter,
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const email = req.user.email;

    const setup = await authService.startMfaSetup(userId, email);

    res.json({
      success: true,
      ...setup,
    });
  })
);

/**
 * MFA: Potvrzení nastavení (ověření TOTP kódu)
 */
app.post('/api/auth/mfa/verify',
  sensitiveOpLimiter,
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { code } = req.body || {};

    if (!code) {
      throw new AppError('Ověřovací kód je povinný', 400);
    }

    const result = await authService.confirmMfaSetup(userId, String(code));

    if (result.success) {
      res.json(result);
    } else {
      throw new AppError(result.error || 'Ověření kódu se nezdařilo', 400);
    }
  })
);

/**
 * MFA: Vypnutí (vyžaduje heslo)
 */
app.post('/api/auth/mfa/disable',
  sensitiveOpLimiter,
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { password } = req.body || {};

    if (!password) {
      throw new AppError('Heslo je povinné', 400);
    }

    const result = await authService.disableMfa(userId, password);

    if (result.success) {
      res.json(result);
    } else {
      throw new AppError(result.error || 'Vypnutí 2FA se nezdařilo', 400);
    }
  })
);

/**
 * Změna hesla přihlášeného uživatele
 */
app.post('/api/auth/change-password',
  sensitiveOpLimiter,
  authenticateUser,
  asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      throw new AppError('Staré i nové heslo jsou povinné', 400);
    }

    const result = await authService.changePassword(req.user.id, oldPassword, newPassword);
    
    if (result.success) {
      res.json(result);
    } else {
      throw new AppError(result.error || 'Změna hesla se nezdařila', 400);
    }
  })
);

// ============================================
// SUPPORT TICKETS API
// ============================================

const discordService = require('./services/discordService');
const { initializeDiscordBot, getDiscordBot } = require('./services/discordTicketBot');

/**
 * Create a new support ticket
 * POST /api/tickets
 * Protected route - requires authentication
 */
app.post('/api/tickets',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const { subject, message, priority, category } = req.body;
    const userId = req.user.id;

    // Validation: must be strings with non-whitespace content (reject arrays, objects, whitespace-only)
    if (typeof subject !== 'string' || typeof message !== 'string') {
      throw new AppError('Subject and message must be strings', 400);
    }
    const subjectTrimmed = subject.trim();
    const messageTrimmed = message.trim();
    if (!subjectTrimmed || !messageTrimmed) {
      throw new AppError('Subject and message are required and cannot be whitespace-only', 400);
    }

    // SECURITY: Length validation to prevent oversized payloads hitting the database
    if (subjectTrimmed.length > 200) {
      throw new AppError('Subject too long (max 200 characters)', 400);
    }
    if (messageTrimmed.length > 10000) {
      throw new AppError('Message too long (max 10000 characters)', 400);
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const ticketPriority = priority && validPriorities.includes(priority) ? priority : 'medium';

    // Validate category
    const validCategories = ['general', 'technical', 'billing', 'domain', 'hosting'];
    const ticketCategory = category && validCategories.includes(category) ? category : 'general';

    // Insert ticket into database
    const insertQuery = `
      INSERT INTO support_tickets (user_id, subject, message, priority, category, status)
      VALUES (?, ?, ?, ?, ?, 'open')
    `;

    const result = await db.execute(insertQuery, [
      userId,
      subjectTrimmed,
      messageTrimmed,
      ticketPriority,
      ticketCategory
    ]);

    const ticketId = result.insertId;

    // Get user info for Discord notification
    // BUG FIX: users tabulka nemá sloupec \"name\" – jméno je v tabulce profiles (first_name, last_name)
    const userQuery = 'SELECT email, first_name, last_name FROM profiles WHERE id = ?';
    const userResult = await db.queryOne(userQuery, [userId]);

    // Send Discord notification and create ticket channel (non-blocking)
    if (userResult) {
      const fullName = [userResult.first_name, userResult.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();

      const ticketData = {
        ticketId: ticketId,
        userId: userId,
        name: fullName || userResult.email || 'Unknown',
        email: userResult.email || 'Unknown',
        subject: subjectTrimmed,
        message: messageTrimmed,
        priority: ticketPriority,
        category: ticketCategory,
        status: 'open'
      };

      // Legacy Discord notification (to notification channel)
      discordService.sendTicketNotification(ticketData).catch(error => {
        logger.error('Failed to send Discord notification', { error: error?.message || String(error) });
      });

      // Create Discord ticket channel (new feature)
      const discordBot = getDiscordBot();
      if (discordBot && discordBot.ready) {
        discordBot.createTicketChannel(ticketData).catch(error => {
          logger.error('Failed to create Discord ticket channel', { error: error?.message || String(error) });
        });
      }
    }

    logger.info(`Ticket #${ticketId} created by user ${userId}`, {
      requestId: req.id,
      ticketId,
      userId,
      priority: ticketPriority,
      category: ticketCategory
    });

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      ticket: {
        id: ticketId,
        subject: subjectTrimmed,
        message: messageTrimmed,
        priority: ticketPriority,
        category: ticketCategory,
        status: 'open',
        created_at: new Date().toISOString()
      }
    });
  })
);

/**
 * Get user's tickets
 * GET /api/tickets
 * Protected route - requires authentication
 */
app.get('/api/tickets',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { page, limit, offset } = parsePagination(req.query);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM support_tickets WHERE user_id = ?', [userId]
    );
    const total = countResult[0]?.total || 0;

    const tickets = await db.query(`
      SELECT id, subject, message, status, priority, category,
             created_at, updated_at, last_reply_at, resolved_at
      FROM support_tickets WHERE user_id = ?
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    logger.info(`Retrieved ${tickets.length} tickets for user ${userId}`, {
      requestId: req.id,
      userId,
      ticketCount: tickets.length
    });

    res.json({
      success: true,
      tickets: tickets || [],
      pagination: paginationMeta(page, limit, total)
    });
  })
);

/**
 * Get a specific ticket by ID (vlastník nebo admin)
 * GET /api/tickets/:id
 */
app.get('/api/tickets/:id',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const ticketId = validateNumericId(req.params.id);
    const userId = req.user.id;

    const ticket = await db.queryOne(
      'SELECT id, user_id, subject, message, status, priority, category, assigned_to, created_at, updated_at, last_reply_at, resolved_at FROM support_tickets WHERE id = ?',
      [ticketId]
    );
    if (!ticket) throw new AppError('Ticket not found', 404);

    const isOwner = ticket.user_id === userId;
    if (!isOwner && !req.user.is_admin) {
      throw new AppError('Forbidden', 403);
    }

    res.json({ success: true, ticket });
  })
);

/**
 * Update ticket (status, priority, assigned_to)
 * PUT /api/tickets/:id
 * body: { status?, priority?, assigned_to? }
 */
app.put('/api/tickets/:id',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const ticketId = validateNumericId(req.params.id);
    const { status, priority, assigned_to } = req.body || {};

    const ticket = await db.queryOne('SELECT id, user_id FROM support_tickets WHERE id = ?', [ticketId]);
    if (!ticket) throw new AppError('Ticket not found', 404);

    const isOwner = ticket.user_id === req.user.id;
    const isAdmin = !!req.user.is_admin;
    if (!isOwner && !isAdmin) throw new AppError('Forbidden', 403);

    const updates = [];
    const values = [];
    const validStatus = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
    const validPriority = ['low', 'medium', 'high', 'urgent'];

    // SECURITY: Non-admin users can only close their own tickets
    if (status && validStatus.includes(status)) {
      if (!isAdmin && status !== 'closed') {
        throw new AppError('You can only close tickets', 403);
      }
      updates.push('status = ?');
      values.push(status);
    }
    // SECURITY: Only admins can change priority and assignment
    if (priority && validPriority.includes(priority)) {
      if (!isAdmin) throw new AppError('Only admins can change priority', 403);
      updates.push('priority = ?');
      values.push(priority);
    }
    if (assigned_to !== undefined) {
      if (!isAdmin) throw new AppError('Only admins can assign tickets', 403);
      updates.push('assigned_to = ?');
      values.push(assigned_to === null || assigned_to === '' ? null : assigned_to);
    }
    if (updates.length === 0) throw new AppError('No valid fields to update', 400);
    values.push(ticketId);
    await db.execute(
      `UPDATE support_tickets SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );
    const updated = await db.queryOne('SELECT * FROM support_tickets WHERE id = ?', [ticketId]);

    // Notify Discord about status change (non-blocking)
    try {
      const discordBot = getDiscordBot();
      if (discordBot && discordBot.ready && status) {
        if (status === 'closed') {
          // Handle ticket closure - delete Discord channel
          discordBot.onTicketClosed(ticketId).catch(err => {
            logger.error('Failed to close Discord ticket channel', { error: err?.message || String(err), ticketId });
          });
        } else {
          // Notify about status change
          discordBot.onTicketStatusChanged(ticketId, status).catch(err => {
            logger.error('Failed to notify Discord about status change', { error: err?.message || String(err), ticketId });
          });
        }
      }
    } catch (discordError) {
      logger.error('Discord status notification error', { error: discordError?.message || String(discordError), ticketId });
    }

    res.json({ success: true, ticket: updated });
  })
);

/**
 * Get messages for a ticket
 * GET /api/tickets/:id/messages
 */
app.get('/api/tickets/:id/messages',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const ticketId = validateNumericId(req.params.id);

    const ticket = await db.queryOne('SELECT id, user_id FROM support_tickets WHERE id = ?', [ticketId]);
    if (!ticket) throw new AppError('Ticket not found', 404);

    const isOwner = ticket.user_id === req.user.id;
    if (!isOwner && !req.user.is_admin) throw new AppError('Forbidden', 403);

    const messages = await db.query(
      `SELECT id, ticket_id, user_id, message, is_admin_reply, created_at
       FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC`,
      [ticketId]
    );
    res.json({ success: true, messages: messages || [] });
  })
);

/**
 * Add message to ticket
 * POST /api/tickets/:id/messages
 * body: { message, is_admin_reply?, mentions? }
 */
app.post('/api/tickets/:id/messages',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const ticketId = validateNumericId(req.params.id);
    const { message, is_admin_reply } = req.body || {};

    if (typeof message !== 'string' || !message.trim()) throw new AppError('Message is required', 400);

    // SECURITY: Length validation for ticket reply messages
    if (message.trim().length > 10000) {
      throw new AppError('Message too long (max 10000 characters)', 400);
    }

    const ticket = await db.queryOne(
      `SELECT t.id, t.user_id, t.subject, p.email AS user_email
       FROM support_tickets t
       LEFT JOIN profiles p ON p.id = t.user_id
       WHERE t.id = ?`,
      [ticketId]
    );
    if (!ticket) throw new AppError('Ticket not found', 404);

    const isOwner = ticket.user_id === req.user.id;
    const isAdmin = !!req.user.is_admin;
    if (!isOwner && !isAdmin) throw new AppError('Forbidden', 403);

    await db.execute(
      'INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin_reply) VALUES (?, ?, ?, ?)',
      [ticketId, req.user.id, message.trim(), isAdmin]
    );
    await db.execute(
      'UPDATE support_tickets SET last_reply_at = NOW(), updated_at = NOW() WHERE id = ?',
      [ticketId]
    );

    const messages = await db.query(
      'SELECT id, ticket_id, user_id, message, is_admin_reply, created_at FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC',
      [ticketId]
    );

    // BEST-EFFORT EMAIL NOTIFIKACE (neblokuje odpověď)
    try {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const subjectBase = ticket.subject || `Ticket #${ticket.id}`;
      const preview = message.trim().slice(0, 200);

      // Pokud odpovídá admin → pošli mail uživateli
      if (isAdmin && ticket.user_email) {
        await sendTicketNotificationEmail(
          ticket.user_email,
          `Nová odpověď na ticket: ${subjectBase}`,
          preview,
          ticket.id
        );
      }

      // Pokud odpovídá uživatel → TODO: tady by bylo vhodné poslat email na support/admin adresu
      // Můžeme použít SMTP_FROM jako fallback příjemce
      if (!isAdmin) {
        const supportEmail = process.env.SMTP_FROM || process.env.MAIL_FROM;
        if (supportEmail) {
          await sendTicketNotificationEmail(
            supportEmail,
            `Nová zpráva od zákazníka v ticketu: ${subjectBase}`,
            preview,
            ticket.id
          );
        }
      }
    } catch (emailError) {
      logger.error('Failed to send ticket notification email', {
        requestId: req.id,
        error: emailError.message || emailError,
        ticketId,
      });
    }

    // Sync message to Discord channel (non-blocking)
    try {
      const discordBot = getDiscordBot();
      if (discordBot && discordBot.ready) {
        const userName = req.user.first_name && req.user.last_name
          ? `${req.user.first_name} ${req.user.last_name}`.trim()
          : req.user.email || 'Unknown';
        discordBot.sendMessageToChannel(ticketId, message.trim(), userName, isAdmin).catch(err => {
          logger.error('Failed to sync message to Discord', { error: err?.message || String(err), ticketId });
        });
      }
    } catch (discordError) {
      logger.error('Discord message sync error', { error: discordError?.message || String(discordError), ticketId });
    }

    res.json({ success: true, messages: messages || [] });
  })
);

// ============================================
// ADMIN & DASHBOARD API (Orders, Users, Hosting Services, Tickets)
// ============================================

/**
 * Admin: get list of all users with basic stats
 * GET /api/admin/users
 */
app.get('/api/admin/users',
  authenticateUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);

    const countResult = await db.query('SELECT COUNT(*) as total FROM users');
    const total = countResult[0]?.total || 0;

    const rows = await db.query(
      `SELECT
         u.id, u.email, u.email_verified, u.created_at, u.last_login,
         u.failed_logins, u.locked_until, p.first_name, p.last_name, p.is_admin
       FROM users u LEFT JOIN profiles p ON p.id = u.id
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, [limit, offset]
    );

    const users = (rows || []).map(row => ({
      id: row.id,
      email: row.email,
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      is_admin: !!row.is_admin,
      email_verified: !!row.email_verified,
      created_at: row.created_at,
      last_login: row.last_login,
      failed_logins: typeof row.failed_logins === 'number' ? row.failed_logins : 0,
      locked_until: row.locked_until || null,
    }));

    res.json({
      success: true,
      users,
      pagination: paginationMeta(page, limit, total)
    });
  })
);

/**
 * Admin: unlock user account (reset failed_logins and locked_until)
 * POST /api/admin/users/:userId/unlock
 */
app.post('/api/admin/users/:userId/unlock',
  authenticateUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const targetUserId = req.params.userId;

    await db.execute(
      'UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?',
      [targetUserId]
    );

    res.json({
      success: true,
      message: 'Uživatelský účet byl odemknut.',
    });
  })
);

/**
 * Get profile for specific user
 * GET /api/profile/:userId
 * - user can load own profile
 * - admin can load any profile
 */
app.get('/api/profile/:userId',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const targetUserId = req.params.userId;

    if (req.user.id !== targetUserId && !req.user.is_admin) {
      throw new AppError('Forbidden', 403);
    }

    const profile = await db.queryOne(
      `SELECT 
         p.id,
         p.email,
         p.first_name,
         p.last_name,
         p.is_admin,
         p.avatar_url,
         p.phone,
         p.company,
         p.address,
         p.ico,
         p.dic,
         p.created_at,
         p.updated_at,
         p.last_login,
         u.email_verified
       FROM profiles p
       LEFT JOIN users u ON u.id = p.id
       WHERE p.id = ?`,
      [targetUserId]
    );

    if (!profile) {
      throw new AppError('Profile not found', 404);
    }

    res.json({
      success: true,
      profile: {
        id: profile.id,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        is_admin: !!profile.is_admin,
        avatar_url: profile.avatar_url,
        phone: profile.phone,
        company: profile.company,
        address: profile.address || '',
        ico: profile.ico || '',
        dic: profile.dic || '',
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        last_login: profile.last_login,
        email_verified: !!profile.email_verified
      }
    });
  })
);

/**
 * Admin: update user role / profile
 * PUT /api/profile/:userId  { is_admin?: boolean }
 */
app.put('/api/profile/:userId',
  authenticateUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const targetUserId = req.params.userId;
    const { is_admin } = req.body;

    if (typeof is_admin !== 'boolean') {
      throw new AppError('is_admin must be boolean', 400);
    }

    await db.execute(
      'UPDATE profiles SET is_admin = ?, updated_at = NOW() WHERE id = ?',
      [is_admin ? 1 : 0, targetUserId]
    );

    const updated = await db.queryOne(
      `SELECT 
         p.id,
         p.email,
         p.first_name,
         p.last_name,
         p.is_admin,
         p.avatar_url,
         p.phone,
         p.company,
         p.address,
         p.ico,
         p.dic,
         p.created_at,
         p.updated_at,
         p.last_login,
         u.email_verified
       FROM profiles p
       LEFT JOIN users u ON u.id = p.id
       WHERE p.id = ?`,
      [targetUserId]
    );

    res.json({
      success: true,
      profile: {
        id: updated.id,
        email: updated.email,
        first_name: updated.first_name,
        last_name: updated.last_name,
        is_admin: !!updated.is_admin,
        avatar_url: updated.avatar_url,
        phone: updated.phone,
        company: updated.company,
        address: updated.address || '',
        ico: updated.ico || '',
        dic: updated.dic || '',
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        last_login: updated.last_login,
        email_verified: !!updated.email_verified
      }
    });
  })
);

/**
 * User: update own profile
 * PUT /api/profile
 */
app.put('/api/profile',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const { userId, firstName, lastName, phone, company, avatarUrl, newsletter, address, ico, dic } = req.body || {};
    const targetUserId = userId || req.user.id;

    if (targetUserId !== req.user.id) {
      // Only admins may update other users; keep it simple for now (deny)
      throw new AppError('Forbidden', 403);
    }

    const fields = [];
    const values = [];

    if (typeof firstName === 'string') {
      fields.push('first_name = ?');
      values.push(firstName);
    }
    if (typeof lastName === 'string') {
      fields.push('last_name = ?');
      values.push(lastName);
    }
    if (typeof phone === 'string') {
      fields.push('phone = ?');
      values.push(phone);
    }
    if (typeof company === 'string') {
      fields.push('company = ?');
      values.push(company);
    }
    if (typeof address === 'string') {
      fields.push('address = ?');
      values.push(address);
    }
    if (typeof ico === 'string') {
      fields.push('ico = ?');
      values.push(ico.trim());
    }
    if (typeof dic === 'string') {
      fields.push('dic = ?');
      values.push(dic.trim());
    }
    if (typeof avatarUrl === 'string') {
      // SECURITY: Validace avatar URL - povoleny jen http(s) protokoly
      const trimmedAvatarUrl = avatarUrl.trim();
      if (trimmedAvatarUrl && !/^https?:\/\//i.test(trimmedAvatarUrl)) {
        throw new AppError('Avatar URL must start with http:// or https://', 400);
      }
      fields.push('avatar_url = ?');
      values.push(trimmedAvatarUrl);
    }
    if (typeof newsletter === 'boolean') {
      fields.push('newsletter_subscription = ?');
      values.push(newsletter ? 1 : 0);
    }

    if (fields.length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    fields.push('updated_at = NOW()');

    const updateQuery = `
      UPDATE profiles
      SET ${fields.join(', ')}
      WHERE id = ?
    `;
    values.push(targetUserId);

    await db.execute(updateQuery, values);

    const updated = await db.queryOne(
      `SELECT 
         p.id,
         p.email,
         p.first_name,
         p.last_name,
         p.is_admin,
         p.avatar_url,
         p.phone,
         p.company,
         p.address,
         p.ico,
         p.dic,
         p.created_at,
         p.updated_at,
         p.last_login,
         u.email_verified
       FROM profiles p
       LEFT JOIN users u ON u.id = p.id
       WHERE p.id = ?`,
      [targetUserId]
    );

    res.json({
      success: true,
      profile: {
        id: updated.id,
        email: updated.email,
        first_name: updated.first_name,
        last_name: updated.last_name,
        is_admin: !!updated.is_admin,
        avatar_url: updated.avatar_url,
        phone: updated.phone,
        company: updated.company,
        address: updated.address || '',
        ico: updated.ico || '',
        dic: updated.dic || '',
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        last_login: updated.last_login,
        email_verified: !!updated.email_verified
      }
    });
  })
);

/**
 * Create generic order (admin / internal)
 * POST /api/orders
 */
app.post('/api/orders',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      plan_id,
      plan_name,
      price,
      currency,
      billing_email,
      billing_name,
      billing_company,
      billing_address,
      billing_phone,
      customer_email,
      customer_name,
      status,
      payment_status,
      domain_name,
      notes
    } = req.body || {};

    if (!plan_id || !plan_name || typeof price !== 'number') {
      throw new AppError('plan_id, plan_name and price are required', 400);
    }

    const insertResult = await db.execute(
      `INSERT INTO user_orders (
         user_id, plan_id, plan_name, price, currency,
         billing_email, billing_name, billing_company, billing_address, billing_phone,
         customer_email, customer_name,
         status, payment_status,
         domain_name, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        plan_id,
        plan_name,
        price,
        currency || 'CZK',
        billing_email || null,
        billing_name || null,
        billing_company || null,
        billing_address || null,
        billing_phone || null,
        customer_email || billing_email || null,
        customer_name || billing_name || null,
        status || 'pending',
        payment_status || 'unpaid',
        domain_name || null,
        notes || null
      ]
    );

    const orderId = insertResult.insertId;

    const order = await db.queryOne(
      'SELECT * FROM user_orders WHERE id = ?',
      [orderId]
    );

    res.status(201).json({
      success: true,
      order
    });
  })
);

/**
 * Create hosting order (used by frontend)
 * POST /api/orders/hosting
 */
app.post('/api/orders/hosting',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      planId,
      planName,
      price,
      currency,
      billingEmail,
      billingName,
      billingCompany,
      billingAddress,
      billingPhone,
      domainName
    } = req.body || {};

    if (!planId || !planName || typeof price !== 'number') {
      throw new AppError('planId, planName and price are required', 400);
    }

    // BUG FIX: Column count mismatch — 15 columns ale 16 values. status a payment_status jsou literals.
    const insertResult = await db.execute(
      `INSERT INTO user_orders (
         user_id, plan_id, plan_name, price, currency,
         billing_email, billing_name, billing_company, billing_address, billing_phone,
         customer_email, customer_name,
         status, payment_status,
         domain_name
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?)`,
      [
        userId,
        planId,
        planName,
        price,
        currency || 'CZK',
        billingEmail || null,
        billingName || null,
        billingCompany || null,
        billingAddress || null,
        billingPhone || null,
        billingEmail || null,
        billingName || null,
        domainName || null
      ]
    );

    const orderId = insertResult.insertId;
    const order = await db.queryOne(
      'SELECT * FROM user_orders WHERE id = ?',
      [orderId]
    );

    res.status(201).json({
      success: true,
      order
    });
  })
);

/**
 * Get orders (admin: všechny, user: vlastní). Query: ?payment_id= pro vyhledání podle payment_id.
 * GET /api/orders
 */
app.get('/api/orders',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const { payment_id: paymentId } = req.query || {};
    const isAdmin = !!req.user.is_admin;
    const { page, limit, offset } = parsePagination(req.query);

    let countQuery, dataQuery, params, countParams;

    if (isAdmin) {
      if (paymentId && typeof paymentId === 'string') {
        countQuery = 'SELECT COUNT(*) as total FROM user_orders WHERE payment_id = ?';
        dataQuery = 'SELECT * FROM user_orders WHERE payment_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
        countParams = [paymentId.trim()];
        params = [paymentId.trim(), limit, offset];
      } else {
        countQuery = 'SELECT COUNT(*) as total FROM user_orders';
        dataQuery = 'SELECT * FROM user_orders ORDER BY created_at DESC LIMIT ? OFFSET ?';
        countParams = [];
        params = [limit, offset];
      }
    } else {
      if (paymentId && typeof paymentId === 'string') {
        countQuery = 'SELECT COUNT(*) as total FROM user_orders WHERE user_id = ? AND payment_id = ?';
        dataQuery = 'SELECT * FROM user_orders WHERE user_id = ? AND payment_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
        countParams = [req.user.id, paymentId.trim()];
        params = [req.user.id, paymentId.trim(), limit, offset];
      } else {
        countQuery = 'SELECT COUNT(*) as total FROM user_orders WHERE user_id = ?';
        dataQuery = 'SELECT * FROM user_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
        countParams = [req.user.id];
        params = [req.user.id, limit, offset];
      }
    }

    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;
    const orders = await db.query(dataQuery, params);

    res.json({
      success: true,
      orders: orders || [],
      pagination: paginationMeta(page, limit, total)
    });
  })
);

/**
 * Get orders for specific user
 * GET /api/orders/user/:userId
 */
app.get('/api/orders/user/:userId',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const targetUserId = req.params.userId;

    if (targetUserId !== req.user.id && !req.user.is_admin) {
      throw new AppError('Forbidden', 403);
    }

    const orders = await db.query(
      'SELECT * FROM user_orders WHERE user_id = ? ORDER BY created_at DESC',
      [targetUserId]
    );

    res.json({
      success: true,
      orders: orders || []
    });
  })
);

/**
 * Get single order by ID (used by HestiaCP integration)
 * GET /api/orders/:id
 */
app.get('/api/orders/:id',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const orderId = validateNumericId(req.params.id);

    const order = await db.queryOne(
      `SELECT 
         o.*,
         p.email AS profile_email,
         p.first_name,
         p.last_name
       FROM user_orders o
       LEFT JOIN profiles p ON p.id = o.user_id
       WHERE o.id = ?`,
      [orderId]
    );

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Only owner or admin can see order
    if (order.user_id !== req.user.id && !req.user.is_admin) {
      throw new AppError('Forbidden', 403);
    }

    res.json({
      success: true,
      order: {
        ...order,
        profiles: {
          email: order.profile_email,
          first_name: order.first_name,
          last_name: order.last_name
        }
      }
    });
  })
);

/**
 * Generate simple HTML invoice for an order
 * GET /api/orders/:id/invoice
 */
app.get('/api/orders/:id/invoice',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const orderId = validateNumericId(req.params.id);

    const order = await db.queryOne('SELECT * FROM user_orders WHERE id = ?', [orderId]);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Only owner or admin can view invoice
    if (order.user_id !== req.user.id && !req.user.is_admin) {
      throw new AppError('Forbidden', 403);
    }

    const profile = await db.queryOne(
      `SELECT first_name, last_name, company, address, email, ico, dic
       FROM profiles
       WHERE id = ?`,
      [order.user_id]
    );

    const invoiceNumber = order.invoice_number || `INV-${order.id}`;
    const issuedAt = order.invoice_issued_at || order.payment_date || order.created_at;

    const customerName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || ''
      : order.billing_name || order.customer_name || '';

    const billingCompany = order.billing_company || profile?.company || customerName;
    const billingAddress = order.billing_address || profile?.address || '';
    const billingIco = order.billing_ico || profile?.ico || '';
    const billingDic = order.billing_dic || profile?.dic || '';

    const amount = Number(order.price) || 0;
    const currency = order.currency || 'CZK';
    const paymentDate = order.payment_date ? new Date(order.payment_date).toLocaleDateString('cs-CZ') : '';

    // SECURITY: Escape HTML entities to prevent XSS in invoice
    const esc = (str) => {
      if (typeof str !== 'string') return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };

    const html = `<!DOCTYPE html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <title>Faktura ${esc(invoiceNumber)}</title>
    <style>
      body { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; margin: 40px; color: #111827; font-size: 14px; }
      .invoice-header { display: flex; justify-content: space-between; margin-bottom: 32px; border-bottom: 2px solid #111827; padding-bottom: 16px; }
      .invoice-title { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
      .muted { color: #6b7280; font-size: 13px; }
      .section { margin-bottom: 24px; }
      .section-title { font-weight: 600; margin-bottom: 8px; font-size: 15px; }
      .parties { display: flex; gap: 40px; margin-bottom: 32px; }
      .party { flex: 1; }
      .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { padding: 10px 8px; text-align: left; font-size: 14px; }
      th { border-bottom: 2px solid #d1d5db; font-weight: 600; background: #f9fafb; }
      td { border-bottom: 1px solid #f3f4f6; }
      tfoot td { border-top: 2px solid #111827; font-weight: 700; font-size: 16px; border-bottom: none; }
      .text-right { text-align: right; }
      .print-btn { display: inline-block; padding: 8px 20px; background: #111827; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; margin-top: 24px; }
      .print-btn:hover { background: #374151; }
      @media print { .no-print { display: none !important; } body { margin: 20px; } }
    </style>
  </head>
  <body>
    <div class="invoice-header">
      <div>
        <div class="invoice-title">Faktura</div>
        <div class="muted">Číslo: ${esc(invoiceNumber)}</div>
        <div class="muted">Datum vystavení: ${issuedAt ? esc(new Date(issuedAt).toLocaleDateString('cs-CZ')) : ''}</div>
        ${paymentDate ? `<div class="muted">Datum úhrady: ${esc(paymentDate)}</div>` : ''}
      </div>
      <div style="text-align:right">
        <div><strong>Alatyr Hosting</strong></div>
        <div class="muted">Dodavatel</div>
        <div class="muted">Náves 73</div>
        <div class="muted">664 08 Blažovice</div>
        <div class="muted">Česká republika</div>
        <div class="muted">ID: 09992961</div>
        <div class="muted">info@alatyrhosting.eu</div>
        <div class="muted">Non-VAT payer</div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="section-title">Dodavatel</div>
        <div class="box">
          <div><strong>Alatyr Hosting</strong></div>
          <div>Náves 73</div>
          <div>664 08 Blažovice</div>
          <div>Česká republika</div>
          <div class="muted">ID: 09992961</div>
          <div class="muted">info@alatyrhosting.eu</div>
          <div class="muted">Non-VAT payer</div>
        </div>
      </div>
      <div class="party">
        <div class="section-title">Odběratel</div>
        <div class="box">
          <div><strong>${esc(billingCompany || customerName || '-')}</strong></div>
          ${billingAddress ? `<div>${esc(billingAddress)}</div>` : ''}
          ${billingIco ? `<div class="muted">IČO: ${esc(billingIco)}</div>` : ''}
          ${billingDic ? `<div class="muted">DIČ: ${esc(billingDic)}</div>` : ''}
          ${profile?.email ? `<div class="muted">${esc(profile.email)}</div>` : ''}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Položky</div>
      <table>
        <thead>
          <tr>
            <th>Položka</th>
            <th class="text-right">Množství</th>
            <th class="text-right">Cena</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${esc(order.plan_name || 'Hostingová služba')}${order.domain_name ? ` (${esc(order.domain_name)})` : ''}</td>
            <td class="text-right">1</td>
            <td class="text-right">${esc(amount.toLocaleString('cs-CZ', { style: 'currency', currency }))}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>Celkem k úhradě</td>
            <td></td>
            <td class="text-right">${esc(amount.toLocaleString('cs-CZ', { style: 'currency', currency }))}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <p class="muted">
      Tato faktura byla vygenerována automaticky systémem Alatyr Hosting.
    </p>

    <div class="no-print" style="text-align:center">
      <button class="print-btn" onclick="window.print()">Vytisknout / Uložit jako PDF</button>
    </div>
  </body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  })
);

/**
 * Update order (status, payment_status)
 * PUT /api/orders/:id
 * body: { status?, payment_status? }
 */
app.put('/api/orders/:id',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const orderId = validateNumericId(req.params.id);
    const { status, payment_status, gopay_status } = req.body || {};

    const order = await db.queryOne('SELECT id, user_id FROM user_orders WHERE id = ?', [orderId]);
    if (!order) throw new AppError('Order not found', 404);

    const isAdmin = !!req.user.is_admin;

    if (order.user_id !== req.user.id && !isAdmin) {
      throw new AppError('Forbidden', 403);
    }

    const updates = [];
    const values = [];
    const validStatus = ['pending', 'processing', 'active', 'cancelled', 'expired'];
    const validPaymentStatus = ['unpaid', 'paid', 'refunded', 'failed'];

    // SECURITY: status, payment_status a gopay_status může měnit POUZE admin
    // Běžný uživatel by si jinak mohl nastavit objednávku jako 'paid'/'active' a získat službu zadarmo
    if (status && validStatus.includes(status)) {
      if (!isAdmin) throw new AppError('Only admins can update order status', 403);
      updates.push('status = ?');
      values.push(status);
    }
    if (payment_status !== undefined && validPaymentStatus.includes(payment_status)) {
      if (!isAdmin) throw new AppError('Only admins can update payment status', 403);
      updates.push('payment_status = ?');
      values.push(payment_status);
    }
    if (gopay_status !== undefined && typeof gopay_status === 'string') {
      if (!isAdmin) throw new AppError('Only admins can update GoPay status', 403);
      updates.push('gopay_status = ?');
      values.push(gopay_status.trim());
    }
    // SECURITY: payment_id a payment_url může nastavit jen admin
    // (dříve mohl kdokoliv — riziko přesměrování na phishing payment page)
    const { payment_id, payment_url } = req.body || {};
    if (payment_id !== undefined && typeof payment_id === 'string') {
      if (!isAdmin) throw new AppError('Only admins can update payment ID', 403);
      updates.push('payment_id = ?');
      values.push(payment_id.trim());
    }
    if (payment_url !== undefined && typeof payment_url === 'string') {
      if (!isAdmin) throw new AppError('Only admins can update payment URL', 403);
      if (payment_url.trim() && !/^https?:\/\//i.test(payment_url.trim())) {
        throw new AppError('Invalid payment URL', 400);
      }
      updates.push('payment_url = ?');
      values.push(payment_url.trim());
    }
    if (updates.length === 0) throw new AppError('No valid fields to update', 400);
    values.push(orderId);
    await db.execute(
      `UPDATE user_orders SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    const updated = await db.queryOne('SELECT * FROM user_orders WHERE id = ?', [orderId]);
    res.json({ success: true, order: updated });
  })
);

/**
 * Get hosting services
 * GET /api/hosting-services
 * - admin: all services
 * - user: own services
 */
app.get('/api/hosting-services',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const isAdmin = !!req.user.is_admin;
    const { page, limit, offset } = parsePagination(req.query);

    let countQuery, dataQuery, params, countParams;

    if (isAdmin) {
      countQuery = 'SELECT COUNT(*) as total FROM user_hosting_services';
      dataQuery = `SELECT h.*, p.email AS user_email, p.first_name AS user_first_name, p.last_name AS user_last_name
         FROM user_hosting_services h LEFT JOIN profiles p ON p.id = h.user_id
         ORDER BY h.created_at DESC LIMIT ? OFFSET ?`;
      countParams = [];
      params = [limit, offset];
    } else {
      countQuery = 'SELECT COUNT(*) as total FROM user_hosting_services WHERE user_id = ?';
      dataQuery = 'SELECT * FROM user_hosting_services WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
      countParams = [req.user.id];
      params = [req.user.id, limit, offset];
    }

    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;
    const services = await db.query(dataQuery, params);

    res.json({
      success: true,
      services: services || [],
      pagination: paginationMeta(page, limit, total)
    });
  })
);

/**
 * Get active hosting services for current user
 * GET /api/hosting-services/active
 */
app.get('/api/hosting-services/active',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const services = await db.query(
      `SELECT * FROM user_hosting_services 
       WHERE user_id = ? AND status = 'active'
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      services: services || []
    });
  })
);

/**
 * Get hosting service by ID
 * GET /api/hosting-services/:id
 */
app.get('/api/hosting-services/:id',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const serviceId = validateNumericId(req.params.id);

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

    res.json({
      success: true,
      service
    });
  })
);

/**
 * Toggle auto-renewal for a hosting service
 * PUT /api/hosting-services/:id/auto-renewal
 * body: { auto_renewal: boolean, renewal_period?: 'monthly' | 'yearly' }
 */
app.put('/api/hosting-services/:id/auto-renewal',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const serviceId = validateNumericId(req.params.id);
    const { auto_renewal, renewal_period } = req.body || {};

    const service = await db.queryOne(
      'SELECT * FROM user_hosting_services WHERE id = ?',
      [serviceId]
    );

    if (!service) {
      throw new AppError('Service not found', 404);
    }

    // Ownership check
    if (service.user_id !== req.user.id && !req.user.is_admin) {
      throw new AppError('Forbidden', 403);
    }

    if (typeof auto_renewal !== 'boolean') {
      throw new AppError('auto_renewal must be boolean', 400);
    }

    const updates = ['auto_renewal = ?'];
    const values = [auto_renewal ? 1 : 0];

    if (renewal_period && ['monthly', 'yearly'].includes(renewal_period)) {
      updates.push('renewal_period = ?');
      values.push(renewal_period);
    }

    values.push(serviceId);

    await db.execute(
      `UPDATE user_hosting_services SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    const updated = await db.queryOne(
      'SELECT * FROM user_hosting_services WHERE id = ?',
      [serviceId]
    );

    res.json({
      success: true,
      service: updated,
    });
  })
);

/**
 * Job: renew hosting services that have auto_renewal enabled
 * This endpoint is intended to be called from cron (e.g. once per day).
 * POST /api/jobs/renew-services
 */
app.post('/api/jobs/renew-services',
  authenticateUser,
  asyncHandler(async (req, res) => {
    // Only admin can trigger this job
    if (!req.user.is_admin) {
      throw new AppError('Forbidden', 403);
    }

    // Services that:
    // - have auto_renewal = 1
    // - are active
    // - expire within next 7 days
    // - and haven't been renewed after last expires_at
    const servicesToRenew = await db.query(
      `SELECT h.*
       FROM user_hosting_services h
       WHERE h.auto_renewal = 1
         AND h.status = 'active'
         AND h.expires_at IS NOT NULL
         AND h.expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)
         AND (h.last_renewed_at IS NULL OR h.last_renewed_at < h.expires_at)`
    );

    const renewed = [];

    for (const service of servicesToRenew) {
      // Najdi poslední objednávku pro získání billing údajů
      const lastOrder = await db.queryOne(
        'SELECT * FROM user_orders WHERE id = ?',
        [service.order_id]
      );

      if (!lastOrder) {
        continue;
      }

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

      const newOrderId = insertResult.insertId;

      // Update service last_renewed_at (reálné prodloužení expirace provede až úspěšná platba)
      await db.execute(
        `UPDATE user_hosting_services
         SET last_renewed_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [service.id]
      );

      renewed.push({
        serviceId: service.id,
        newOrderId,
      });
    }

    // Notifikace o blížící se expiraci pro služby BEZ auto-renewal
    const expiringServices = await db.query(
      `SELECT h.*, p.email AS user_email
       FROM user_hosting_services h
       JOIN profiles p ON p.id = h.user_id
       WHERE h.auto_renewal = 0
         AND h.status = 'active'
         AND h.expires_at IS NOT NULL
         AND h.expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)
         AND h.expires_at > NOW()`
    );

    for (const svc of expiringServices) {
      if (svc.user_email) {
        sendServiceExpiringEmail(
          svc.user_email,
          svc.plan_name || 'Hosting',
          svc.hestia_domain,
          svc.expires_at
        ).catch(err => logger.error('Service expiring email failed', { error: err.message, serviceId: svc.id }));
      }
    }

    res.json({
      success: true,
      renewedCount: renewed.length,
      renewed,
      expiringNotified: expiringServices.length,
    });
  })
);

/**
 * Get hosting service real-time stats from HestiaCP
 * GET /api/hosting-services/:id/stats
 */
app.get('/api/hosting-services/:id/stats',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const serviceId = validateNumericId(req.params.id);

    const service = await db.queryOne(
      'SELECT * FROM user_hosting_services WHERE id = ?',
      [serviceId]
    );

    if (!service) {
      throw new AppError('Service not found', 404);
    }

    // Ownership check
    if (service.user_id !== req.user.id && !req.user.is_admin) {
      throw new AppError('Forbidden', 403);
    }

    // Pokud HestiaCP účet ještě nebyl vytvořen
    if (!service.hestia_username || !service.hestia_created) {
      return res.json({
        success: true,
        stats: null,
        message: 'HestiaCP account not yet created'
      });
    }

    // Zavolej HestiaCP API paralelně pro statistiky i info o uživateli
    const [statsResult, userResult] = await Promise.all([
      hestiacp.getUserStats(service.hestia_username),
      hestiacp.getUserInfo(service.hestia_username)
    ]);

    const stats = {
      disk_used_mb: statsResult.success ? statsResult.stats.disk_used_mb : 0,
      disk_limit_mb: userResult.success ? userResult.user.disk_quota_mb : (service.disk_space ? service.disk_space * 1024 : 0),
      bandwidth_used_mb: statsResult.success ? statsResult.stats.bandwidth_used_mb : 0,
      bandwidth_limit_mb: userResult.success ? userResult.user.bandwidth_limit_mb : (service.bandwidth ? service.bandwidth * 1024 : 0),
      email_accounts_used: statsResult.success ? statsResult.stats.mail_accounts : 0,
      email_accounts_limit: userResult.success ? userResult.user.mail_accounts_limit : (service.email_accounts || 0),
      databases_used: statsResult.success ? statsResult.stats.databases : 0,
      databases_limit: userResult.success ? userResult.user.databases_limit : (service.databases || 0),
      web_domains_used: statsResult.success ? statsResult.stats.web_domains : 0,
      web_domains_limit: userResult.success ? userResult.user.web_domains_limit : (service.domains || 0),
      suspended: userResult.success ? userResult.user.suspended : false,
    };

    res.json({
      success: true,
      stats,
      hestia_available: statsResult.success && userResult.success
    });
  })
);

/**
 * Get historical statistics for a service
 * GET /api/hosting-services/:id/statistics/history
 * Query params: ?period=24h|7d|30d|90d&metric=disk|bandwidth|all
 */
app.get('/api/hosting-services/:id/statistics/history',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const serviceId = validateNumericId(req.params.id);
    const period = req.query.period || '7d'; // 24h, 7d, 30d, 90d
    const metric = req.query.metric || 'all'; // disk, bandwidth, all

    const service = await db.queryOne(
      'SELECT * FROM user_hosting_services WHERE id = ?',
      [serviceId]
    );

    if (!service) {
      throw new AppError('Service not found', 404);
    }

    // Ownership check
    if (service.user_id !== req.user.id && !req.user.is_admin) {
      throw new AppError('Forbidden', 403);
    }

    // Calculate time range
    const periodMap = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    };
    const days = periodMap[period] || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build query based on metric
    let selectFields = '*';
    if (metric === 'disk') {
      selectFields = 'recorded_at, disk_used_mb';
    } else if (metric === 'bandwidth') {
      selectFields = 'recorded_at, bandwidth_used_mb';
    }

    const statistics = await db.query(
      `SELECT ${selectFields} FROM service_statistics 
       WHERE service_id = ? AND recorded_at >= ? 
       ORDER BY recorded_at ASC`,
      [serviceId, startDate]
    );

    res.json({
      success: true,
      statistics,
      period,
      metric
    });
  })
);

/**
 * Admin: Get platform overview statistics
 * GET /api/admin/statistics/overview
 */
app.get('/api/admin/statistics/overview',
  authenticateUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [
      totalServices,
      activeServices,
      totalUsers,
      totalTickets,
      totalRevenue,
      monthlyRevenue
    ] = await Promise.all([
      db.queryOne('SELECT COUNT(*) as count FROM user_hosting_services'),
      db.queryOne('SELECT COUNT(*) as count FROM user_hosting_services WHERE status = "active"'),
      db.queryOne('SELECT COUNT(*) as count FROM users'),
      db.queryOne('SELECT COUNT(*) as count FROM support_tickets'),
      db.queryOne('SELECT COALESCE(SUM(total_price), 0) as total FROM user_orders WHERE status = "completed"'),
      db.queryOne('SELECT COALESCE(SUM(total_price), 0) as total FROM user_orders WHERE status = "completed" AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)')
    ]);

    res.json({
      success: true,
      overview: {
        total_services: totalServices?.count || 0,
        active_services: activeServices?.count || 0,
        total_users: totalUsers?.count || 0,
        total_tickets: totalTickets?.count || 0,
        total_revenue: parseFloat(totalRevenue?.total || 0),
        monthly_revenue: parseFloat(monthlyRevenue?.total || 0)
      }
    });
  })
);

/**
 * Admin: Get service statistics summary
 * GET /api/admin/statistics/services
 */
app.get('/api/admin/statistics/services',
  authenticateUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const services = await db.query(
      `SELECT 
        uhs.id,
        uhs.plan_name,
        uhs.status,
        uhs.created_at,
        p.email as user_email,
        (SELECT disk_used_mb FROM service_statistics WHERE service_id = uhs.id ORDER BY recorded_at DESC LIMIT 1) as disk_used_mb,
        (SELECT bandwidth_used_mb FROM service_statistics WHERE service_id = uhs.id ORDER BY recorded_at DESC LIMIT 1) as bandwidth_used_mb
      FROM user_hosting_services uhs
      LEFT JOIN profiles p ON uhs.user_id = p.id
      WHERE uhs.hestia_created = 1
      ORDER BY uhs.created_at DESC
      LIMIT 100`
    );

    res.json({
      success: true,
      services
    });
  })
);

/**
 * Admin: update hosting service
 * PUT /api/hosting-services/:id
 */
app.put('/api/hosting-services/:id',
  authenticateUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const serviceId = validateNumericId(req.params.id);
    const updates = req.body || {};

    const allowedFields = [
      'status',
      'price',
      'billing_period',
      'disk_space',
      'bandwidth',
      'databases',
      'email_accounts',
      'domains',
      'ftp_host',
      'ftp_username',
      'db_host',
      'db_name',
      'notes',
      'hestia_username',
      'hestia_domain',
      'hestia_package',
      'hestia_created',
      'hestia_created_at',
      'hestia_error',
      'cpanel_url'
    ];

    const setParts = [];
    const values = [];

    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        setParts.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }

    if (setParts.length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    const updateQuery = `
      UPDATE user_hosting_services
      SET ${setParts.join(', ')}, updated_at = NOW()
      WHERE id = ?
    `;
    values.push(serviceId);

    await db.execute(updateQuery, values);

    const service = await db.queryOne(
      'SELECT * FROM user_hosting_services WHERE id = ?',
      [serviceId]
    );

    res.json({
      success: true,
      service
    });
  })
);

// ============================================
// FILE MANAGER API
// ============================================

/**
 * Pagination helper - parsuje page/limit z query params, vrací SQL LIMIT/OFFSET a metadata
 */
function parsePagination(query, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function paginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total
  };
}

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

// Rate limiter pro file operace (60 req/min)
const fileOpsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many file operations, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * List directory contents
 * GET /api/hosting-services/:serviceId/files/list
 */
app.get('/api/hosting-services/:serviceId/files/list',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const dirPath = sanitizeFilePath(
      req.query.path || `/home/${service.hestia_username}`,
      service.hestia_username
    );

    const result = await hestiacp.listDirectory(service.hestia_username, dirPath);
    if (!result.success) {
      throw new AppError(result.error || 'Failed to list directory', 502);
    }

    res.json({
      success: true,
      path: dirPath,
      entries: result.entries || []
    });
  })
);

/**
 * Read file content (text)
 * GET /api/hosting-services/:serviceId/files/read
 */
app.get('/api/hosting-services/:serviceId/files/read',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const filePath = sanitizeFilePath(req.query.path, service.hestia_username);

    const result = await hestiacp.readFile(service.hestia_username, filePath);
    if (!result.success) {
      throw new AppError(result.error || 'Failed to read file', 502);
    }

    // Kontrola velikosti pro editor (5 MB limit)
    const contentSize = Buffer.byteLength(result.content || '', 'utf-8');
    if (contentSize > 5 * 1024 * 1024) {
      return res.json({
        success: true,
        too_large: true,
        size: contentSize,
        path: filePath
      });
    }

    res.json({
      success: true,
      content: result.content,
      path: filePath,
      size: contentSize
    });
  })
);

/**
 * Download file
 * GET /api/hosting-services/:serviceId/files/download
 * SECURITY: Podporuje auth token z query parametru (pro direct download linky v <a href>)
 */
app.get('/api/hosting-services/:serviceId/files/download',
  // SECURITY: Vlastní auth middleware - podpora tokenu z query param pro download
  asyncHandler(async (req, res, next) => {
    // Pokud není auth header, zkus token z query (pro přímé stažení)
    if (!req.headers.authorization && req.query.token) {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
  }),
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const filePath = sanitizeFilePath(req.query.path, service.hestia_username);

    const result = await hestiacp.readFile(service.hestia_username, filePath);
    if (!result.success) {
      throw new AppError(result.error || 'Failed to download file', 502);
    }

    // SECURITY: Sanitize filename pro Content-Disposition header (prevence header injection)
    const rawFileName = path.posix.basename(filePath);
    const safeFileName = rawFileName.replace(/[^\w.\-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(result.content);
  })
);

// SECURITY: Route-specific larger body limit for file upload/save (base64-encoded files need >1MB)
const largeBodyParser = express.json({ limit: '10mb' });

/**
 * Save file content (create or overwrite)
 * POST /api/hosting-services/:serviceId/files/save
 */
app.post('/api/hosting-services/:serviceId/files/save',
  largeBodyParser,
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const { path: filePath, content } = req.body;

    if (!filePath || content === undefined) {
      throw new AppError('Path and content are required', 400);
    }

    // SECURITY: Validate types
    if (typeof filePath !== 'string' || typeof content !== 'string') {
      throw new AppError('Path and content must be strings', 400);
    }

    const safePath = sanitizeFilePath(filePath, service.hestia_username);

    // Kontrola velikosti
    const contentSize = Buffer.byteLength(content, 'utf-8');
    if (contentSize > 5 * 1024 * 1024) {
      throw new AppError('File content exceeds 5 MB limit', 413);
    }

    // Nejdřív vytvoř soubor (nebo přepiš)
    // HestiaCP v-add-fs-file vytvoří prázdný soubor
    // Pak zapíšeme obsah přes v-open-fs-file endpoint s content
    // POZNÁMKA: HestiaCP nemá přímý write příkaz, takže použijeme
    // kombinaci: vytvořit soubor + zapsat obsah přes API arg
    const createResult = await hestiacp.createFile(service.hestia_username, safePath);
    if (!createResult.success && !createResult.error?.includes('exists')) {
      throw new AppError(createResult.error || 'Failed to create file', 502);
    }

    // SECURITY: Zápis obsahu souboru přes base64 - zabraňuje command injection
    // Používáme printf + single-quoted shell string pro bezpečné předání base64 obsahu
    // a quoting cesty přes single quotes s escapováním existujících apostrofů
    const base64Content = Buffer.from(content, 'utf-8').toString('base64');

    // SECURITY: Validace base64 - smí obsahovat pouze [A-Za-z0-9+/=]
    if (!/^[A-Za-z0-9+/=]*$/.test(base64Content)) {
      throw new AppError('Internal encoding error', 500);
    }

    // SECURITY: Shell-safe path quoting — single quotes + escape apostrofů uvnitř
    const shellSafePath = "'" + safePath.replace(/'/g, "'\\''") + "'";

    const writeResult = await hestiacp.callAPI('v-run-cmd', [
      service.hestia_username,
      `printf '%s' '${base64Content}' | base64 -d > ${shellSafePath}`
    ]);

    if (!writeResult.success) {
      throw new AppError('Failed to write file content', 502);
    }

    res.json({ success: true, path: safePath });
  })
);

/**
 * Upload file (base64 encoded)
 * POST /api/hosting-services/:serviceId/files/upload
 */
app.post('/api/hosting-services/:serviceId/files/upload',
  largeBodyParser,
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const { path: dirPath, filename, content: base64Content } = req.body;

    if (!dirPath || !filename || !base64Content) {
      throw new AppError('Path, filename and content are required', 400);
    }

    // SECURITY: Validate filename - prevent path traversal and shell injection
    if (typeof filename !== 'string' || filename.length > 255 || filename.length === 0) {
      throw new AppError('Invalid filename (must be 1-255 characters)', 400);
    }
    if (/[/\\\0]/.test(filename) || filename.includes('..') || filename.startsWith('.')) {
      throw new AppError('Invalid filename', 400);
    }
    // Only allow safe filename characters
    if (!/^[\w.\- ]+$/.test(filename)) {
      throw new AppError('Filename contains invalid characters', 400);
    }

    const fullPath = sanitizeFilePath(
      path.posix.join(dirPath, filename),
      service.hestia_username
    );

    // SECURITY: Validate base64Content is actually a string
    if (typeof base64Content !== 'string') {
      throw new AppError('Content must be a base64 encoded string', 400);
    }

    // SECURITY: Reject suspiciously large base64 payloads before decoding (35MB base64 ≈ 25MB binary)
    if (base64Content.length > 35 * 1024 * 1024) {
      throw new AppError('File exceeds 25 MB upload limit', 413);
    }

    // Decode base64 a kontrola velikosti (25 MB limit)
    const fileBuffer = Buffer.from(base64Content, 'base64');
    if (fileBuffer.length > 25 * 1024 * 1024) {
      throw new AppError('File exceeds 25 MB upload limit', 413);
    }

    // Vytvoř soubor
    await hestiacp.createFile(service.hestia_username, fullPath);

    // SECURITY: Zapiš obsah přes base64
    // Re-encode the raw binary as base64 (requestBody base64Content is user input from FileReader)
    const uploadBase64 = fileBuffer.toString('base64');

    // SECURITY: Validace base64 obsahu
    if (!/^[A-Za-z0-9+/=]*$/.test(uploadBase64)) {
      throw new AppError('Internal encoding error', 500);
    }

    // SECURITY: Shell-safe path quoting
    const shellSafePath = "'" + fullPath.replace(/'/g, "'\\''") + "'";

    const writeResult = await hestiacp.callAPI('v-run-cmd', [
      service.hestia_username,
      `printf '%s' '${uploadBase64}' | base64 -d > ${shellSafePath}`
    ]);

    if (!writeResult.success) {
      throw new AppError('Failed to write uploaded file', 502);
    }

    res.json({ success: true, path: fullPath });
  })
);

/**
 * Create directory
 * POST /api/hosting-services/:serviceId/files/create-directory
 */
app.post('/api/hosting-services/:serviceId/files/create-directory',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const { path: dirPath } = req.body;

    if (!dirPath) {
      throw new AppError('Path is required', 400);
    }

    const safePath = sanitizeFilePath(dirPath, service.hestia_username);
    const result = await hestiacp.createDirectory(service.hestia_username, safePath);
    if (!result.success) {
      throw new AppError(result.error || 'Failed to create directory', 502);
    }

    res.json({ success: true, path: safePath });
  })
);

/**
 * Create empty file
 * POST /api/hosting-services/:serviceId/files/create-file
 */
app.post('/api/hosting-services/:serviceId/files/create-file',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const { path: filePath } = req.body;

    if (!filePath) {
      throw new AppError('Path is required', 400);
    }

    const safePath = sanitizeFilePath(filePath, service.hestia_username);
    const result = await hestiacp.createFile(service.hestia_username, safePath);
    if (!result.success) {
      throw new AppError(result.error || 'Failed to create file', 502);
    }

    res.json({ success: true, path: safePath });
  })
);

/**
 * Delete file or directory
 * DELETE /api/hosting-services/:serviceId/files/delete
 */
app.delete('/api/hosting-services/:serviceId/files/delete',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const { path: filePath, type } = req.body;

    if (!filePath || !type) {
      throw new AppError('Path and type are required', 400);
    }
    // SECURITY: Validate type to prevent unexpected values
    if (type !== 'file' && type !== 'directory') {
      throw new AppError('Type must be "file" or "directory"', 400);
    }

    const safePath = sanitizeFilePath(filePath, service.hestia_username);

    // SECURITY: Prevent deletion of home directory itself
    const homeDir = `/home/${service.hestia_username}`;
    if (safePath === homeDir) {
      throw new AppError('Cannot delete home directory', 403);
    }

    let result;
    if (type === 'directory') {
      result = await hestiacp.deleteDirectory(service.hestia_username, safePath);
    } else {
      result = await hestiacp.deleteFile(service.hestia_username, safePath);
    }

    if (!result.success) {
      throw new AppError(result.error || 'Failed to delete', 502);
    }

    res.json({ success: true });
  })
);

/**
 * Rename/move file or directory
 * POST /api/hosting-services/:serviceId/files/rename
 */
app.post('/api/hosting-services/:serviceId/files/rename',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const { fromPath, toPath } = req.body;

    if (!fromPath || !toPath) {
      throw new AppError('fromPath and toPath are required', 400);
    }
    if (typeof fromPath !== 'string' || typeof toPath !== 'string') {
      throw new AppError('fromPath and toPath must be strings', 400);
    }

    const safeFrom = sanitizeFilePath(fromPath, service.hestia_username);
    const safeTo = sanitizeFilePath(toPath, service.hestia_username);

    const result = await hestiacp.moveFile(service.hestia_username, safeFrom, safeTo);
    if (!result.success) {
      throw new AppError(result.error || 'Failed to rename', 502);
    }

    res.json({ success: true, path: safeTo });
  })
);

/**
 * Copy file
 * POST /api/hosting-services/:serviceId/files/copy
 */
app.post('/api/hosting-services/:serviceId/files/copy',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const { fromPath, toPath } = req.body;

    if (!fromPath || !toPath) {
      throw new AppError('fromPath and toPath are required', 400);
    }
    if (typeof fromPath !== 'string' || typeof toPath !== 'string') {
      throw new AppError('fromPath and toPath must be strings', 400);
    }

    const safeFrom = sanitizeFilePath(fromPath, service.hestia_username);
    const safeTo = sanitizeFilePath(toPath, service.hestia_username);

    const result = await hestiacp.copyFile(service.hestia_username, safeFrom, safeTo);
    if (!result.success) {
      throw new AppError(result.error || 'Failed to copy', 502);
    }

    res.json({ success: true, path: safeTo });
  })
);

/**
 * Change file permissions
 * POST /api/hosting-services/:serviceId/files/chmod
 */
app.post('/api/hosting-services/:serviceId/files/chmod',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const { path: filePath, permissions } = req.body;

    if (!filePath || !permissions) {
      throw new AppError('Path and permissions are required', 400);
    }

    if (!/^[0-7]{3,4}$/.test(permissions)) {
      throw new AppError('Invalid permissions format (use octal, e.g. 0755)', 400);
    }

    const safePath = sanitizeFilePath(filePath, service.hestia_username);
    const result = await hestiacp.changePermissions(service.hestia_username, safePath, permissions);
    if (!result.success) {
      throw new AppError(result.error || 'Failed to change permissions', 502);
    }

    res.json({ success: true });
  })
);

/**
 * ============================================
 * EMAIL MANAGEMENT
 * ============================================
 */

/**
 * Seznam všech email účtů pro službu
 * GET /api/hosting-services/:serviceId/emails
 */
app.get('/api/hosting-services/:serviceId/emails',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);

    if (!service.hestia_username || !service.hestia_created) {
      return res.json({
        success: true,
        emails: [],
        message: 'HestiaCP account not yet created'
      });
    }

    // Získej všechny web domény uživatele
    const domainsResult = await hestiacp.listWebDomains(service.hestia_username);
    
    if (!domainsResult.success) {
      throw new AppError('Failed to fetch domains', 502);
    }

    // Pro každou doménu získej email účty
    const allEmails = [];
    for (const domainInfo of domainsResult.domains || []) {
      const accountsResult = await hestiacp.listMailAccounts(service.hestia_username, domainInfo.domain);
      if (accountsResult.success && accountsResult.accounts) {
        for (const account of accountsResult.accounts) {
          allEmails.push({
            id: `${account.email}`,
            email: account.email,
            domain: domainInfo.domain,
            quota_used: account.quota_used,
            quota_limit: account.quota_limit,
            quota_percent: account.quota_limit > 0 
              ? Math.round((account.quota_used / account.quota_limit) * 100) 
              : 0,
            suspended: account.suspended,
          });
        }
      }
    }

    res.json({
      success: true,
      emails: allEmails
    });
  })
);

/**
 * Vytvoření nového email účtu
 * POST /api/hosting-services/:serviceId/emails
 */
app.post('/api/hosting-services/:serviceId/emails',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const { domain, email, password } = req.body || {};

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    // Validace
    if (!domain || typeof domain !== 'string') {
      throw new AppError('Domain is required', 400);
    }
    if (!email || typeof email !== 'string') {
      throw new AppError('Email is required', 400);
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new AppError('Password is required and must be at least 8 characters', 400);
    }

    // Validace email formátu
    const emailRegex = /^[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('Invalid email format', 400);
    }

    // Vytvoř email účet
    const result = await hestiacp.createMailAccount(
      service.hestia_username,
      domain,
      email,
      password
    );

    if (!result.success) {
      throw new AppError(result.error || 'Failed to create email account', 502);
    }

    res.json({
      success: true,
      message: 'Email account created successfully'
    });
  })
);

/**
 * Smazání email účtu
 * DELETE /api/hosting-services/:serviceId/emails/:emailId
 */
app.delete('/api/hosting-services/:serviceId/emails/:emailId',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const emailId = decodeURIComponent(req.params.emailId);

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    // Parse email (formát: email@domain nebo email)
    const emailParts = emailId.includes('@') ? emailId.split('@') : [emailId, ''];
    const emailLocal = emailParts[0];
    const domain = emailParts[1] || service.hestia_domain;

    if (!domain) {
      throw new AppError('Domain is required', 400);
    }

    const result = await hestiacp.deleteMailAccount(
      service.hestia_username,
      domain,
      emailLocal
    );

    if (!result.success) {
      throw new AppError(result.error || 'Failed to delete email account', 502);
    }

    res.json({
      success: true,
      message: 'Email account deleted successfully'
    });
  })
);

/**
 * Změna hesla email účtu
 * PUT /api/hosting-services/:serviceId/emails/:emailId/password
 */
app.put('/api/hosting-services/:serviceId/emails/:emailId/password',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const emailId = decodeURIComponent(req.params.emailId);
    const { password } = req.body || {};

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new AppError('Password is required and must be at least 8 characters', 400);
    }

    // Parse email
    const emailParts = emailId.includes('@') ? emailId.split('@') : [emailId, ''];
    const emailLocal = emailParts[0];
    const domain = emailParts[1] || service.hestia_domain;

    if (!domain) {
      throw new AppError('Domain is required', 400);
    }

    const result = await hestiacp.changeMailAccountPassword(
      service.hestia_username,
      domain,
      emailLocal,
      password
    );

    if (!result.success) {
      throw new AppError(result.error || 'Failed to change email password', 502);
    }

    res.json({
      success: true,
      message: 'Email password changed successfully'
    });
  })
);

/**
 * Quota email účtu
 * GET /api/hosting-services/:serviceId/emails/:emailId/quota
 */
app.get('/api/hosting-services/:serviceId/emails/:emailId/quota',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const emailId = decodeURIComponent(req.params.emailId);

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    // Parse email
    const emailParts = emailId.includes('@') ? emailId.split('@') : [emailId, ''];
    const emailLocal = emailParts[0];
    const domain = emailParts[1] || service.hestia_domain;

    if (!domain) {
      throw new AppError('Domain is required', 400);
    }

    const result = await hestiacp.getMailAccountQuota(
      service.hestia_username,
      domain,
      emailLocal
    );

    if (!result.success) {
      throw new AppError(result.error || 'Failed to get email quota', 502);
    }

    res.json({
      success: true,
      quota: result.quota
    });
  })
);

/**
 * ============================================
 * DOMAIN MANAGEMENT
 * ============================================
 */

/**
 * Seznam všech web domén pro službu
 * GET /api/hosting-services/:serviceId/domains
 */
app.get('/api/hosting-services/:serviceId/domains',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);

    if (!service.hestia_username || !service.hestia_created) {
      return res.json({
        success: true,
        domains: [],
        message: 'HestiaCP account not yet created'
      });
    }

    const result = await hestiacp.listWebDomains(service.hestia_username);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to list domains', 502);
    }

    res.json({
      success: true,
      domains: result.domains || []
    });
  })
);

/**
 * Informace o konkrétní doméně
 * GET /api/hosting-services/:serviceId/domains/:domain
 */
app.get('/api/hosting-services/:serviceId/domains/:domain',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const domain = decodeURIComponent(req.params.domain);

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    const result = await hestiacp.getWebDomainInfo(service.hestia_username, domain);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to get domain info', 502);
    }

    res.json({
      success: true,
      domain: result.domain
    });
  })
);

/**
 * ============================================
 * DATABASE MANAGEMENT
 * ============================================
 */

/**
 * Seznam všech databází pro službu
 * GET /api/hosting-services/:serviceId/databases
 */
app.get('/api/hosting-services/:serviceId/databases',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);

    if (!service.hestia_username || !service.hestia_created) {
      return res.json({
        success: true,
        databases: [],
        message: 'HestiaCP account not yet created'
      });
    }

    const result = await hestiacp.listDatabases(service.hestia_username);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to list databases', 502);
    }

    res.json({
      success: true,
      databases: result.databases || []
    });
  })
);

/**
 * Vytvoření nové databáze
 * POST /api/hosting-services/:serviceId/databases
 */
app.post('/api/hosting-services/:serviceId/databases',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const { database, dbuser, password } = req.body || {};

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    // Validace
    if (!database || typeof database !== 'string') {
      throw new AppError('Database name is required', 400);
    }
    if (!dbuser || typeof dbuser !== 'string') {
      throw new AppError('Database user is required', 400);
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new AppError('Password is required and must be at least 8 characters', 400);
    }

    // Validace názvu databáze (pouze alfanumerické znaky a podtržítka)
    if (!/^[a-zA-Z0-9_]+$/.test(database)) {
      throw new AppError('Database name can only contain letters, numbers and underscores', 400);
    }

    const result = await hestiacp.createDatabase(
      service.hestia_username,
      database,
      dbuser,
      password
    );

    if (!result.success) {
      throw new AppError(result.error || 'Failed to create database', 502);
    }

    res.json({
      success: true,
      message: 'Database created successfully'
    });
  })
);

/**
 * Smazání databáze
 * DELETE /api/hosting-services/:serviceId/databases/:database
 */
app.delete('/api/hosting-services/:serviceId/databases/:database',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const database = decodeURIComponent(req.params.database);

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    const result = await hestiacp.deleteDatabase(service.hestia_username, database);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to delete database', 502);
    }

    res.json({
      success: true,
      message: 'Database deleted successfully'
    });
  })
);

// ============================================
// DNS Management API Endpoints
// ============================================

/**
 * Seznam DNS domén pro službu
 * GET /api/hosting-services/:serviceId/dns/domains
 */
app.get('/api/hosting-services/:serviceId/dns/domains',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);

    if (!service.hestia_username || !service.hestia_created) {
      return res.json({ success: true, domains: [] });
    }

    const result = await hestiacp.listDnsDomains(service.hestia_username);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to list DNS domains', 502);
    }

    res.json({
      success: true,
      domains: result.domains || []
    });
  })
);

/**
 * Seznam DNS záznamů pro doménu
 * GET /api/hosting-services/:serviceId/dns/domains/:domain/records
 */
app.get('/api/hosting-services/:serviceId/dns/domains/:domain/records',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const domain = decodeURIComponent(req.params.domain);

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    const result = await hestiacp.listDnsRecords(service.hestia_username, domain);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to list DNS records', 502);
    }

    res.json({
      success: true,
      records: result.records || []
    });
  })
);

/**
 * Přidání DNS záznamu
 * POST /api/hosting-services/:serviceId/dns/domains/:domain/records
 */
app.post('/api/hosting-services/:serviceId/dns/domains/:domain/records',
  authenticateUser,
  requireCsrfGuard,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const domain = decodeURIComponent(req.params.domain);
    const { name, type, value, priority, ttl } = req.body;

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    if (!name || !type || !value) {
      throw new AppError('Name, type and value are required', 400);
    }

    // Validace typu DNS záznamu
    const validTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'];
    if (!validTypes.includes(type.toUpperCase())) {
      throw new AppError(`Invalid DNS record type. Valid types: ${validTypes.join(', ')}`, 400);
    }

    const result = await hestiacp.addDnsRecord(
      service.hestia_username,
      domain,
      name,
      type.toUpperCase(),
      value,
      priority || null,
      ttl || null
    );

    if (!result.success) {
      throw new AppError(result.error || 'Failed to add DNS record', 502);
    }

    res.json({
      success: true,
      message: 'DNS record added successfully'
    });
  })
);

/**
 * Smazání DNS záznamu
 * DELETE /api/hosting-services/:serviceId/dns/domains/:domain/records/:recordId
 */
app.delete('/api/hosting-services/:serviceId/dns/domains/:domain/records/:recordId',
  authenticateUser,
  requireCsrfGuard,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const domain = decodeURIComponent(req.params.domain);
    const recordId = decodeURIComponent(req.params.recordId);

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    const result = await hestiacp.deleteDnsRecord(service.hestia_username, domain, recordId);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to delete DNS record', 502);
    }

    res.json({
      success: true,
      message: 'DNS record deleted successfully'
    });
  })
);

/**
 * Přidání DNS domény
 * POST /api/hosting-services/:serviceId/dns/domains
 */
app.post('/api/hosting-services/:serviceId/dns/domains',
  authenticateUser,
  requireCsrfGuard,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const { domain, ip } = req.body;

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    if (!domain) {
      throw new AppError('Domain is required', 400);
    }

    const result = await hestiacp.addDnsDomain(service.hestia_username, domain, ip || null);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to add DNS domain', 502);
    }

    res.json({
      success: true,
      message: 'DNS domain added successfully'
    });
  })
);

/**
 * Smazání DNS domény
 * DELETE /api/hosting-services/:serviceId/dns/domains/:domain
 */
app.delete('/api/hosting-services/:serviceId/dns/domains/:domain',
  authenticateUser,
  requireCsrfGuard,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const domain = decodeURIComponent(req.params.domain);

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    const result = await hestiacp.deleteDnsDomain(service.hestia_username, domain);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to delete DNS domain', 502);
    }

    res.json({
      success: true,
      message: 'DNS domain deleted successfully'
    });
  })
);

// ============================================
// FTP Management API Endpoints
// ============================================

/**
 * Seznam FTP účtů pro službu (pro vybranou web doménu)
 * GET /api/hosting-services/:serviceId/ftp?domain=example.com
 */
app.get('/api/hosting-services/:serviceId/ftp',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const domain = req.query.domain || service.hestia_domain;

    if (!service.hestia_username || !service.hestia_created) {
      return res.json({ success: true, accounts: [] });
    }

    if (!domain) {
      return res.json({ success: true, accounts: [] });
    }

    const result = await hestiacp.listWebDomainFtp(service.hestia_username, domain);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to list FTP accounts', 502);
    }

    res.json({
      success: true,
      domain,
      accounts: result.accounts || []
    });
  })
);

/**
 * Přidání FTP účtu
 * POST /api/hosting-services/:serviceId/ftp
 */
app.post('/api/hosting-services/:serviceId/ftp',
  authenticateUser,
  requireCsrfGuard,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const { domain, username, password, path } = req.body;

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    const useDomain = domain || service.hestia_domain;
    if (!useDomain) {
      throw new AppError('Domain is required', 400);
    }

    if (!username || !password) {
      throw new AppError('Username and password are required', 400);
    }

    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    const result = await hestiacp.addWebDomainFtp(
      service.hestia_username,
      useDomain,
      username,
      password,
      path || 'public_html'
    );

    if (!result.success) {
      throw new AppError(result.error || 'Failed to add FTP account', 502);
    }

    res.json({
      success: true,
      message: 'FTP account created successfully'
    });
  })
);

/**
 * Smazání FTP účtu
 * DELETE /api/hosting-services/:serviceId/ftp/:domain/:ftpId
 */
app.delete('/api/hosting-services/:serviceId/ftp/:domain/:ftpId',
  authenticateUser,
  requireCsrfGuard,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const domain = decodeURIComponent(req.params.domain);
    const ftpId = decodeURIComponent(req.params.ftpId);

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    const result = await hestiacp.deleteWebDomainFtp(service.hestia_username, domain, ftpId);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to delete FTP account', 502);
    }

    res.json({
      success: true,
      message: 'FTP account deleted successfully'
    });
  })
);

/**
 * Změna hesla FTP účtu
 * PUT /api/hosting-services/:serviceId/ftp/:domain/:ftpId/password
 */
app.put('/api/hosting-services/:serviceId/ftp/:domain/:ftpId/password',
  authenticateUser,
  requireCsrfGuard,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const domain = decodeURIComponent(req.params.domain);
    const ftpId = decodeURIComponent(req.params.ftpId);
    const { password } = req.body;

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    if (!password || password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    const result = await hestiacp.changeWebDomainFtpPassword(
      service.hestia_username,
      domain,
      ftpId,
      password
    );

    if (!result.success) {
      throw new AppError(result.error || 'Failed to change FTP password', 502);
    }

    res.json({
      success: true,
      message: 'FTP password changed successfully'
    });
  })
);

// ============================================
// Backup Management API Endpoints
// ============================================

/**
 * Seznam záloh pro službu
 * GET /api/hosting-services/:serviceId/backups
 */
app.get('/api/hosting-services/:serviceId/backups',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);

    if (!service.hestia_username || !service.hestia_created) {
      return res.json({ success: true, backups: [] });
    }

    const result = await hestiacp.listBackups(service.hestia_username);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to list backups', 502);
    }

    res.json({
      success: true,
      backups: result.backups || []
    });
  })
);

/**
 * Vytvoření zálohy
 * POST /api/hosting-services/:serviceId/backups/create
 */
app.post('/api/hosting-services/:serviceId/backups/create',
  authenticateUser,
  requireCsrfGuard,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const { notify } = req.body;

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    const result = await hestiacp.createBackup(service.hestia_username, notify || false);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to create backup', 502);
    }

    res.json({
      success: true,
      message: 'Backup creation started successfully'
    });
  })
);

/**
 * Obnovení zálohy
 * POST /api/hosting-services/:serviceId/backups/:backupId/restore
 */
app.post('/api/hosting-services/:serviceId/backups/:backupId/restore',
  authenticateUser,
  requireCsrfGuard,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const backupId = decodeURIComponent(req.params.backupId);

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    const result = await hestiacp.restoreBackup(service.hestia_username, backupId);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to restore backup', 502);
    }

    res.json({
      success: true,
      message: 'Backup restoration started successfully'
    });
  })
);

/**
 * Smazání zálohy
 * DELETE /api/hosting-services/:serviceId/backups/:backupId
 */
app.delete('/api/hosting-services/:serviceId/backups/:backupId',
  authenticateUser,
  requireCsrfGuard,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const backupId = decodeURIComponent(req.params.backupId);

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    const result = await hestiacp.deleteBackup(service.hestia_username, backupId);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to delete backup', 502);
    }

    res.json({
      success: true,
      message: 'Backup deleted successfully'
    });
  })
);

// ============================================
// Cron Jobs Management API Endpoints
// ============================================

/**
 * Seznam cron jobů pro službu
 * GET /api/hosting-services/:serviceId/cron
 */
app.get('/api/hosting-services/:serviceId/cron',
  authenticateUser,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);

    if (!service.hestia_username || !service.hestia_created) {
      return res.json({ success: true, cronJobs: [] });
    }

    const result = await hestiacp.listCronJobs(service.hestia_username);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to list cron jobs', 502);
    }

    res.json({
      success: true,
      cronJobs: result.cronJobs || []
    });
  })
);

/**
 * Vytvoření cron jobu
 * POST /api/hosting-services/:serviceId/cron
 */
app.post('/api/hosting-services/:serviceId/cron',
  authenticateUser,
  requireCsrfGuard,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const { min, hour, day, month, weekday, command } = req.body;

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    if (!min || !hour || !day || !month || !weekday || !command) {
      throw new AppError('Missing required fields: min, hour, day, month, weekday, command', 400);
    }

    const result = await hestiacp.addCronJob(
      service.hestia_username,
      min,
      hour,
      day,
      month,
      weekday,
      command
    );

    if (!result.success) {
      throw new AppError(result.error || 'Failed to create cron job', 502);
    }

    res.json({
      success: true,
      message: 'Cron job created successfully'
    });
  })
);

/**
 * Smazání cron jobu
 * DELETE /api/hosting-services/:serviceId/cron/:jobId
 */
app.delete('/api/hosting-services/:serviceId/cron/:jobId',
  authenticateUser,
  requireCsrfGuard,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const jobId = decodeURIComponent(req.params.jobId);

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    const result = await hestiacp.deleteCronJob(service.hestia_username, jobId);

    if (!result.success) {
      throw new AppError(result.error || 'Failed to delete cron job', 502);
    }

    res.json({
      success: true,
      message: 'Cron job deleted successfully'
    });
  })
);

/**
 * Pozastavení/obnovení cron jobu
 * PUT /api/hosting-services/:serviceId/cron/:jobId/suspend
 */
app.put('/api/hosting-services/:serviceId/cron/:jobId/suspend',
  authenticateUser,
  requireCsrfGuard,
  fileOpsLimiter,
  asyncHandler(async (req, res) => {
    const service = await resolveServiceForFiles(req);
    const jobId = decodeURIComponent(req.params.jobId);
    const { suspend } = req.body;

    if (!service.hestia_username || !service.hestia_created) {
      throw new AppError('HestiaCP account not yet created', 400);
    }

    if (typeof suspend !== 'boolean') {
      throw new AppError('Missing or invalid suspend parameter', 400);
    }

    const result = await hestiacp.suspendCronJob(service.hestia_username, jobId, suspend);

    if (!result.success) {
      throw new AppError(result.error || `Failed to ${suspend ? 'suspend' : 'unsuspend'} cron job`, 502);
    }

    res.json({
      success: true,
      message: `Cron job ${suspend ? 'suspended' : 'unsuspended'} successfully`
    });
  })
);

/**
 * Admin: seznam HestiaCP balíčků (pro výběr při vytváření webu)
 * GET /api/admin/hestiacp-packages
 */
app.get('/api/admin/hestiacp-packages',
  authenticateUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await hestiacp.listPackages();
    if (!result.success) {
      return res.status(502).json({
        success: false,
        error: result.error || 'HestiaCP packages unavailable'
      });
    }
    res.json({ success: true, packages: result.packages || [] });
  })
);

/**
 * Admin: vytvořit novou hosting službu + HestiaCP účet bez nákupu/platby
 * POST /api/admin/create-hosting-service
 * body: { userId, domain, planId?, planName?, price?, hestiaPackage? }
 */
app.post('/api/admin/create-hosting-service',
  authenticateUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { userId, domain, planId, planName, price, hestiaPackage } = req.body || {};

    if (!userId || typeof userId !== 'string') {
      throw new AppError('userId is required', 400);
    }
    if (!domain || typeof domain !== 'string') {
      throw new AppError('domain is required', 400);
    }

    const userProfile = await db.queryOne(
      'SELECT email, first_name, last_name, hestia_username FROM profiles WHERE id = ?',
      [userId]
    );

    if (!userProfile) {
      throw new AppError('Target user not found', 404);
    }

    // Web se vytváří pro VYBRANÉHO uživatele (userId), ne pro admina. Použij jeho email a případně existující HestiaCP účet.

    const effectivePlanId = planId || 'admin_custom';
    const effectivePlanName = planName || 'Admin Webhosting';
    const effectivePrice = typeof price === 'number' && !Number.isNaN(price) ? price : 0;
    const hestiaPkg = (typeof hestiaPackage === 'string' && hestiaPackage.trim()) ? hestiaPackage.trim() : (process.env.HESTIACP_DEFAULT_PACKAGE || 'default');

    // 1) vytvoř objednávku v user_orders (okamžitě aktivní a zaplacená)
    const orderResult = await db.execute(
      `INSERT INTO user_orders (
         user_id, plan_id, plan_name, price, currency,
         billing_email, billing_name,
         customer_email, customer_name,
         status, payment_status,
         domain_name
       ) VALUES (?, ?, ?, ?, 'CZK', ?, ?, ?, ?, 'active', 'paid', ?)`,
      [
        userId,
        effectivePlanId,
        effectivePlanName,
        effectivePrice,
        userProfile.email,
        `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || userProfile.email,
        userProfile.email,
        `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || userProfile.email,
        domain
      ]
    );

    const orderId = orderResult.insertId;

    // 2) vytvoř hosting službu navázanou na tuto objednávku
    const serviceResult = await db.execute(
      `INSERT INTO user_hosting_services (
         user_id, order_id,
         plan_name, plan_id,
         status, price, billing_period,
         activated_at, expires_at, next_billing_date
       ) VALUES (
         ?, ?, ?, ?, 'pending', ?, 'monthly',
         NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY)
       )`,
      [
        userId,
        orderId,
        effectivePlanName,
        effectivePlanId,
        effectivePrice
      ]
    );

    const serviceId = serviceResult.insertId;

    // 3) Vytvoř v HestiaCP web pro tohoto uživatele: pokud už má hestia_username (z přihlášení), přidej jen doménu; jinak vytvoř nový HestiaCP účet + doménu
    const hestiaResult = await hestiacp.createHostingAccount({
      email: userProfile.email,
      domain,
      package: hestiaPkg,
      username: userProfile.hestia_username || undefined
    });

    if (!hestiaResult.success) {
      // Ulož chybu k službě, ale vrať 200 s warningem
      await db.execute(
        `UPDATE user_hosting_services 
         SET hestia_created = FALSE,
             hestia_error = ?
         WHERE id = ?`,
        [hestiaResult.error || 'Unknown HestiaCP error', serviceId]
      );

      return res.status(200).json({
        success: false,
        warning: 'Služba byla vytvořena, ale HestiaCP účet se nepodařilo založit',
        hestiaError: hestiaResult.error
      });
    }

    // 4) aktualizuj službu s HestiaCP údaji
    await db.execute(
      `UPDATE user_hosting_services 
       SET hestia_username = ?,
           hestia_domain = ?,
           hestia_package = ?,
           hestia_created = TRUE,
           hestia_created_at = NOW(),
           cpanel_url = ?,
           status = 'active'
       WHERE id = ?`,
      [
        hestiaResult.username,
        hestiaResult.domain || domain,
        hestiaResult.package || hestiaPkg,
        hestiaResult.cpanelUrl || null,
        serviceId
      ]
    );

    // 5) propoj profil vybraného uživatele s HestiaCP účtem (aby měl hestia_username pro přihlášení / Moje služby)
    await db.execute(
      'UPDATE profiles SET hestia_username = ?, hestia_created = TRUE, hestia_error = NULL WHERE id = ?',
      [hestiaResult.username, userId]
    );

    const service = await db.queryOne(
      'SELECT * FROM user_hosting_services WHERE id = ?',
      [serviceId]
    );

    res.status(201).json({
      success: true,
      service,
      orderId,
      hestia: {
        username: hestiaResult.username,
        domain: hestiaResult.domain || domain,
        cpanelUrl: hestiaResult.cpanelUrl,
        package: hestiaResult.package || effectivePlanId
      }
    });
  })
);

/**
 * Admin: get all tickets with user info
 * GET /api/admin/tickets
 */
app.get('/api/admin/tickets',
  authenticateUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);

    const countResult = await db.query('SELECT COUNT(*) as total FROM support_tickets');
    const total = countResult[0]?.total || 0;

    const tickets = await db.query(
      `SELECT t.*, p.email AS user_email, p.first_name, p.last_name
       FROM support_tickets t LEFT JOIN profiles p ON p.id = t.user_id
       ORDER BY t.created_at DESC LIMIT ? OFFSET ?`, [limit, offset]
    );

    const formatted = (tickets || []).map(t => ({
      id: t.id,
      user_id: t.user_id,
      subject: t.subject,
      message: t.message,
      status: t.status,
      priority: t.priority,
      category: t.category,
      assigned_to: t.assigned_to,
      last_reply_at: t.last_reply_at,
      created_at: t.created_at,
      user_email: t.user_email,
      user_name: `${t.first_name || ''} ${t.last_name || ''}`.trim(),
      assigned_name: undefined
    }));

    res.json({
      success: true,
      tickets: formatted,
      pagination: paginationMeta(page, limit, total)
    });
  })
);

// ============================================
// Health Check Endpoint
// ============================================

// ============================================
// PUBLIC: Domain availability search (Wedos WAPI + DNS fallback)
// ============================================
const dns = require('dns');
const { promisify } = require('util');
const crypto = require('crypto');
const dnsResolveNs = promisify(dns.resolveNs);

// Domain pricing (CZK/year)
const DOMAIN_PRICES = {
  '.cz': '249 Kč', '.com': '299 Kč', '.eu': '199 Kč', '.sk': '349 Kč',
  '.net': '349 Kč', '.org': '349 Kč', '.info': '299 Kč', '.online': '149 Kč',
  '.store': '149 Kč', '.shop': '149 Kč'
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
    return { domain, available: false, error: 'Nepodařilo se ověřit dostupnost' };
  }
}

app.post('/api/domains/check', rateLimit({ windowMs: 60000, max: 20, message: { success: false, error: 'Příliš mnoho požadavků. Zkuste to za minutu.' } }), asyncHandler(async (req, res) => {
  const { domains } = req.body;

  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({ success: false, error: 'Zadejte alespoň jednu doménu.' });
  }

  if (domains.length > 15) {
    return res.status(400).json({ success: false, error: 'Maximálně 15 domén najednou.' });
  }

  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
  for (const d of domains) {
    if (!domainRegex.test(d)) {
      return res.status(400).json({ success: false, error: `Neplatný formát domény: ${d}` });
    }
  }

  // Try Wedos WAPI first (more accurate WHOIS), fall back to DNS
  let wapiResults = null;
  if (process.env.WEDOS_WAPI_LOGIN && process.env.WEDOS_WAPI_PASSWORD) {
    wapiResults = await checkDomainsWapi(domains);
  }

  const results = await Promise.all(domains.map(async (domain) => {
    const ext = '.' + domain.split('.').slice(1).join('.');
    const price = DOMAIN_PRICES[ext] || '399 Kč';

    // Use WAPI result if available
    if (wapiResults) {
      const wapiResult = wapiResults.find(r => r.domain === domain);
      if (wapiResult) {
        const statusText = wapiResult.status === 'quarantined' ? 'V karanténě' :
                          wapiResult.status === 'reserved' ? 'Rezervovaná' :
                          wapiResult.status === 'blocked' ? 'Blokovaná' : undefined;
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
}));

/**
 * Health check endpoint
 * BUG FIX: Wrapped in asyncHandler to properly catch errors
 * BUG FIX: Status musí odpovídat skutečnému stavu databáze
 */
app.get('/health', asyncHandler(async (req, res) => {
  // Zkontroluj MySQL připojení
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

  // BUG FIX: Status musí odpovídat skutečnému stavu - pokud databáze není připojena, status není 'ok'
  const overallStatus = mysqlStatus === 'connected' ? 'ok' : 'error';
  
  // BUG FIX: HTTP status code musí odpovídat skutečnému stavu
  // 200 = healthy, 503 = service unavailable (databáze není připojena)
  const httpStatus = mysqlStatus === 'connected' ? 200 : 503;

  // SECURITY: V produkci neskrývat citlivé informace
  const healthResponse = {
    status: overallStatus,
    database: {
      mysql: mysqlStatus
    }
  };
  
  // V development módu přidat error message
  if (process.env.NODE_ENV !== 'production' && mysqlError) {
    healthResponse.database.mysql_error = mysqlError;
  }

  // V development módu přidat více informací
  if (process.env.NODE_ENV !== 'production') {
    healthResponse.database.mysql_host = process.env.MYSQL_HOST || 'not configured';
    healthResponse.database.mysql_database = process.env.MYSQL_DATABASE || 'not configured';
    healthResponse.gopay_environment = process.env.GOPAY_ENVIRONMENT || 'SANDBOX';
    healthResponse.hestiacp_configured = !!(process.env.HESTIACP_URL && process.env.HESTIACP_ACCESS_KEY);
    healthResponse.jwt_auth_configured = !!(process.env.JWT_SECRET);
  } else {
    // V produkci pouze základní status
    healthResponse.hestiacp_configured = !!(process.env.HESTIACP_URL && process.env.HESTIACP_ACCESS_KEY);
    healthResponse.jwt_auth_configured = !!(process.env.JWT_SECRET);
  }

  // BUG FIX: Vrátit správný HTTP status code podle stavu databáze
  res.status(httpStatus).json(healthResponse);
}));

/**
 * Liveness probe – proces běží (bez kontroly DB).
 * Pro Kubernetes/Docker: GET /health/live
 */
app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * Readiness probe – aplikace je připravena přijímat traffic (kontrola DB).
 * Pro Kubernetes/Docker: GET /health/ready
 */
app.get('/health/ready', asyncHandler(async (req, res) => {
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

  // Handle React routing - return all requests to React app
  // (API routes are handled above, so they won't reach here)
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
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
