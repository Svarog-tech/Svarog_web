/**
 * Payment Providers Abstraction Layer
 * Unified interface for GoPay, Stripe, and PayPal
 */

const fetch = require('node-fetch');
const logger = require('../utils/logger');

// ============================================
// Stripe SDK
// ============================================
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// ============================================
// Config
// ============================================
const GOPAY_API_URL = process.env.GOPAY_ENVIRONMENT === 'PRODUCTION'
  ? 'https://gate.gopay.cz/api'
  : 'https://gw.sandbox.gopay.com/api';

const PAYPAL_API_URL = process.env.PAYPAL_ENVIRONMENT === 'PRODUCTION'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// ============================================
// Helper: Fetch with timeout
// ============================================
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================
// GOPAY PROVIDER
// ============================================
const GoPayProvider = {
  name: 'gopay',

  async getAccessToken() {
    const credentials = Buffer.from(
      `${process.env.GOPAY_CLIENT_ID}:${process.env.GOPAY_CLIENT_SECRET}`
    ).toString('base64');

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
      throw new Error(`GoPay OAuth failed: ${res.statusText}`);
    }

    const data = await res.json();
    return data.access_token;
  },

  async createPayment({ orderId, amount, currency, description, customerEmail, customerName, returnUrl, notifyUrl }) {
    const accessToken = await this.getAccessToken();

    const nameParts = (customerName || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const paymentData = {
      payer: {
        default_payment_instrument: 'PAYMENT_CARD',
        contact: {
          first_name: firstName,
          last_name: lastName,
          email: customerEmail
        }
      },
      target: {
        type: 'ACCOUNT',
        goid: Number(process.env.GOPAY_GO_ID)
      },
      amount: Math.round(amount * 100),
      currency: currency || 'CZK',
      order_number: orderId.toString(),
      order_description: description,
      items: [{
        name: description,
        amount: Math.round(amount * 100),
        count: 1
      }],
      callback: {
        return_url: returnUrl,
        notification_url: notifyUrl
      },
      lang: 'CS'
    };

    const res = await fetchWithTimeout(`${GOPAY_API_URL}/payments/payment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error('GoPay payment creation failed', { error: errorText });
      throw new Error(`GoPay payment failed: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      paymentId: data.id.toString(),
      paymentUrl: data.gw_url,
      providerStatus: data.state,
      provider: 'gopay',
      raw: data
    };
  },

  async checkPayment(paymentId) {
    const accessToken = await this.getAccessToken();

    const res = await fetchWithTimeout(`${GOPAY_API_URL}/payments/payment/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`GoPay check payment failed: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      status: data.state,
      isPaid: data.state === 'PAID',
      provider: 'gopay',
      raw: data
    };
  },

  async refundPayment(paymentId, amount = null) {
    const accessToken = await this.getAccessToken();

    const refundData = {
      amount: amount ? Math.round(amount * 100) : undefined
    };

    const res = await fetchWithTimeout(`${GOPAY_API_URL}/payments/payment/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(refundData)
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error('GoPay refund failed', { error: errorText, paymentId });
      throw new Error(`GoPay refund failed: ${res.statusText}`);
    }

    const data = await res.json();
    return { success: true, refundId: data.id?.toString(), status: data.state };
  },

  mapStatus(providerStatus) {
    const mapping = {
      'CREATED': 'unpaid',
      'PAID': 'paid',
      'CANCELED': 'cancelled',
      'TIMEOUTED': 'timeout',
      'REFUNDED': 'refunded',
      'PARTIALLY_REFUNDED': 'partially_refunded'
    };
    return mapping[providerStatus] || 'unpaid';
  }
};

// ============================================
// STRIPE PROVIDER
// ============================================
const StripeProvider = {
  name: 'stripe',

  /**
   * Get or create Stripe customer for a user
   */
  async getOrCreateCustomer(db, userId, email, name) {
    // Check if customer exists in our DB
    const existing = await db.queryOne(
      'SELECT stripe_customer_id FROM stripe_customers WHERE user_id = ?',
      [userId]
    );

    if (existing) {
      return existing.stripe_customer_id;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { userId }
    });

    // Save to DB
    await db.execute(
      'INSERT INTO stripe_customers (user_id, stripe_customer_id) VALUES (?, ?)',
      [userId, customer.id]
    );

    return customer.id;
  },

  /**
   * Create Stripe Checkout Session (one-time payment)
   */
  async createPayment({ orderId, amount, currency, description, customerEmail, customerName, returnUrl, userId, db }) {
    if (!stripe) throw new Error('Stripe is not configured');

    const customerId = await this.getOrCreateCustomer(db, userId, customerEmail, customerName);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: (currency || 'CZK').toLowerCase(),
          product_data: {
            name: description
          },
          unit_amount: Math.round(amount * 100)
        },
        quantity: 1
      }],
      metadata: {
        orderId: orderId.toString(),
        provider: 'stripe'
      },
      success_url: `${returnUrl}?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?provider=stripe&status=cancelled`,
      expires_after: 1800 // 30 min
    });

    return {
      paymentId: session.id,
      paymentUrl: session.url,
      providerStatus: session.payment_status,
      provider: 'stripe',
      raw: session
    };
  },

  /**
   * Create Stripe Checkout Session (subscription)
   */
  async createSubscription({ orderId, priceId, customerEmail, customerName, returnUrl, userId, db, planName }) {
    if (!stripe) throw new Error('Stripe is not configured');

    const customerId = await this.getOrCreateCustomer(db, userId, customerEmail, customerName);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      metadata: {
        orderId: orderId.toString(),
        provider: 'stripe',
        planName: planName || ''
      },
      subscription_data: {
        metadata: {
          orderId: orderId.toString()
        }
      },
      success_url: `${returnUrl}?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?provider=stripe&status=cancelled`
    });

    return {
      paymentId: session.id,
      paymentUrl: session.url,
      providerStatus: session.payment_status,
      subscriptionPending: true,
      provider: 'stripe',
      raw: session
    };
  },

  async checkPayment(sessionId) {
    if (!stripe) throw new Error('Stripe is not configured');

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      status: session.payment_status,
      isPaid: session.payment_status === 'paid',
      provider: 'stripe',
      raw: session
    };
  },

  /**
   * Verify Stripe webhook signature
   */
  verifyWebhook(rawBody, signature) {
    if (!stripe) throw new Error('Stripe is not configured');
    return stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  },

  async refundPayment(sessionId, amount = null, reason = 'requested_by_customer') {
    if (!stripe) throw new Error('Stripe is not configured');
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const refundData = { payment_intent: session.payment_intent };
    if (amount) refundData.amount = Math.round(amount * 100);
    if (reason) refundData.reason = reason;
    const refund = await stripe.refunds.create(refundData);
    return { success: true, refundId: refund.id, status: refund.status };
  },

  mapStatus(providerStatus) {
    const mapping = {
      'paid': 'paid',
      'unpaid': 'unpaid',
      'no_payment_required': 'paid',
      // Subscription statuses
      'active': 'paid',
      'trialing': 'paid',
      'past_due': 'unpaid',
      'canceled': 'cancelled',
      'incomplete': 'unpaid',
      'incomplete_expired': 'cancelled'
    };
    return mapping[providerStatus] || 'unpaid';
  }
};

// ============================================
// PAYPAL PROVIDER
// ============================================
const PayPalProvider = {
  name: 'paypal',

  async getAccessToken() {
    const credentials = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    const res = await fetchWithTimeout(`${PAYPAL_API_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error('PayPal OAuth error', { error: errorText });
      throw new Error(`PayPal OAuth failed: ${res.statusText}`);
    }

    const data = await res.json();
    return data.access_token;
  },

  async createPayment({ orderId, amount, currency, description, customerEmail, returnUrl }) {
    const accessToken = await this.getAccessToken();

    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderId.toString(),
        description: description,
        amount: {
          currency_code: (currency || 'EUR').toUpperCase(),
          value: amount.toFixed(2)
        }
      }],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name: 'Alatyr Hosting',
            locale: 'cs-CZ',
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            return_url: `${returnUrl}?provider=paypal`,
            cancel_url: `${returnUrl}?provider=paypal&status=cancelled`
          }
        }
      }
    };

    const res = await fetchWithTimeout(`${PAYPAL_API_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(orderData)
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error('PayPal order creation failed', { error: errorText });
      throw new Error(`PayPal order creation failed: ${res.statusText}`);
    }

    const data = await res.json();

    // Find approval link
    const approvalLink = data.links?.find(l => l.rel === 'payer-action')?.href
      || data.links?.find(l => l.rel === 'approve')?.href;

    return {
      paymentId: data.id,
      paymentUrl: approvalLink,
      providerStatus: data.status,
      provider: 'paypal',
      raw: data
    };
  },

  /**
   * Capture PayPal order after user approval
   */
  async captureOrder(paypalOrderId) {
    const accessToken = await this.getAccessToken();

    const res = await fetchWithTimeout(`${PAYPAL_API_URL}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error('PayPal capture failed', { error: errorText });
      throw new Error(`PayPal capture failed: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      status: data.status,
      isPaid: data.status === 'COMPLETED',
      provider: 'paypal',
      raw: data
    };
  },

  async checkPayment(paypalOrderId) {
    const accessToken = await this.getAccessToken();

    const res = await fetchWithTimeout(`${PAYPAL_API_URL}/v2/checkout/orders/${paypalOrderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`PayPal check order failed: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      status: data.status,
      isPaid: data.status === 'COMPLETED',
      provider: 'paypal',
      raw: data
    };
  },

  /**
   * Verify PayPal webhook signature
   */
  async verifyWebhook(headers, body) {
    const accessToken = await this.getAccessToken();

    const res = await fetchWithTimeout(`${PAYPAL_API_URL}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: body
      })
    });

    if (!res.ok) return false;
    const data = await res.json();
    return data.verification_status === 'SUCCESS';
  },

  async refundPayment(paypalOrderId, amount = null) {
    const accessToken = await this.getAccessToken();

    // Get order details to find capture ID
    const orderRes = await fetchWithTimeout(`${PAYPAL_API_URL}/v2/checkout/orders/${paypalOrderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!orderRes.ok) {
      throw new Error(`PayPal order lookup failed: ${orderRes.statusText}`);
    }

    const orderData = await orderRes.json();
    const captureId = orderData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    if (!captureId) {
      throw new Error('No PayPal capture found for this order');
    }

    const refundBody = {};
    if (amount) {
      refundBody.amount = {
        value: amount.toFixed(2),
        currency_code: orderData.purchase_units[0].amount.currency_code
      };
    }

    const res = await fetchWithTimeout(`${PAYPAL_API_URL}/v2/payments/captures/${captureId}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(refundBody)
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error('PayPal refund failed', { error: errorText, paypalOrderId });
      throw new Error(`PayPal refund failed: ${res.statusText}`);
    }

    const data = await res.json();
    return { success: true, refundId: data.id, status: data.status };
  },

  mapStatus(providerStatus) {
    const mapping = {
      'CREATED': 'unpaid',
      'SAVED': 'unpaid',
      'APPROVED': 'unpaid',
      'VOIDED': 'cancelled',
      'COMPLETED': 'paid',
      'PAYER_ACTION_REQUIRED': 'unpaid'
    };
    return mapping[providerStatus] || 'unpaid';
  }
};

