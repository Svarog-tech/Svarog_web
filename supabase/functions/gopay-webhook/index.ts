import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const GOPAY_API_URL = Deno.env.get('GOPAY_ENVIRONMENT') === 'PRODUCTION'
  ? 'https://gate.gopay.cz/api'
  : 'https://gw.sandbox.gopay.com/api';

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
    const { id: paymentId } = await req.json();

    if (!paymentId) {
      return new Response(
        JSON.stringify({ error: 'Payment ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Webhook received for payment:', paymentId);

    // Získání detailu platby z GoPay
    const accessToken = await getAccessToken();
    const res = await fetch(`${GOPAY_API_URL}/payments/payment/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    const payment = await res.json();

    if (!res.ok) {
      throw new Error(`GoPay API error: ${JSON.stringify(payment)}`);
    }

    console.log('Payment details:', payment);

    // Určení payment statusu
    const paymentStatus = payment.state === 'PAID' ? 'paid' :
                         payment.state === 'CANCELED' ? 'failed' :
                         payment.state === 'REFUNDED' ? 'refunded' :
                         payment.state === 'TIMEOUTED' ? 'failed' : 'unpaid';

    // Určení order statusu
    const orderStatus = payment.state === 'PAID' ? 'active' :
                       payment.state === 'CANCELED' ? 'cancelled' :
                       payment.state === 'TIMEOUTED' ? 'cancelled' : 'pending';

    // Aktualizace objednávky v databázi
    const { error: updateError } = await supabase
      .from('user_orders')
      .update({
        gopay_status: payment.state,
        payment_status: paymentStatus,
        status: orderStatus,
        payment_date: payment.state === 'PAID' ? new Date().toISOString() : null
      })
      .eq('payment_id', paymentId);

    if (updateError) {
      console.error('Error updating order:', updateError);
      throw updateError;
    }

    console.log(`Order updated - Payment status: ${paymentStatus}, Order status: ${orderStatus}`);

    // TODO: Odeslat email zákazníkovi o změně statusu

    return new Response(
      JSON.stringify({ success: true, status: payment.state }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in gopay-webhook:', error);
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
