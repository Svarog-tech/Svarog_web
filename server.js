const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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

// ============================================
// SECURITY: Helmet.js - Security Headers
// ============================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// ============================================
// SECURITY: Rate Limiting
// ============================================
// Obecný rate limiter pro všechny requesty
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 100, // max 100 requestů za 15 minut
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
    // SECURITY: V produkci nepovoluj requesty bez origin
    if (!origin) {
      // Povolit bez origin pouze když je explicitně development (ne undefined, test, atd.)
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      // V produkci i při NODE_ENV !== 'development' (včetně undefined) zamítni
      return callback(new Error('Origin required in production'));
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
app.use(express.json({ limit: '10mb' })); // Omezení na 10MB
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
    // Zkontroluj admin práva v MySQL databázi (HestiaCP)
    const profile = await db.queryOne(
      'SELECT is_admin FROM profiles WHERE id = ?',
      [req.user.id]
    );

    // MySQL může vracet is_admin jako 0/1 (number) nebo string; považuj za admin když je truthy
    const isAdmin = profile && (profile.is_admin === 1 || profile.is_admin === true || profile.is_admin === '1');
    if (!isAdmin) {
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
const GOPAY_API_URL = process.env.REACT_APP_GOPAY_ENVIRONMENT === 'PRODUCTION'
  ? 'https://gate.gopay.cz/api'
  : 'https://gw.sandbox.gopay.com/api';

const GOPAY_CLIENT_ID = process.env.REACT_APP_GOPAY_CLIENT_ID;
const GOPAY_CLIENT_SECRET = process.env.REACT_APP_GOPAY_CLIENT_SECRET;
const GOPAY_GO_ID = process.env.REACT_APP_GOPAY_GO_ID;

/**
 * Získání OAuth access tokenu
 */
async function getAccessToken() {
  const credentials = Buffer.from(`${GOPAY_CLIENT_ID}:${GOPAY_CLIENT_SECRET}`).toString('base64');

  const res = await fetch(`${GOPAY_API_URL}/oauth2/token`, {
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

    const response = await fetch(`${GOPAY_API_URL}/payments/payment`, {
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

    // Aktualizuj objednávku v MySQL (HestiaCP databáze)
    try {
      const updateFields = [
        'payment_status = ?',
        'gopay_status = ?',
        'payment_id = ?'
      ];
      const updateValues = [paymentStatus, paymentState, paymentId];

      if (isPaid) {
        updateFields.push('payment_date = NOW()');
        // Pokud je platba zaplacená, aktualizuj také status na 'active'
        updateFields.push('status = ?');
        updateValues.push('active');
      }

      updateValues.push(order.id); // WHERE id = ?

      const updateQuery = `
        UPDATE user_orders 
        SET ${updateFields.join(', ')} 
        WHERE id = ?
      `;

      await db.execute(updateQuery, updateValues);

      logger.request(req, 'GoPay webhook - order updated', {
        orderId: order.id,
        paymentStatus,
        gopayStatus: paymentState
      });
    } catch (updateError) {
      logger.errorRequest(req, updateError, { context: 'webhook_order_update' });
      // BUG FIX: Nevyhazuj chybu - vždy vraťme 200, aby GoPay neopakoval webhook
      // Chyba je zalogována, ale webhook musí vrátit 200
      // return res.status(200).json({ success: false, error: 'Failed to update order' });
      // Pokračujeme dál - webhook vrátí 200 na konci
    }

    // Pokud je platba zaplacená, můžeme aktivovat službu
    if (isPaid && order.payment_status !== 'paid') {
      logger.request(req, 'Payment confirmed, activating service', { orderId: order.id });
      
      try {
        // Zkontroluj, jestli už není hosting služba vytvořena
        const existingService = await db.queryOne(
          'SELECT * FROM user_hosting_services WHERE order_id = ?',
          [order.id]
        );

        if (!existingService) {
          // Vytvoř hosting službu v databázi
          const serviceResult = await db.execute(
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

          // Vytvoř HestiaCP účet (asynchronně, aby webhook odpověděl rychle).
          // TODO: setImmediate nemá garanci dokončení při restartu – v produkci použít queue (Bull, RabbitMQ)
          // a po 200 odpovědi job zpracovat; jinak může být účet nevytvořen a webhook už neopakuje.
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
                  const hestiaResult = await hestiacp.createHostingAccount({
                    email: userEmail,
                    domain: order.domain_name || `${order.id}.alatyr.cz`,
                    package: order.plan_id,
                    username: username
                  });

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
      } catch (error) {
        logger.errorRequest(req, error, { context: 'webhook_service_activation' });
        // Necháme webhook projít, i když aktivace selhala
      }
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
 * SECURITY: Vyžaduje autentizaci
 */
app.post('/api/gopay/check-payment', 
  authenticateUser, 
  validateCheckPayment,
  asyncHandler(async (req, res) => {
    const { paymentId } = req.body;
    logger.request(req, 'Checking payment status', { paymentId });

    const accessToken = await getAccessToken();

    const response = await fetch(`${GOPAY_API_URL}/payments/payment/${paymentId}`, {
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
 * SECURITY: Vyžaduje autentizaci
 */
app.post('/api/hestiacp/create-account', 
  authenticateUser, 
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

    res.json({
      success: true,
      username: result.username,
      password: result.password,
      domain: result.domain,
      cpanelUrl: result.cpanelUrl,
      package: result.package
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

    const result = await authService.register(email, password, firstName, lastName);

    if (result.success) {
      logger.request(req, 'User registered successfully', { userId: result.user.id });
      res.status(201).json({
        success: true,
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
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
    
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email a heslo jsou povinné', 400);
    }

    const result = await authService.login(email, password);

    if (result.success) {
      logger.request(req, 'User logged in successfully', { userId: result.user.id });
      res.json({
        success: true,
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
    } else {
      logger.warn('Login failed', { requestId: req.id, email });
      throw new AppError(result.error || 'Nesprávný email nebo heslo', 401);
    }
  })
);

/**
 * Refresh access token
 */
app.post('/api/auth/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token je povinný', 400);
    }

    const result = await authService.refreshAccessToken(refreshToken);

    if (result.success) {
      res.json({
        success: true,
        accessToken: result.accessToken,
        user: result.user
      });
    } else {
      throw new AppError(result.error || 'Neplatný refresh token', 401);
    }
  })
);

/**
 * Odhlášení uživatele
 */
app.post('/api/auth/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    res.json({ success: true, message: 'Odhlášení úspěšné' });
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
        updated_at: fullUser.updated_at
      }
    });
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
 * Změna hesla přihlášeného uživatele
 */
app.post('/api/auth/change-password',
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

    // Send Discord notification (non-blocking)
    if (userResult) {
      const fullName = [userResult.first_name, userResult.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();

      discordService.sendTicketNotification({
        ticketId: ticketId,
        name: fullName || userResult.email || 'Unknown',
        email: userResult.email || 'Unknown',
        subject: subjectTrimmed,
        message: messageTrimmed,
        priority: ticketPriority,
        category: ticketCategory
      }).catch(error => {
        // Log error but don't fail the request (Winston expects message + structured meta)
        logger.error('Failed to send Discord notification', { error: error?.message || String(error) });
      });
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

    const query = `
      SELECT
        id,
        subject,
        message,
        status,
        priority,
        category,
        created_at,
        updated_at,
        last_reply_at,
        resolved_at
      FROM support_tickets
      WHERE user_id = ?
      ORDER BY created_at DESC
    `;

    const tickets = await db.query(query, [userId]);

    logger.info(`Retrieved ${tickets.length} tickets for user ${userId}`, {
      requestId: req.id,
      userId,
      ticketCount: tickets.length
    });

    res.json({
      success: true,
      tickets: tickets || []
    });
  })
);

/**
 * Get a specific ticket by ID
 * GET /api/tickets/:id
 * Protected route - requires authentication
 */
app.get('/api/tickets/:id',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const ticketId = req.params.id;
    const userId = req.user.id;

    const query = `
      SELECT
        id,
        subject,
        message,
        status,
        priority,
        category,
        created_at,
        updated_at,
        last_reply_at,
        resolved_at
      FROM support_tickets
      WHERE id = ? AND user_id = ?
    `;

    const ticket = await db.queryOne(query, [ticketId, userId]);

    if (!ticket) {
      throw new AppError('Ticket not found', 404);
    }

    logger.info(`Retrieved ticket #${ticketId} for user ${userId}`, {
      requestId: req.id,
      ticketId,
      userId
    });

    res.json({
      success: true,
      ticket
    });
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
    const rows = await db.query(
      `SELECT 
         u.id,
         u.email,
         u.email_verified,
         u.created_at,
         u.last_login,
         p.first_name,
         p.last_name,
         p.is_admin
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       ORDER BY u.created_at DESC`
    );

    const users = (rows || []).map(row => ({
      id: row.id,
      email: row.email,
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      is_admin: !!row.is_admin,
      email_verified: !!row.email_verified,
      created_at: row.created_at,
      last_login: row.last_login
    }));

    res.json({
      success: true,
      users
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

    if (req.user.id !== targetUserId) {
      // Only admins can access other users' profiles
      const adminProfile = await db.queryOne(
        'SELECT is_admin FROM profiles WHERE id = ?',
        [req.user.id]
      );
      if (!adminProfile || !adminProfile.is_admin) {
        throw new AppError('Forbidden', 403);
      }
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
    const { userId, firstName, lastName, phone, company, avatarUrl, newsletter } = req.body || {};
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
    if (typeof avatarUrl === 'string') {
      fields.push('avatar_url = ?');
      values.push(avatarUrl);
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

    const insertResult = await db.execute(
      `INSERT INTO user_orders (
         user_id, plan_id, plan_name, price, currency,
         billing_email, billing_name, billing_company, billing_address, billing_phone,
         customer_email, customer_name,
         status, payment_status,
         domain_name
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?)`,
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
 * Admin: get all orders
 * GET /api/orders
 */
app.get('/api/orders',
  authenticateUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const orders = await db.query(
      'SELECT * FROM user_orders ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      orders: orders || []
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

    if (targetUserId !== req.user.id) {
      // Only admins can read other users' orders
      const adminProfile = await db.queryOne(
        'SELECT is_admin FROM profiles WHERE id = ?',
        [req.user.id]
      );
      if (!adminProfile || !adminProfile.is_admin) {
        throw new AppError('Forbidden', 403);
      }
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
    const orderId = req.params.id;

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
    if (order.user_id !== req.user.id) {
      const adminProfile = await db.queryOne(
        'SELECT is_admin FROM profiles WHERE id = ?',
        [req.user.id]
      );
      if (!adminProfile || !adminProfile.is_admin) {
        throw new AppError('Forbidden', 403);
      }
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
 * Get hosting services
 * GET /api/hosting-services
 * - admin: all services
 * - user: own services
 */
app.get('/api/hosting-services',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const isAdminRow = await db.queryOne(
      'SELECT is_admin FROM profiles WHERE id = ?',
      [req.user.id]
    );
    const isAdmin = !!(isAdminRow && isAdminRow.is_admin);

    let services;
    if (isAdmin) {
      services = await db.query(
        'SELECT * FROM user_hosting_services ORDER BY created_at DESC'
      );
    } else {
      services = await db.query(
        'SELECT * FROM user_hosting_services WHERE user_id = ? ORDER BY created_at DESC',
        [req.user.id]
      );
    }

    res.json({
      success: true,
      services: services || []
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
    const serviceId = req.params.id;

    const service = await db.queryOne(
      'SELECT * FROM user_hosting_services WHERE id = ?',
      [serviceId]
    );

    if (!service) {
      throw new AppError('Service not found', 404);
    }

    if (service.user_id !== req.user.id) {
      const adminProfile = await db.queryOne(
        'SELECT is_admin FROM profiles WHERE id = ?',
        [req.user.id]
      );
      if (!adminProfile || !adminProfile.is_admin) {
        throw new AppError('Forbidden', 403);
      }
    }

    res.json({
      success: true,
      service
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
    const serviceId = req.params.id;
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

/**
 * Admin: vytvořit novou hosting službu + HestiaCP účet bez nákupu/platby
 * POST /api/admin/create-hosting-service
 * body: { userId, domain, planId?, planName?, price? }
 */
app.post('/api/admin/create-hosting-service',
  authenticateUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { userId, domain, planId, planName, price } = req.body || {};

    if (!userId || typeof userId !== 'string') {
      throw new AppError('userId is required', 400);
    }
    if (!domain || typeof domain !== 'string') {
      throw new AppError('domain is required', 400);
    }

    const userProfile = await db.queryOne(
      'SELECT email, first_name, last_name FROM profiles WHERE id = ?',
      [userId]
    );

    if (!userProfile) {
      throw new AppError('Target user not found', 404);
    }

    const effectivePlanId = planId || 'admin_custom';
    const effectivePlanName = planName || 'Admin Webhosting';
    const effectivePrice = typeof price === 'number' && !Number.isNaN(price) ? price : 0;

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

    // 3) vytvoř HestiaCP účet přes backend service
    const hestiaResult = await hestiacp.createHostingAccount({
      email: userProfile.email,
      domain,
      package: effectivePlanId
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
        hestiaResult.package || effectivePlanId,
        hestiaResult.cpanelUrl || null,
        serviceId
      ]
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
    const tickets = await db.query(
      `SELECT 
         t.*,
         p.email AS user_email,
         p.first_name,
         p.last_name
       FROM support_tickets t
       LEFT JOIN profiles p ON p.id = t.user_id
       ORDER BY t.created_at DESC`
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
      tickets: formatted
    });
  })
);

// ============================================
// Health Check Endpoint
// ============================================

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
    healthResponse.gopay_environment = process.env.REACT_APP_GOPAY_ENVIRONMENT || 'SANDBOX';
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

// ============================================
// Serve React Build (Production)
// MUST BE LAST - after all API routes
// ============================================
if (process.env.NODE_ENV === 'production') {
  // Serve static files from React build
  app.use(express.static(path.join(__dirname, 'build')));
  
  // Handle React routing - return all requests to React app
  // (API routes are handled above, so they won't reach here)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// ============================================
// Error Handler (MUST BE LAST)
// ============================================
app.use(notFoundHandler); // 404 handler
app.use(errorHandler); // Global error handler

app.listen(PORT, async () => {
  console.log('================================================');
  console.log('  GoPay & HestiaCP Proxy Server');
  console.log('================================================');
  // Test MySQL připojení
  let mysqlStatus = '❌ Not connected';
  try {
    await db.query('SELECT 1 as test');
    mysqlStatus = '✅ Connected';
    logger.info('MySQL connection successful');
  } catch (error) {
    logger.error('MySQL connection failed', { error: error.message });
    console.error('❌ MySQL connection failed:', error.message);
  }

  logger.info('Server starting', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    mysqlStatus
  });

  console.log(`Server běží na: http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`GoPay Environment: ${process.env.REACT_APP_GOPAY_ENVIRONMENT || 'SANDBOX'}`);
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
  console.log('');
  console.log('HestiaCP Status:', process.env.HESTIACP_URL ? '✅ Configured' : '❌ Not configured');
  console.log('================================================');
});
