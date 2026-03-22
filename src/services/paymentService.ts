import { getCurrentSession, getAuthHeader } from '../lib/auth';
import { createHostingAccountForOrder } from './hestiacpService';
import { API_ROOT_URL } from '../lib/api';

// ============================================
// Types
// ============================================

export type PaymentProvider = 'stripe' | 'paypal' | 'gopay';

export interface PaymentData {
  orderId: number;
  amount: number;
  currency: string;
  description: string;
  customerEmail: string;
  customerName: string;
  returnUrl: string;
  notifyUrl: string;
}

export interface CreatePaymentOptions {
  orderId: number;
  amount: number;
  currency: string;
  description: string;
  customerEmail: string;
  customerName: string;
  provider: PaymentProvider;
  isSubscription?: boolean;
  priceId?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentUrl?: string;
  paymentId?: string;
  provider?: PaymentProvider;
  error?: string;
}

export interface PaymentStatusResult {
  success: boolean;
  status?: string;
  isPaid?: boolean;
  provider?: PaymentProvider;
  error?: string;
}

/**
 * Helper: autentizovaný fetch s CSRF headerem
 */
function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Guard': '1',
      ...getAuthHeader(),
      ...(options.headers || {}),
    },
  });
}

/**
 * Vytvoření platby v GoPay - přes lokální proxy server
 */
