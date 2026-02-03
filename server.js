const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
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
      // V development módu povolujeme (pro testování)
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      // V produkci zamítni
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

    if (!profile || !profile.is_admin) {
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
    
    // Pokud stále není email, použij prázdný string (GoPay API může vyžadovat email)
    customerEmail = customerEmail || '';
    
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
 * BUG FIX: express-validator 7.x validátory musí používat .run(req) metodu
 */
const validateWebhookSafe = async (req, res, next) => {
  try {
    // BUG FIX: express-validator 7.x validátory musí používat .run(req) metodu
    // Spusť všechny validátory z validateWebhook
    for (const validator of validateWebhook) {
      // express-validator 7.x validátory mají .run(req) metodu
      if (typeof validator.run === 'function') {
        await validator.run(req);
      } else {
        // Pokud to není validátor s .run(), zkus jako middleware (fallback)
        await new Promise((resolve, reject) => {
          try {
            const result = validator(req, res, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
            
            // Pokud middleware vrací Promise
            if (result && typeof result.catch === 'function') {
              result.then(() => resolve()).catch(reject);
            } else if (result === undefined) {
              // Synchronní middleware dokončil
              resolve();
            }
          } catch (syncError) {
            reject(syncError);
          }
        });
      }
    }
    
    // Zkontroluj výsledky validace pomocí validationResult
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
  async (req, res) => {
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
      
      // BUG FIX: Zkontroluj, zda clientIp je validní IP adresa před voláním ipRangeCheck
      // ipRangeCheck může selhat nebo vrátit neočekávané výsledky s nevalidními hodnotami
      const isValidIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(clientIp) || 
                       /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(clientIp); // IPv4 nebo IPv6
      
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
        'transaction_id = ?'
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

          // Vytvoř HestiaCP účet (asynchronně, aby webhook odpověděl rychle)
          // POZNÁMKA: V produkci byste měli použít queue systém (např. Bull, RabbitMQ)
          setImmediate(async () => {
            try {
              const userProfile = await db.queryOne(
                'SELECT email, first_name, last_name FROM profiles WHERE id = ?',
                [order.user_id]
              );

              if (userProfile) {
                // BUG FIX: Zkontroluj, zda email není null nebo undefined před split
                const userEmail = userProfile.email || order.billing_email;
                // BUG FIX: Zkontroluj, zda order.user_id není null nebo undefined před substring
                const userId = order.user_id || order.id || 'unknown';
                const userIdStr = typeof userId === 'string' ? userId : userId.toString();
                const username = userEmail && userEmail.includes('@') 
                  ? userEmail.split('@')[0] 
                  : `user${userIdStr.substring(0, 8)}`;
                
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
    // Chyby jsou zalogovány, ale webhook musí vrátit 200, aby GoPay neopakoval
    logger.errorRequest(req, error, { context: 'webhook_unexpected_error' });
    res.status(200).json({
      success: false,
      error: 'Webhook processing error (logged)'
    });
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
    res.json({
      success: true,
      user: req.user
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

    // Validation
    if (!subject || !message) {
      throw new AppError('Subject and message are required', 400);
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
      subject,
      message,
      ticketPriority,
      ticketCategory
    ]);

    const ticketId = result.insertId;

    // Get user info for Discord notification
    const userQuery = 'SELECT email, name FROM users WHERE id = ?';
    const userResult = await db.queryOne(userQuery, [userId]);

    // Send Discord notification (non-blocking)
    if (userResult) {
      discordService.sendTicketNotification({
        ticketId: ticketId,
        name: userResult.name || 'Unknown',
        email: userResult.email || 'Unknown',
        subject: subject,
        message: message,
        priority: ticketPriority,
        category: ticketCategory
      }).catch(error => {
        // Log error but don't fail the request
        logger.error('Failed to send Discord notification:', error);
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
        subject,
        message,
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
