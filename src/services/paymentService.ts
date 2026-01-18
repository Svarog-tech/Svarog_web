import { getCurrentSession, getAuthHeader } from '../lib/auth';
import { createHostingAccountForOrder } from './hestiacpService';

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

export interface PaymentResult {
  success: boolean;
  paymentUrl?: string;
  paymentId?: string;
  error?: string;
}

export interface PaymentStatusResult {
  success: boolean;
  status?: string;
  isPaid?: boolean;
  error?: string;
}

// API URL z .env (fallback na localhost pro development)
const PROXY_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/**
 * Vytvoření platby v GoPay - přes lokální proxy server
 */
export const createGoPayPayment = async (data: PaymentData): Promise<PaymentResult> => {
  try {
    console.log('Creating GoPay payment via proxy server...');
    console.log('Payment data:', data);

    // SECURITY: Získej JWT token pro autentizaci
    const session = await getCurrentSession();
    if (!session || !session.access_token) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    const response = await fetch(`${PROXY_URL}/api/gopay/create-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!result.success) {
      console.error('GoPay payment error:', result.error);
      throw new Error(result.error);
    }

    console.log('Payment created successfully:', result);

    // Uložení payment_id a payment_url do databáze
    try {
      const updateResponse = await fetch(`${PROXY_URL}/api/orders/${data.orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
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

/**
 * Kontrola statusu platby - přes lokální proxy server
 */
export const checkPaymentStatus = async (paymentId: string): Promise<PaymentStatusResult> => {
  try {
    console.log('Checking payment status via proxy server:', paymentId);

    // SECURITY: Získej JWT token pro autentizaci
    const session = await getCurrentSession();
    if (!session || !session.access_token) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    const response = await fetch(`${PROXY_URL}/api/gopay/check-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ paymentId })
    });

    const result = await response.json();

    if (!result.success) {
      console.error('Error checking payment status:', result.error);
      throw new Error(result.error);
    }

    console.log('Payment status:', result.status);

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
      const findResponse = await fetch(`${PROXY_URL}/api/orders?payment_id=${paymentId}`, {
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
          const updateResponse = await fetch(`${PROXY_URL}/api/orders/${orderId}`, {
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
      console.log('[PaymentService] Payment confirmed, creating hosting account...');

      try {
        const hostingResult = await createHostingAccountForOrder(
          updatedOrder.id,
          updatedOrder.domain_name
        );

        if (hostingResult.success) {
          console.log('[PaymentService] Hosting account created successfully:', hostingResult);
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
    console.log('Cancelling payment:', paymentId);

    // Aktualizace v databázi - najdi objednávku a aktualizuj
    try {
      const findResponse = await fetch(`${PROXY_URL}/api/orders?payment_id=${paymentId}`, {
        method: 'GET',
        headers: {
          ...getAuthHeader()
        }
      });

      if (findResponse.ok) {
        const findResult = await findResponse.json();
        if (findResult.orders && findResult.orders.length > 0) {
          const orderId = findResult.orders[0].id;
          await fetch(`${PROXY_URL}/api/orders/${orderId}`, {
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
    console.log('Refunding payment:', paymentId, amount);

    // Aktualizace v databázi - najdi objednávku a aktualizuj
    try {
      const findResponse = await fetch(`${PROXY_URL}/api/orders?payment_id=${paymentId}`, {
        method: 'GET',
        headers: {
          ...getAuthHeader()
        }
      });

      if (findResponse.ok) {
        const findResult = await findResponse.json();
        if (findResult.orders && findResult.orders.length > 0) {
          const orderId = findResult.orders[0].id;
          await fetch(`${PROXY_URL}/api/orders/${orderId}`, {
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