export const createGoPayPayment = async (data: PaymentData): Promise<PaymentResult> => {
  try {
    // Payment data se neloguje - obsahuje citlivé informace

    // SECURITY: Získej JWT token pro autentizaci
    const session = await getCurrentSession();
    if (!session || !session.access_token) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    const response = await authFetch(`${API_ROOT_URL}/api/gopay/create-payment`, {
      method: 'POST',
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!result.success) {
      console.error('GoPay payment error:', result.error);
      throw new Error(result.error);
    }

    // Payment created successfully

    // Uložení payment_id a payment_url do databáze
    try {
      const updateResponse = await authFetch(`${API_ROOT_URL}/api/orders/${data.orderId}`, {
        method: 'PUT',
        body: JSON.stringify({
          payment_id: result.paymentId,
          payment_url: result.paymentUrl,
          gopay_status: result.state,
          payment_status: 'unpaid'
        })
      });

      if (!updateResponse.ok) {
        console.error('Error updating order with payment info');
      }
    } catch (updateError) {
      console.error('Error updating order with payment info:', updateError);
    }

    return {
      success: true,
      paymentUrl: result.paymentUrl,
      paymentId: result.paymentId
    };
  } catch (error) {
    console.error('Error creating GoPay payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nepodařilo se vytvořit platbu'
    };
  }
};

// ============================================
// STRIPE
// ============================================

/**
 * Create Stripe Checkout Session
 */
export const createStripeCheckout = async (options: {
  orderId: number;
  isSubscription?: boolean;
  priceId?: string;
}): Promise<PaymentResult> => {
  try {
    const session = await getCurrentSession();
    if (!session || !session.access_token) {
      return { success: false, error: 'Authentication required' };
    }

    const response = await authFetch(`${API_ROOT_URL}/api/stripe/create-checkout-session`, {
      method: 'POST',
      body: JSON.stringify(options)
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Stripe checkout creation failed');
    }

    return {
      success: true,
      paymentUrl: result.paymentUrl,
      paymentId: result.sessionId,
      provider: 'stripe'
    };
  } catch (error) {
    console.error('Error creating Stripe checkout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nepodařilo se vytvořit Stripe platbu'
    };
  }
};

// ============================================
// PAYPAL
// ============================================

/**
 * Create PayPal Order
 */
export const createPayPalOrder = async (orderId: number): Promise<PaymentResult> => {
  try {
    const session = await getCurrentSession();
    if (!session || !session.access_token) {
      return { success: false, error: 'Authentication required' };
    }

    const response = await authFetch(`${API_ROOT_URL}/api/paypal/create-order`, {
      method: 'POST',
      body: JSON.stringify({ orderId })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'PayPal order creation failed');
    }

    return {
      success: true,
      paymentUrl: result.paymentUrl,
      paymentId: result.paypalOrderId,
      provider: 'paypal'
    };
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nepodařilo se vytvořit PayPal platbu'
    };
  }
};

/**
 * Capture PayPal Order (after user approves)
 */
export const capturePayPalOrder = async (paypalOrderId: string): Promise<PaymentStatusResult> => {
  try {
    const response = await authFetch(`${API_ROOT_URL}/api/paypal/capture-order`, {
      method: 'POST',
      body: JSON.stringify({ paypalOrderId })
    });

    const result = await response.json();
    return {
      success: result.success,
      status: result.status,
      isPaid: result.isPaid,
      provider: 'paypal'
    };
  } catch (error) {
    console.error('Error capturing PayPal order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'PayPal capture failed'
    };
  }
};

// ============================================
// UNIFIED DISPATCHER
// ============================================

/**
 * Create payment via any provider
 */
export const createPayment = async (options: CreatePaymentOptions): Promise<PaymentResult> => {
  switch (options.provider) {
    case 'stripe':
      return createStripeCheckout({
        orderId: options.orderId,
        isSubscription: options.isSubscription,
        priceId: options.priceId
      });

    case 'paypal':
      return createPayPalOrder(options.orderId);

    case 'gopay':
    default:
      return createGoPayPayment({
        orderId: options.orderId,
        amount: options.amount,
        currency: options.currency,
        description: options.description,
        customerEmail: options.customerEmail,
        customerName: options.customerName,
        returnUrl: `${window.location.origin}/payment/success?provider=gopay`,
        notifyUrl: `${API_ROOT_URL}/api/gopay/webhook`
      });
  }
};

// ============================================
// UNIFIED STATUS CHECK
// ============================================

/**
 * Check payment status across any provider
 */
export const checkPaymentStatusUnified = async (
  paymentId: string,
  provider: PaymentProvider
): Promise<PaymentStatusResult> => {
  try {
    const session = await getCurrentSession();
    if (!session || !session.access_token) {
      return { success: false, error: 'Authentication required' };
    }

    const response = await authFetch(`${API_ROOT_URL}/api/payments/check-status`, {
      method: 'POST',
      body: JSON.stringify({ paymentId, provider })
    });

    const result = await response.json();

    return {
      success: result.success,
      status: result.status,
      isPaid: result.isPaid,
      provider
    };
  } catch (error) {
    console.error('Error checking payment status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nepodařilo se zkontrolovat status platby'
    };
  }
};

// ============================================
// LEGACY: GoPay-specific status check (kept for backward compat)
// ============================================

/**
 * Kontrola statusu platby - přes lokální proxy server
 */
export const checkPaymentStatus = async (paymentId: string): Promise<PaymentStatusResult> => {
  try {
    // Check payment status

    // SECURITY: Získej JWT token pro autentizaci
    const session = await getCurrentSession();
    if (!session || !session.access_token) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    const response = await authFetch(`${API_ROOT_URL}/api/gopay/check-payment`, {
      method: 'POST',
      body: JSON.stringify({ paymentId })
    });

    const result = await response.json();

    if (!result.success) {
      console.error('Error checking payment status:', result.error);
      throw new Error(result.error);
    }

    // Payment status checked

    // Aktualizace statusu v databázi
    const paymentStatus = result.status === 'PAID' ? 'paid' :
                         result.status === 'CANCELED' ? 'failed' :
                         result.status === 'REFUNDED' ? 'refunded' : 'unpaid';

    const orderStatus = result.status === 'PAID' ? 'active' :
                       result.status === 'CANCELED' ? 'cancelled' :
                       result.status === 'TIMEOUTED' ? 'cancelled' : 'pending';

    // Aktualizuj status v databázi
    let updatedOrder = null;
    try {
      // Najdi objednávku podle payment_id
      const findResponse = await authFetch(`${API_ROOT_URL}/api/orders?payment_id=${paymentId}`, {
        method: 'GET',
        headers: {
          ...getAuthHeader()
        }
      });

      if (findResponse.ok) {
        const findResult = await findResponse.json();
        if (findResult.orders && findResult.orders.length > 0) {
          const orderId = findResult.orders[0].id;
          
          // Aktualizuj objednávku
          const updateResponse = await authFetch(`${API_ROOT_URL}/api/orders/${orderId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeader()
            },
            body: JSON.stringify({
              gopay_status: result.status,
              payment_status: paymentStatus,
              status: orderStatus
            })
          });

          if (updateResponse.ok) {
            const updateResult = await updateResponse.json();
            updatedOrder = updateResult.order;
          }
        }
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }

    // Pokud je platba zaplacená a máme doménu, automaticky vytvoř hosting účet
    if (result.status === 'PAID' && updatedOrder?.domain_name) {
      // Payment confirmed, creating hosting account

      try {
        const hostingResult = await createHostingAccountForOrder(
          updatedOrder.id,
          updatedOrder.domain_name
        );

        if (hostingResult.success) {
          // Hosting account created
        } else {
          console.error('[PaymentService] Failed to create hosting account:', hostingResult.error);
          // Poznámka: Hosting účet lze vytvořit později manuálně,
          // takže to není kritická chyba
        }
      } catch (error) {
        console.error('[PaymentService] Error creating hosting account:', error);
      }
    }

    return {
      success: true,
      status: result.status,
      isPaid: result.isPaid
    };
  } catch (error) {
    console.error('Error checking payment status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nepodařilo se zkontrolovat status platby'
    };
  }
};

/**
 * Zrušení platby
 */
export const cancelPayment = async (paymentId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Cancel payment

    // Aktualizace v databázi - najdi objednávku a aktualizuj
    try {
      const findResponse = await authFetch(`${API_ROOT_URL}/api/orders?payment_id=${paymentId}`, {
        method: 'GET',
        headers: {
          ...getAuthHeader()
        }
      });

      if (findResponse.ok) {
        const findResult = await findResponse.json();
        if (findResult.orders && findResult.orders.length > 0) {
          const orderId = findResult.orders[0].id;
          await authFetch(`${API_ROOT_URL}/api/orders/${orderId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeader()
            },
            body: JSON.stringify({
              gopay_status: 'CANCELED',
              payment_status: 'failed',
              status: 'cancelled'
            })
          });
        }
      }
    } catch (error) {
      console.error('Error canceling payment:', error);
    }

    return { success: true };
  } catch (error) {
    console.error('Error canceling payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nepodařilo se zrušit platbu'
    };
  }
};

/**
 * Refund platby
 */
export const refundPayment = async (
  paymentId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Refund payment

    // Aktualizace v databázi - najdi objednávku a aktualizuj
    try {
      const findResponse = await authFetch(`${API_ROOT_URL}/api/orders?payment_id=${paymentId}`, {
        method: 'GET',
        headers: {
          ...getAuthHeader()
        }
      });

      if (findResponse.ok) {
        const findResult = await findResponse.json();
        if (findResult.orders && findResult.orders.length > 0) {
          const orderId = findResult.orders[0].id;
          await authFetch(`${API_ROOT_URL}/api/orders/${orderId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeader()
            },
            body: JSON.stringify({
              gopay_status: 'REFUNDED',
              payment_status: 'refunded'
            })
          });
        }
      }
    } catch (error) {
      console.error('Error refunding payment:', error);
    }

    return { success: true };
  } catch (error) {
    console.error('Error refunding payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nepodařilo se vrátit platbu'
    };
  }
};
