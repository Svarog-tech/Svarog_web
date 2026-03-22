const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const net = require('net');
const ipRangeCheck = require('ip-range-check');
const rateLimit = require('express-rate-limit');

module.exports = function({ db, logger, stripeSDK, activateOrderAfterPayment, getPaymentProvider, StripeProvider, PayPalProvider, hestiacp, withRetry, fetchWithTimeout, sendServiceActivatedEmail, sendPaymentConfirmationEmail, auditLog, authenticateUser, requireAdmin }) {
  const { asyncHandler, AppError } = require('../middleware/errorHandler');
  const {
    validateCreatePayment,
    validateWebhook,
    validateCheckPayment
  } = require('../middleware/validators');

  // Rate limiters
  const sensitiveOpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Příliš mnoho pokusů, zkuste to za 15 minut.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Příliš mnoho požadavků. Zkuste to za chvíli.' }
  });

  // GoPay configuration from .env
  const GOPAY_API_URL = process.env.GOPAY_ENVIRONMENT === 'PRODUCTION'
    ? 'https://gate.gopay.cz/api'
    : 'https://gw.sandbox.gopay.com/api';

  const GOPAY_CLIENT_ID = process.env.GOPAY_CLIENT_ID;
  const GOPAY_CLIENT_SECRET = process.env.GOPAY_CLIENT_SECRET;
  const GOPAY_GO_ID = process.env.GOPAY_GO_ID;

  /**
   * GoPay OAuth access token
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
  // AI Chat proxy - Gemini API
  // ============================================

  router.post('/chat/gemini',
    chatLimiter,
    asyncHandler(async (req, res) => {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        throw new AppError('Gemini API key not configured', 500);
      }

      const { messages, systemPrompt } = req.body;
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new AppError('Messages are required', 400);
      }

      // Omezení velikosti vstupu
      const totalLength = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0) + (systemPrompt?.length || 0);
      if (totalLength > 10000) {
        throw new AppError('Message too long', 400);
      }

      const contents = [];
      if (systemPrompt) {
        contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
        contents.push({ role: 'model', parts: [{ text: 'Understood. I am the Alatyr Hosting AI assistant.' }] });
      }
      for (const msg of messages) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: String(msg.content).slice(0, 2000) }]
        });
      }

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 1024 },
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
            ]
          })
        }
      );

      if (!geminiRes.ok) {
        throw new AppError(`Gemini API error: ${geminiRes.status}`, 502);
      }

      const geminiData = await geminiRes.json();
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      res.json({ success: true, text });
    })
  );

  // ============================================
  // GOPAY ENDPOINTS
  // ============================================

  /**
   * Vytvoření platby v GoPay
   * SECURITY: Vyžaduje autentizaci
   */
  router.post('/gopay/create-payment',
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
          // SECURITY: returnUrl a notifyUrl generovány server-side — klient je nesmí ovlivnit
          // GoPay automaticky přidá ?id={paymentId} k return_url
          return_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment-success?provider=gopay`,
          notification_url: `${process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`}/api/gopay/webhook`
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

  // ============================================
  // GOPAY WEBHOOK
  // ============================================

  /**
   * Wrapper middleware pro webhook validaci
   * BUG FIX: Zachytí validační chyby a vždy vrátí 200 OK (aby GoPay neopakoval webhook)
   */
  const validateWebhookSafe = async (req, res, next) => {
    try {
      // Full validation coverage: run all chain validators (.run()); skip the final validate() in the array
      for (const validator of validateWebhook) {
        if (typeof validator.run === 'function') {
          await validator.run(req);
        }
      }

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

      next();
    } catch (error) {
      logger.warn('GoPay webhook validation failed', {
        requestId: req.id,
        error: error.message,
        validationErrors: error.validationErrors,
        body: req.body
      });

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
   */
  router.post('/gopay/webhook',
    validateWebhookSafe,
    async (req, res, next) => {
      const handleWebhook = async (req, res) => {
        try {
      // SECURITY: IP whitelisting - povolit pouze GoPay IP adresy
      // BUG FIX: Safely extract IP address
      let clientIp = req.ip ||
        (req.connection && req.connection.remoteAddress) ||
        (req.socket && req.socket.remoteAddress) ||
        null;

      if (!clientIp && req.headers['x-forwarded-for']) {
        const forwardedIp = req.headers['x-forwarded-for'].split(',')[0].trim();
        if (forwardedIp) {
          clientIp = forwardedIp;
        }
      }

      const allowedGoPayIPs = [
        // GoPay produkční IP adresy
        '185.71.76.0/27',
        '185.71.77.0/27',
        // GoPay sandbox IP adresy
        '185.71.76.32/27'
      ];

      // V produkci kontrolovat IP whitelisting
      if (process.env.NODE_ENV === 'production') {
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
          return res.status(200).json({
            success: false,
            error: 'Forbidden'
          });
        }

        // BUG FIX: Použít net.isIP() pro správnou validaci IPv4 i IPv6
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
          return res.status(200).json({
            success: false,
            error: 'Forbidden'
          });
        }
      }

      // Fallback pro logging
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
        if (dupError.code === 'ER_DUP_ENTRY') {
          logger.info('GoPay webhook duplicate ignored', { paymentId, paymentState });
          return res.status(200).json({ success: true, message: 'Already processed' });
        }
        // SECURITY: webhook_events table is required — do not process without idempotency
        logger.error('Webhook idempotency check failed — aborting', { error: dupError.message, code: dupError.code });
        return res.status(500).json({ success: false, error: 'Webhook processing unavailable' });
      }

      // Najdi objednávku podle order_number nebo payment_id v MySQL
      let order = null;
      if (orderNumber) {
        const orderNumberAsId = parseInt(orderNumber);
        if (!isNaN(orderNumberAsId)) {
          order = await db.queryOne(
            'SELECT * FROM user_orders WHERE id = ? OR payment_id = ? LIMIT 1',
            [orderNumberAsId, paymentId]
          );
        } else {
          order = await db.queryOne(
            'SELECT * FROM user_orders WHERE payment_id = ? LIMIT 1',
            [paymentId]
          );
        }
      } else {
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

          // Auto-unsuspend if service was suspended
          if (isPaid) {
            try {
              const suspendedService = await db.queryOne(
                "SELECT hs.id, hs.hestia_username, hs.status FROM user_hosting_services hs WHERE hs.order_id = ? AND hs.status = 'suspended'",
                [order.id]
              );
              if (suspendedService && suspendedService.hestia_username) {
                await hestiacp.unsuspendUser(suspendedService.hestia_username);
                await db.execute(
                  "UPDATE user_hosting_services SET status = 'active', updated_at = NOW() WHERE id = ?",
                  [suspendedService.id]
                );
                logger.info(`Auto-unsuspended service ${suspendedService.id} after payment for order ${order.id}`);
              }
            } catch (unsuspendErr) {
              logger.error('Auto-unsuspend failed', { error: unsuspendErr.message, orderId: order.id });
            }
          }
      } catch (webhookError) {
        logger.errorRequest(req, webhookError, { context: 'webhook_transaction' });
      }

      // SECURITY: Idempotency - vždy vraťme 200, aby GoPay neopakoval webhook
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

  // ============================================
  // GOPAY CHECK PAYMENT
  // ============================================

  /**
   * Kontrola statusu platby
   * SECURITY: Vyžaduje autentizaci, uživatel může zkontrolovat pouze platby svých objednávek
   */
  router.post('/gopay/check-payment',
    authenticateUser,
    validateCheckPayment,
    asyncHandler(async (req, res) => {
      const { paymentId } = req.body || {};
      logger.request(req, 'Checking payment status', { paymentId, userId: req.user.id });

      if (!paymentId || typeof paymentId !== 'string' || !paymentId.trim()) {
        throw new AppError('paymentId is required', 400);
      }

      // SECURITY: Než zavoláme GoPay API, ověř, že paymentId patří objednávce aktuálně přihlášeného uživatele
      const order = await db.queryOne(
        'SELECT id, user_id FROM user_orders WHERE payment_id = ? LIMIT 1',
        [paymentId.trim()]
      );

      if (!order) {
        throw new AppError('Order not found for this payment', 404);
      }

      // PERFORMANCE: Použij is_admin z req.user (nastavený v authenticateUser)
      const isAdmin = !!req.user.is_admin;

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

  // ============================================
  // STRIPE ENDPOINTS
  // ============================================

  /**
   * Stripe: Create Checkout Session (one-time or subscription)
   * SECURITY: Requires authentication, validates order ownership
   */
  router.post('/stripe/create-checkout-session',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const { orderId, isSubscription, priceId } = req.body;

      if (!orderId) throw new AppError('orderId is required', 400);

      // SECURITY: Validace priceId proti known Stripe price IDs z env
      if (isSubscription && priceId) {
        const allowedPriceIds = [
          process.env.STRIPE_PRICE_BASIC_MONTHLY,
          process.env.STRIPE_PRICE_STANDARD_MONTHLY,
          process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
        ].filter(Boolean);

        if (allowedPriceIds.length > 0 && !allowedPriceIds.includes(priceId)) {
          throw new AppError('Invalid price ID', 400);
        }
      }

      // Verify order belongs to user
      const order = await db.queryOne(
        'SELECT * FROM user_orders WHERE id = ? AND user_id = ?',
        [orderId, req.user.id]
      );
      if (!order) throw new AppError('Order not found', 404);
      if (order.payment_status === 'paid') throw new AppError('Order already paid', 400);

      const returnUrl = `${process.env.APP_URL || 'http://localhost:3000'}/payment/success`;

      let result;
      if (isSubscription && priceId) {
        result = await StripeProvider.createSubscription({
          orderId: order.id,
          priceId,
          customerEmail: order.billing_email || order.customer_email,
          customerName: order.customer_name || order.billing_name,
          returnUrl,
          userId: req.user.id,
          db,
          planName: order.plan_name
        });

        // Save subscription session ID
        await db.execute(
          'UPDATE user_orders SET stripe_session_id = ?, payment_provider = ?, provider_status = ? WHERE id = ?',
          [result.paymentId, 'stripe', result.providerStatus, order.id]
        );
      } else {
        result = await StripeProvider.createPayment({
          orderId: order.id,
          amount: Number(order.price),
          currency: order.currency || 'CZK',
          description: `Hosting ${order.plan_name}`,
          customerEmail: order.billing_email || order.customer_email,
          customerName: order.customer_name || order.billing_name,
          returnUrl,
          userId: req.user.id,
          db
        });

        // Save session ID to order
        await db.execute(
          'UPDATE user_orders SET payment_id = ?, stripe_session_id = ?, payment_url = ?, payment_provider = ?, provider_status = ? WHERE id = ?',
          [result.paymentId, result.paymentId, result.paymentUrl, 'stripe', result.providerStatus, order.id]
        );
      }

      logger.info('Stripe checkout session created', {
        requestId: req.id, orderId: order.id, sessionId: result.paymentId, isSubscription: !!isSubscription
      });

      res.json({
        success: true,
        sessionId: result.paymentId,
        paymentUrl: result.paymentUrl,
        provider: 'stripe'
      });
    })
  );

  /**
   * Stripe Webhook
   * SECURITY: Signature verification via Stripe SDK, no auth required
   * Must always return 200 to prevent retries
   * NOTE: express.raw() body parser for this route must be configured BEFORE express.json() in the main app
   */
  router.post('/stripe/webhook', async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'];
      if (!sig) {
        logger.warn('Stripe webhook: missing signature');
        return res.status(200).json({ received: true });
      }

      let event;
      try {
        event = StripeProvider.verifyWebhook(req.body, sig);
      } catch (err) {
        logger.warn('Stripe webhook signature verification failed', { error: err.message });
        return res.status(200).json({ received: true });
      }

      logger.info('Stripe webhook received', { type: event.type, id: event.id });

      // Idempotency check
      try {
        await db.execute(
          'INSERT INTO webhook_events (payment_id, event_type, provider) VALUES (?, ?, ?)',
          [event.id, event.type, 'stripe']
        );
      } catch (dupError) {
        if (dupError.code === 'ER_DUP_ENTRY') {
          return res.status(200).json({ received: true, message: 'Already processed' });
        }
        // SECURITY: webhook_events table is required — do not process without idempotency
        logger.error('Stripe webhook idempotency check failed — aborting', { error: dupError.message, code: dupError.code });
        return res.status(500).json({ received: false, error: 'Webhook processing unavailable' });
      }

      // Handle events
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const orderId = session.metadata?.orderId;
          if (!orderId) break;

          const order = await db.queryOne('SELECT * FROM user_orders WHERE id = ?', [parseInt(orderId)]);
          if (!order || order.payment_status === 'paid') break;

          if (session.payment_status === 'paid') {
            await activateOrderAfterPayment({
              db, order,
              paymentId: session.id,
              provider: 'stripe',
              providerStatus: session.payment_status,
              hestiacp, withRetry,
              sendServiceActivatedEmail,
              sendPaymentConfirmationEmail,
              requestId: req.id
            });
          }

          // Handle subscription
          if (session.mode === 'subscription' && session.subscription) {
            const subscription = await stripeSDK.subscriptions.retrieve(session.subscription);
            try {
              await db.execute(
                `INSERT INTO stripe_subscriptions
                 (user_id, order_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, status, current_period_start, current_period_end)
                 VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))`,
                [
                  order.user_id, order.id,
                  subscription.id, subscription.customer,
                  subscription.items.data[0]?.price?.id || '',
                  subscription.status,
                  subscription.current_period_start,
                  subscription.current_period_end
                ]
              );
              await db.execute(
                'UPDATE user_orders SET stripe_subscription_id = ? WHERE id = ?',
                [subscription.id, order.id]
              );
            } catch (subErr) {
              logger.error('Failed to save subscription', { error: subErr.message, orderId: order.id });
            }
          }
          break;
        }

        case 'invoice.paid': {
          // Recurring subscription payment succeeded
          const invoice = event.data.object;
          const subId = invoice.subscription;
          if (!subId) break;

          // Update subscription period
          try {
            await db.execute(
              `UPDATE stripe_subscriptions SET status = 'active', current_period_start = FROM_UNIXTIME(?), current_period_end = FROM_UNIXTIME(?), updated_at = NOW() WHERE stripe_subscription_id = ?`,
              [invoice.period_start, invoice.period_end, subId]
            );

            // Extend hosting service expiry
            const sub = await db.queryOne('SELECT order_id FROM stripe_subscriptions WHERE stripe_subscription_id = ?', [subId]);
            if (sub) {
              await db.execute(
                `UPDATE user_hosting_services SET expires_at = FROM_UNIXTIME(?), next_billing_date = FROM_UNIXTIME(?), status = 'active' WHERE order_id = ?`,
                [invoice.period_end, invoice.period_end, sub.order_id]
              );
              await db.execute(
                `UPDATE user_orders SET payment_status = 'paid', status = 'active', payment_date = NOW() WHERE id = ?`,
                [sub.order_id]
              );

              // Auto-unsuspend if service was suspended
              try {
                const suspendedService = await db.queryOne(
                  "SELECT hs.id, hs.hestia_username, hs.status FROM user_hosting_services hs WHERE hs.order_id = ? AND hs.status = 'suspended'",
                  [sub.order_id]
                );
                if (suspendedService && suspendedService.hestia_username) {
                  await hestiacp.unsuspendUser(suspendedService.hestia_username);
                  await db.execute(
                    "UPDATE user_hosting_services SET status = 'active', updated_at = NOW() WHERE id = ?",
                    [suspendedService.id]
                  );
                  logger.info(`Auto-unsuspended service ${suspendedService.id} after invoice payment for order ${sub.order_id}`);
                }
              } catch (unsuspendErr) {
                logger.error('Auto-unsuspend failed', { error: unsuspendErr.message, orderId: sub.order_id });
              }
            }
          } catch (err) {
            logger.error('Stripe invoice.paid processing error', { error: err.message, subId });
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const subId = invoice.subscription;
          if (!subId) break;

          try {
            await db.execute(
              `UPDATE stripe_subscriptions SET status = 'past_due', updated_at = NOW() WHERE stripe_subscription_id = ?`,
              [subId]
            );
            const sub = await db.queryOne('SELECT order_id FROM stripe_subscriptions WHERE stripe_subscription_id = ?', [subId]);
            if (sub) {
              await db.execute(
                `UPDATE user_orders SET payment_status = 'failed' WHERE id = ?`,
                [sub.order_id]
              );
            }
          } catch (err) {
            logger.error('Stripe invoice.payment_failed processing error', { error: err.message });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          try {
            await db.execute(
              `UPDATE stripe_subscriptions SET status = 'canceled', updated_at = NOW() WHERE stripe_subscription_id = ?`,
              [subscription.id]
            );
            const sub = await db.queryOne('SELECT order_id FROM stripe_subscriptions WHERE stripe_subscription_id = ?', [subscription.id]);
            if (sub) {
              await db.execute(
                `UPDATE user_orders SET status = 'cancelled' WHERE id = ?`,
                [sub.order_id]
              );
              await db.execute(
                `UPDATE user_hosting_services SET status = 'cancelled' WHERE order_id = ?`,
                [sub.order_id]
              );
            }
          } catch (err) {
            logger.error('Stripe subscription.deleted processing error', { error: err.message });
          }
          break;
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Stripe webhook unexpected error', { error: error.message });
      res.status(200).json({ received: true });
    }
  });

  // ============================================
  // PAYPAL ENDPOINTS
  // ============================================

  /**
   * PayPal: Create Order
   * SECURITY: Requires authentication, validates order ownership
   */
  router.post('/paypal/create-order',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const { orderId } = req.body;
      if (!orderId) throw new AppError('orderId is required', 400);

      const order = await db.queryOne(
        'SELECT * FROM user_orders WHERE id = ? AND user_id = ?',
        [orderId, req.user.id]
      );
      if (!order) throw new AppError('Order not found', 404);
      if (order.payment_status === 'paid') throw new AppError('Order already paid', 400);

      const returnUrl = `${process.env.APP_URL || 'http://localhost:3000'}/payment/success`;

      const result = await PayPalProvider.createPayment({
        orderId: order.id,
        amount: Number(order.price),
        currency: order.currency === 'CZK' ? 'CZK' : (order.currency || 'EUR'),
        description: `Hosting ${order.plan_name}`,
        customerEmail: order.billing_email || order.customer_email,
        returnUrl
      });

      // Save PayPal order ID
      await db.execute(
        'UPDATE user_orders SET payment_id = ?, paypal_order_id = ?, payment_url = ?, payment_provider = ?, provider_status = ? WHERE id = ?',
        [result.paymentId, result.paymentId, result.paymentUrl, 'paypal', result.providerStatus, order.id]
      );

      logger.info('PayPal order created', { requestId: req.id, orderId: order.id, paypalOrderId: result.paymentId });

      res.json({
        success: true,
        paypalOrderId: result.paymentId,
        paymentUrl: result.paymentUrl,
        provider: 'paypal'
      });
    })
  );

  /**
   * PayPal: Capture Order (after user approves on PayPal)
   * SECURITY: Requires authentication, validates order ownership
   */
  router.post('/paypal/capture-order',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const { paypalOrderId } = req.body;
      if (!paypalOrderId) throw new AppError('paypalOrderId is required', 400);

      // SECURITY: Atomic lock — UPDATE WHERE prevents race condition on double-click/duplicate requests
      const lockResult = await db.execute(
        'UPDATE user_orders SET payment_status = ? WHERE paypal_order_id = ? AND user_id = ? AND payment_status = ?',
        ['processing', paypalOrderId, req.user.id, 'unpaid']
      );
      if (!lockResult.affectedRows) {
        const existing = await db.queryOne(
          'SELECT payment_status FROM user_orders WHERE paypal_order_id = ? AND user_id = ?',
          [paypalOrderId, req.user.id]
        );
        if (!existing) throw new AppError('Order not found', 404);
        if (existing.payment_status === 'paid') throw new AppError('Order already paid', 400);
        throw new AppError('Payment is being processed', 409);
      }

      const order = await db.queryOne(
        'SELECT * FROM user_orders WHERE paypal_order_id = ? AND user_id = ?',
        [paypalOrderId, req.user.id]
      );

      let captureResult;
      try {
        captureResult = await PayPalProvider.captureOrder(paypalOrderId);

        if (captureResult.isPaid) {
          await activateOrderAfterPayment({
            db, order,
            paymentId: paypalOrderId,
            provider: 'paypal',
            providerStatus: 'COMPLETED',
            hestiacp, withRetry,
            sendServiceActivatedEmail,
            sendPaymentConfirmationEmail,
            requestId: req.id
          });
        }
      } catch (captureError) {
        // Rollback status on capture failure
        await db.execute(
          'UPDATE user_orders SET payment_status = ? WHERE paypal_order_id = ? AND user_id = ?',
          ['unpaid', paypalOrderId, req.user.id]
        );
        throw captureError;
      }

      logger.info('PayPal order captured', {
        requestId: req.id, orderId: order.id, status: captureResult.status
      });

      res.json({
        success: true,
        status: captureResult.status,
        isPaid: captureResult.isPaid,
        provider: 'paypal'
      });
    })
  );

  /**
   * PayPal Webhook
   * SECURITY: Signature verification via PayPal API
   */
  router.post('/paypal/webhook', async (req, res) => {
    try {
      // SECURITY: Verify webhook signature in ALL environments (sandbox creds produce valid signatures)
      if (PayPalProvider && typeof PayPalProvider.verifyWebhook === 'function') {
        const isValid = await PayPalProvider.verifyWebhook(req.headers, req.body);
        if (!isValid) {
          logger.warn('PayPal webhook signature verification failed');
          return res.status(200).json({ received: true });
        }
      }

      const event = req.body;
      const eventType = event.event_type;
      const resource = event.resource;

      logger.info('PayPal webhook received', { type: eventType, id: event.id });

      // Idempotency
      try {
        await db.execute(
          'INSERT INTO webhook_events (payment_id, event_type, provider) VALUES (?, ?, ?)',
          [event.id, eventType, 'paypal']
        );
      } catch (dupError) {
        if (dupError.code === 'ER_DUP_ENTRY') {
          return res.status(200).json({ received: true });
        }
      }

      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED': {
          // Find order by PayPal order ID from supplementary_data or custom_id
          const paypalOrderId = resource?.supplementary_data?.related_ids?.order_id
            || resource?.custom_id;
          if (!paypalOrderId) break;

          const order = await db.queryOne(
            'SELECT * FROM user_orders WHERE paypal_order_id = ?',
            [paypalOrderId]
          );
          if (!order || order.payment_status === 'paid') break;

          await activateOrderAfterPayment({
            db, order,
            paymentId: paypalOrderId,
            provider: 'paypal',
            providerStatus: 'COMPLETED',
            hestiacp, withRetry,
            sendServiceActivatedEmail,
            sendPaymentConfirmationEmail,
            requestId: req.id
          });
          break;
        }

        case 'PAYMENT.CAPTURE.DENIED':
        case 'PAYMENT.CAPTURE.REFUNDED': {
          const paypalOrderId = resource?.supplementary_data?.related_ids?.order_id;
          if (!paypalOrderId) break;

          const status = eventType === 'PAYMENT.CAPTURE.REFUNDED' ? 'refunded' : 'failed';
          const orderStatus = status === 'refunded' ? 'cancelled' : 'cancelled';

          await db.execute(
            'UPDATE user_orders SET payment_status = ?, provider_status = ?, status = ? WHERE paypal_order_id = ?',
            [status, resource?.status || eventType, orderStatus, paypalOrderId]
          );
          break;
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('PayPal webhook unexpected error', { error: error.message });
      res.status(200).json({ received: true });
    }
  });

  // ============================================
  // UNIFIED PAYMENT STATUS CHECK
  // ============================================

  /**
   * Check payment status across all providers
   * SECURITY: Requires authentication, validates order ownership
   */
  router.post('/payments/check-status',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const { paymentId, provider } = req.body;

      if (!paymentId) throw new AppError('paymentId is required', 400);
      if (!provider || !['stripe', 'paypal', 'gopay'].includes(provider)) {
        throw new AppError('Invalid provider', 400);
      }

      // Find order by provider-specific ID
      let order;
      if (provider === 'stripe') {
        order = await db.queryOne('SELECT * FROM user_orders WHERE stripe_session_id = ? OR payment_id = ?', [paymentId, paymentId]);
      } else if (provider === 'paypal') {
        order = await db.queryOne('SELECT * FROM user_orders WHERE paypal_order_id = ? OR payment_id = ?', [paymentId, paymentId]);
      } else {
        order = await db.queryOne('SELECT * FROM user_orders WHERE payment_id = ?', [paymentId]);
      }

      if (!order) throw new AppError('Order not found', 404);

      // Security: check ownership
      const isAdmin = !!req.user.is_admin;
      if (order.user_id !== req.user.id && !isAdmin) {
        throw new AppError('Forbidden', 403);
      }

      // Check with provider
      const paymentProvider = getPaymentProvider(provider);
      const status = await paymentProvider.checkPayment(paymentId);

      res.json({
        success: true,
        status: status.status,
        isPaid: status.isPaid,
        provider,
        mappedStatus: paymentProvider.mapStatus(status.status)
      });
    })
  );

  // ============================================
  // ADMIN: REFUND ORDER
  // ============================================
  router.post('/admin/orders/:id/refund',
    sensitiveOpLimiter,
    authenticateUser,
    asyncHandler(async (req, res) => {
      if (!req.user.is_admin) {
        throw new AppError('Admin access required', 403);
      }

      const orderId = req.params.id;
      const { reason, amount } = req.body;

      const order = await db.queryOne('SELECT * FROM user_orders WHERE id = ?', [orderId]);
      if (!order) throw new AppError('Order not found', 404);

      if (order.payment_status !== 'paid') {
        throw new AppError(`Cannot refund order with status: ${order.payment_status}`, 400);
      }

      const provider = order.payment_provider;
      if (!provider || !['stripe', 'paypal', 'gopay'].includes(provider)) {
        throw new AppError(`Unknown payment provider: ${provider}`, 400);
      }

      const paymentProvider = getPaymentProvider(provider);
      let result;

      if (provider === 'stripe') {
        const sessionId = order.stripe_session_id || order.payment_id;
        result = await paymentProvider.refundPayment(sessionId, amount || null, reason || 'requested_by_customer');
      } else if (provider === 'paypal') {
        const paypalOrderId = order.paypal_order_id || order.payment_id;
        result = await paymentProvider.refundPayment(paypalOrderId, amount || null);
      } else {
        result = await paymentProvider.refundPayment(order.payment_id, amount || null);
      }

      const newStatus = amount ? 'partially_refunded' : 'refunded';
      await db.execute(
        'UPDATE user_orders SET payment_status = ?, refund_reason = ?, refunded_at = NOW(), refunded_by = ? WHERE id = ?',
        [newStatus, reason || null, req.user.id, orderId]
      );

      logger.info('Admin refund processed', {
        orderId,
        provider,
        refundId: result.refundId,
        amount: amount || 'full',
        reason: reason || 'none',
        adminId: req.user.id
      });

      await auditLog(req.user.id, 'order.refund', 'order', orderId, { provider, refundId: result.refundId, amount: amount || 'full', reason: reason || null, newStatus }, req);

      res.json({
        success: true,
        refundId: result.refundId,
        status: result.status,
        paymentStatus: newStatus
      });
    })
  );

  return router;
};
