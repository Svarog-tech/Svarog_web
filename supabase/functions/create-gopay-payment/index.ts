import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GOPAY_API_URL = Deno.env.get('GOPAY_ENVIRONMENT') === 'PRODUCTION'
  ? 'https://gate.gopay.cz/api'
  : 'https://gw.sandbox.gopay.com/api';

const GOPAY_GO_ID = Deno.env.get('GOPAY_GO_ID')!;
const GOPAY_CLIENT_ID = Deno.env.get('GOPAY_CLIENT_ID')!;
const GOPAY_CLIENT_SECRET = Deno.env.get('GOPAY_CLIENT_SECRET')!;

/**
 * Získání OAuth access tokenu
 */
async function getAccessToken(): Promise<string> {
  const credentials = btoa(`${GOPAY_CLIENT_ID}:${GOPAY_CLIENT_SECRET}`);

  const res = await fetch(`${GOPAY_API_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials&scope=payment-all'
  });

  if (!res.ok) {
    throw new Error(`Failed to get access token: ${res.statusText}`);
  }

  const data = await res.json();
  return data.access_token;
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const paymentData = await req.json();
    const accessToken = await getAccessToken();

    // Vytvoření platby v GoPay
    const payment = {
      payer: {
        default_payment_instrument: 'PAYMENT_CARD',
        allowed_payment_instruments: ['PAYMENT_CARD'],
        ...paymentData.payer
      },
      target: {
        type: 'ACCOUNT',
        goid: parseInt(GOPAY_GO_ID)
      },
      amount: paymentData.amount,
      currency: paymentData.currency,
      order_number: paymentData.orderId.toString(),
      order_description: paymentData.description,
      items: [{
        name: paymentData.description,
        amount: paymentData.amount,
        count: 1
      }],
      callback: {
        return_url: paymentData.return_url,
        notification_url: paymentData.notify_url
      },
      lang: 'CS'
    };

    console.log('Creating payment:', JSON.stringify(payment, null, 2));

    const res = await fetch(`${GOPAY_API_URL}/payments/payment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payment)
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('GoPay API error:', data);
      throw new Error(`GoPay API error: ${JSON.stringify(data)}`);
    }

    console.log('Payment created:', data);

    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in create-gopay-payment:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