// ============================================
// PROVIDER FACTORY
// ============================================
function getPaymentProvider(providerName) {
  switch (providerName) {
    case 'stripe': return StripeProvider;
    case 'paypal': return PayPalProvider;
    case 'gopay':
    default: return GoPayProvider;
  }
}

// ============================================
// SHARED: Activate order after payment
// ============================================
/**
 * Shared post-payment activation logic.
 * Called from all webhook handlers after confirming payment.
 *
 * @param {object} db - Database instance
 * @param {object} order - The order row from user_orders
 * @param {string} paymentId - Provider-specific payment ID
 * @param {string} provider - 'gopay' | 'stripe' | 'paypal'
 * @param {object} hestiacp - HestiaCP service instance
 * @param {function} withRetry - Retry wrapper
 * @param {function} sendServiceActivatedEmail - Email sender
 * @param {function} sendPaymentConfirmationEmail - Email sender
 * @param {string} [requestId] - For logging
 */
async function activateOrderAfterPayment({
  db, order, paymentId, provider, providerStatus,
  hestiacp, withRetry, sendServiceActivatedEmail, sendPaymentConfirmationEmail,
  requestId
}) {
  let shouldCreateHestiaAccount = false;

  // 1. Update order + create hosting service in transaction
  await db.transaction(async (connection) => {
    const updateFields = [
      'payment_status = ?',
      'provider_status = ?',
      'payment_provider = ?',
      'payment_id = ?',
      'payment_date = NOW()',
      'status = ?'
    ];
    const updateValues = ['paid', providerStatus, provider, paymentId, 'active'];

    // Invoice
    if (!order.invoice_number) {
      updateFields.push('invoice_number = ?');
      updateFields.push('invoice_issued_at = NOW()');
      updateValues.push(`INV-${order.id}`);
    }

    // Provider-specific IDs
    if (provider === 'stripe') {
      updateFields.push('stripe_session_id = ?');
      updateValues.push(paymentId);
    } else if (provider === 'paypal') {
      updateFields.push('paypal_order_id = ?');
      updateValues.push(paymentId);
    } else {
      updateFields.push('gopay_status = ?');
      updateValues.push(providerStatus);
    }

    updateValues.push(order.id);

    await connection.execute(
      `UPDATE user_orders SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    logger.info('Order activated after payment', {
      requestId, orderId: order.id, provider, paymentId
    });

    // Create hosting service if not exists
    if (order.payment_status !== 'paid') {
      const [existingRows] = await connection.execute(
        'SELECT * FROM user_hosting_services WHERE order_id = ?',
        [order.id]
      );

      if (existingRows.length === 0) {
        await connection.execute(
          `INSERT INTO user_hosting_services
           (user_id, order_id, plan_name, plan_id, status, price, billing_period, activated_at, expires_at, next_billing_date)
           VALUES (?, ?, ?, ?, 'pending', ?, 'monthly', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY))`,
          [order.user_id, order.id, order.plan_name, order.plan_id, order.price]
        );
        shouldCreateHestiaAccount = true;
      }
    }
  });

  // 2. Create HestiaCP account (async, outside transaction)
  // SECURITY: Atomic lock via hestia_created column to prevent duplicate provisioning from concurrent webhooks
  if (shouldCreateHestiaAccount && hestiacp) {
    setImmediate(async () => {
      try {
        // Atomic claim: only one process can win this UPDATE (0 rows affected = already claimed)
        const lockResult = await db.execute(
          'UPDATE user_hosting_services SET hestia_created = 1 WHERE order_id = ? AND hestia_created = 0',
          [order.id]
        );
        if (!lockResult || lockResult.affectedRows === 0) {
          logger.info('HestiaCP provisioning already claimed by another process', { requestId, orderId: order.id });
          return;
        }

        const userProfile = await db.queryOne(
          'SELECT email, first_name, last_name FROM profiles WHERE id = ?',
          [order.user_id]
        );

        if (!userProfile) return;

        const userEmail = (userProfile.email && String(userProfile.email).trim())
          || (order.billing_email && String(order.billing_email).trim()) || null;

        if (!userEmail || !userEmail.includes('@')) {
          await db.execute(
            'UPDATE user_hosting_services SET hestia_error = ?, hestia_created = FALSE WHERE order_id = ?',
            ['Missing or invalid email for HestiaCP account', order.id]
          );
          return;
        }

        const rawUsername = userEmail.split('@')[0];
        const username = rawUsername.length > 32 ? rawUsername.substring(0, 32) : rawUsername;

        const hestiaResult = await withRetry(
          () => hestiacp.createHostingAccount({
            email: userEmail,
            domain: order.domain_name || `${order.id}.alatyr.cz`,
            package: order.plan_id,
            username
          }),
          { retries: 2, delayMs: 5000, label: `HestiaCP account (order ${order.id})` }
        );

        if (hestiaResult.success) {
          await db.execute(
            `UPDATE user_hosting_services
             SET hestia_username = ?, hestia_domain = ?, hestia_package = ?,
                 hestia_created = TRUE, hestia_created_at = NOW(),
                 status = 'active', cpanel_url = ?
             WHERE order_id = ?`,
            [hestiaResult.username, hestiaResult.domain, hestiaResult.package, hestiaResult.cpanelUrl, order.id]
          );

          await db.execute(
            `UPDATE profiles SET hestia_username = ?, hestia_package = ?, hestia_created = TRUE, hestia_created_at = NOW() WHERE id = ?`,
            [hestiaResult.username, hestiaResult.package, order.user_id]
          );

          logger.info('HestiaCP account created', { requestId, orderId: order.id, username: hestiaResult.username });

          // Service activated email
          if (sendServiceActivatedEmail) {
            const svc = await db.queryOne('SELECT plan_name, hestia_domain, expires_at FROM user_hosting_services WHERE order_id = ?', [order.id]);
            sendServiceActivatedEmail(userEmail, svc?.plan_name || order.plan_name, svc?.hestia_domain || order.domain_name, svc?.expires_at)
              .catch(err => logger.error('Service activated email failed', { error: err.message }));
          }
        } else {
          await db.execute(
            'UPDATE user_hosting_services SET hestia_error = ?, hestia_created = FALSE WHERE order_id = ?',
            [hestiaResult.error || 'Unknown error', order.id]
          );
        }
      } catch (error) {
        logger.error('HestiaCP creation error in post-payment', { requestId, orderId: order.id, error: error.message });
        // Release the provisioning lock so it can be retried
        try {
          await db.execute(
            'UPDATE user_hosting_services SET hestia_created = 0, hestia_error = ? WHERE order_id = ? AND hestia_username IS NULL',
            [error.message || 'Unknown error', order.id]
          );
        } catch (resetErr) {
          logger.error('Failed to reset hestia_created lock', { orderId: order.id, error: resetErr.message });
        }
      }
    });
  }

  // 2b. Auto-unsuspend if service was suspended
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

  // 3. Payment confirmation email
  try {
    const profile = await db.queryOne('SELECT email FROM profiles WHERE id = ?', [order.user_id]);
    const toEmail = profile?.email || order.billing_email || order.customer_email;
    if (toEmail && sendPaymentConfirmationEmail) {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const invoiceUrl = `${appUrl.replace(/\/+$/, '')}/api/orders/${order.id}/invoice`;
      const amount = Number(order.price) || 0;
      const currency = order.currency || 'CZK';
      await sendPaymentConfirmationEmail(
        toEmail, invoiceUrl,
        amount.toLocaleString('cs-CZ', { style: 'currency', currency }),
        currency, order.id
      );
    }
  } catch (emailError) {
    logger.error('Payment confirmation email failed', { requestId, orderId: order.id, error: emailError.message });
  }
}

module.exports = {
  GoPayProvider,
  StripeProvider,
  PayPalProvider,
  getPaymentProvider,
  activateOrderAfterPayment,
  stripe
};
