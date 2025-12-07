const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const hestiacp = require('./services/hestiacpService');

// Supabase client pro autentizaci
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key pro backend

// Pro autentizaci uživatelů použijeme anon key a ověříme JWT token
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseAuth = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const app = express();
const PORT = process.env.PORT || 3001;

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

app.use(express.json());

// ============================================
// SECURITY: Autentizace middleware
// ============================================

/**
 * Middleware pro ověření JWT tokenu z Supabase
 */
async function authenticateUser(req, res, next) {
  // Webhook endpointy nepotřebují autentizaci (mají vlastní validaci)
  if (req.path.includes('/webhook')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header'
    });
  }

  const token = authHeader.replace('Bearer ', '');

  if (!supabaseAuth) {
    console.error('Supabase client not configured');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error'
    });
  }

  try {
    // Ověř JWT token
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Přidej uživatele do requestu
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

/**
 * Middleware pro ověření admin práv
 */
async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  try {
    // Zkontroluj admin práva v databázi
    const { data: profile, error } = await supabaseAuth
      .from('profiles')
      .select('is_admin')
      .eq('id', req.user.id)
      .single();

    if (error || !profile || !profile.is_admin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    req.isAdmin = true;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify admin status'
    });
  }
}

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
 * SECURITY: Vyžaduje autentizaci
 */
app.post('/api/gopay/create-payment', authenticateUser, async (req, res) => {
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
    // SECURITY: V produkci nevyzrazuj detaily chyb
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Payment creation failed'
      : error.message;
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * Kontrola statusu platby
 * SECURITY: Vyžaduje autentizaci
 */
app.post('/api/gopay/check-payment', authenticateUser, async (req, res) => {
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
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to check payment status'
      : error.message;
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * HestiaCP - Vytvoření hosting účtu
 * SECURITY: Vyžaduje autentizaci
 */
app.post('/api/hestiacp/create-account', authenticateUser, async (req, res) => {
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
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to create hosting account'
      : error.message;
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * HestiaCP - Suspendování účtu
 * SECURITY: Vyžaduje admin práva
 */
app.post('/api/hestiacp/suspend-account', authenticateUser, requireAdmin, async (req, res) => {
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
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to suspend account'
      : error.message;
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * HestiaCP - Obnovení účtu
 * SECURITY: Vyžaduje admin práva
 */
app.post('/api/hestiacp/unsuspend-account', authenticateUser, requireAdmin, async (req, res) => {
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
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to unsuspend account'
      : error.message;
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * HestiaCP - Smazání účtu
 * SECURITY: Vyžaduje admin práva
 */
app.post('/api/hestiacp/delete-account', authenticateUser, requireAdmin, async (req, res) => {
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
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to delete account'
      : error.message;
    res.status(500).json({
      success: false,
      error: errorMessage
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
