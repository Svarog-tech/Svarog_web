const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const hestiacp = require('./services/hestiacpService');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS - podporuje více origins z .env
const allowedOrigins = process.env.SERVER_ALLOWED_ORIGINS
  ? process.env.SERVER_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // Povolit requesty bez origin (např. mobilní aplikace nebo curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

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
    console.error('GoPay OAuth error:', errorText);
    throw new Error(`Failed to get access token: ${res.statusText}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Vytvoření platby v GoPay
 */
app.post('/api/gopay/create-payment', async (req, res) => {
  try {
    console.log('Creating GoPay payment...');
    const paymentData = req.body;

    const accessToken = await getAccessToken();

    const payment = {
      payer: {
        default_payment_instrument: 'PAYMENT_CARD',
        allowed_payment_instruments: ['PAYMENT_CARD'],
        contact: {
          first_name: paymentData.customerName.split(' ')[0] || paymentData.customerName,
          last_name: paymentData.customerName.split(' ').slice(1).join(' ') || '',
          email: paymentData.customerEmail
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

    console.log('Sending payment request to GoPay:', payment);

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
      console.error('GoPay API error:', data);
      return res.status(response.status).json({
        success: false,
        error: data
      });
    }

    console.log('Payment created successfully:', data);

    res.json({
      success: true,
      paymentId: data.id.toString(),
      paymentUrl: data.gw_url,
      state: data.state
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Kontrola statusu platby
 */
app.post('/api/gopay/check-payment', async (req, res) => {
  try {
    const { paymentId } = req.body;
    console.log('Checking payment status:', paymentId);

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
      console.error('GoPay API error:', data);
      return res.status(response.status).json({
        success: false,
        error: data
      });
    }

    console.log('Payment status:', data.state);

    res.json({
      success: true,
      status: data.state,
      isPaid: data.state === 'PAID',
      data: data
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * HestiaCP - Vytvoření hosting účtu
 */
app.post('/api/hestiacp/create-account', async (req, res) => {
  try {
    console.log('Creating HestiaCP hosting account...');
    const { email, domain, package: pkg, username, password } = req.body;

    if (!email || !domain) {
      return res.status(400).json({
        success: false,
        error: 'Email and domain are required'
      });
    }

    const result = await hestiacp.createHostingAccount({
      email,
      domain,
      package: pkg,
      username,
      password
    });

    if (!result.success) {
      console.error('HestiaCP account creation failed:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    console.log('HestiaCP account created successfully:', result);

    res.json({
      success: true,
      username: result.username,
      password: result.password,
      domain: result.domain,
      cpanelUrl: result.cpanelUrl,
      package: result.package
    });
  } catch (error) {
    console.error('Error creating HestiaCP account:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * HestiaCP - Suspendování účtu
 */
app.post('/api/hestiacp/suspend-account', async (req, res) => {
  try {
    console.log('Suspending HestiaCP account...');
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username is required'
      });
    }

    const result = await hestiacp.suspendUser(username);

    if (!result.success) {
      console.error('HestiaCP account suspension failed:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    console.log('HestiaCP account suspended successfully');

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error suspending HestiaCP account:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * HestiaCP - Obnovení účtu
 */
app.post('/api/hestiacp/unsuspend-account', async (req, res) => {
  try {
    console.log('Unsuspending HestiaCP account...');
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username is required'
      });
    }

    const result = await hestiacp.unsuspendUser(username);

    if (!result.success) {
      console.error('HestiaCP account unsuspension failed:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    console.log('HestiaCP account unsuspended successfully');

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error unsuspending HestiaCP account:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * HestiaCP - Smazání účtu
 */
app.post('/api/hestiacp/delete-account', async (req, res) => {
  try {
    console.log('Deleting HestiaCP account...');
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username is required'
      });
    }

    const result = await hestiacp.deleteUser(username);

    if (!result.success) {
      console.error('HestiaCP account deletion failed:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    console.log('HestiaCP account deleted successfully');

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting HestiaCP account:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    gopay_environment: process.env.REACT_APP_GOPAY_ENVIRONMENT || 'SANDBOX',
    gopay_go_id: GOPAY_GO_ID,
    hestiacp_configured: !!(process.env.HESTIACP_URL && process.env.HESTIACP_ACCESS_KEY)
  });
});

app.listen(PORT, () => {
  console.log('================================================');
  console.log('  GoPay & HestiaCP Proxy Server');
  console.log('================================================');
  console.log(`Server běží na: http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.REACT_APP_GOPAY_ENVIRONMENT || 'SANDBOX'}`);
  console.log(`GoID: ${GOPAY_GO_ID}`);
  console.log(`Allowed Origins: ${allowedOrigins.join(', ')}`);
  console.log('================================================');
  console.log('');
  console.log('GoPay Endpoints:');
  console.log(`  POST /api/gopay/create-payment`);
  console.log(`  POST /api/gopay/check-payment`);
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
