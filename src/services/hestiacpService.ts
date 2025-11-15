/**
 * HestiaCP Service - Frontend
 * Handles communication with HestiaCP API through backend proxy
 */

import { supabase } from '../lib/auth';

const PROXY_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export interface CreateHostingAccountParams {
  email: string;
  domain: string;
  package?: string;
  username?: string;
  password?: string;
}

export interface CreateHostingAccountResult {
  success: boolean;
  username?: string;
  password?: string;
  domain?: string;
  cpanelUrl?: string;
  package?: string;
  error?: string;
}

export interface HostingAccountActionResult {
  success: boolean;
  error?: string;
}

/**
 * Vytvoří nový hosting účet v HestiaCP
 * @param params - Parametry pro vytvoření účtu
 * @returns Výsledek vytvoření včetně přihlašovacích údajů
 */
export const createHostingAccount = async (
  params: CreateHostingAccountParams
): Promise<CreateHostingAccountResult> => {
  try {
    console.log('[HestiaCP Frontend] Creating hosting account:', params);

    const response = await fetch(`${PROXY_URL}/api/hestiacp/create-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    const result = await response.json();

    if (!result.success) {
      console.error('[HestiaCP Frontend] Failed to create account:', result.error);
      return {
        success: false,
        error: result.error || 'Failed to create hosting account'
      };
    }

    console.log('[HestiaCP Frontend] Account created successfully:', result);

    return {
      success: true,
      username: result.username,
      password: result.password,
      domain: result.domain,
      cpanelUrl: result.cpanelUrl,
      package: result.package
    };
  } catch (error) {
    console.error('[HestiaCP Frontend] Error creating hosting account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
};

/**
 * Suspenduje hosting účet
 * @param username - HestiaCP uživatelské jméno
 */
export const suspendHostingAccount = async (
  username: string
): Promise<HostingAccountActionResult> => {
  try {
    console.log('[HestiaCP Frontend] Suspending account:', username);

    const response = await fetch(`${PROXY_URL}/api/hestiacp/suspend-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    });

    const result = await response.json();

    if (!result.success) {
      console.error('[HestiaCP Frontend] Failed to suspend account:', result.error);
      return {
        success: false,
        error: result.error || 'Failed to suspend hosting account'
      };
    }

    console.log('[HestiaCP Frontend] Account suspended successfully');

    return { success: true };
  } catch (error) {
    console.error('[HestiaCP Frontend] Error suspending hosting account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
};

/**
 * Obnoví suspendovaný hosting účet
 * @param username - HestiaCP uživatelské jméno
 */
export const unsuspendHostingAccount = async (
  username: string
): Promise<HostingAccountActionResult> => {
  try {
    console.log('[HestiaCP Frontend] Unsuspending account:', username);

    const response = await fetch(`${PROXY_URL}/api/hestiacp/unsuspend-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    });

    const result = await response.json();

    if (!result.success) {
      console.error('[HestiaCP Frontend] Failed to unsuspend account:', result.error);
      return {
        success: false,
        error: result.error || 'Failed to unsuspend hosting account'
      };
    }

    console.log('[HestiaCP Frontend] Account unsuspended successfully');

    return { success: true };
  } catch (error) {
    console.error('[HestiaCP Frontend] Error unsuspending hosting account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
};

/**
 * Smaže hosting účet
 * @param username - HestiaCP uživatelské jméno
 */
export const deleteHostingAccount = async (
  username: string
): Promise<HostingAccountActionResult> => {
  try {
    console.log('[HestiaCP Frontend] Deleting account:', username);

    const response = await fetch(`${PROXY_URL}/api/hestiacp/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    });

    const result = await response.json();

    if (!result.success) {
      console.error('[HestiaCP Frontend] Failed to delete account:', result.error);
      return {
        success: false,
        error: result.error || 'Failed to delete hosting account'
      };
    }

    console.log('[HestiaCP Frontend] Account deleted successfully');

    return { success: true };
  } catch (error) {
    console.error('[HestiaCP Frontend] Error deleting hosting account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
};

/**
 * Automaticky vytvoří hosting účet po zaplacení objednávky
 * @param orderId - ID objednávky
 * @param domain - Doména pro hosting
 */
export const createHostingAccountForOrder = async (
  orderId: number,
  domain: string
): Promise<CreateHostingAccountResult> => {
  try {
    console.log('[HestiaCP Frontend] Creating hosting account for order:', orderId);

    // Získej údaje o objednávce z databáze
    const { data: order, error: orderError } = await supabase
      .from('user_orders')
      .select('*, profiles(email)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('[HestiaCP Frontend] Failed to fetch order:', orderError);
      return {
        success: false,
        error: 'Order not found'
      };
    }

    // Vytvoř hosting účet
    const result = await createHostingAccount({
      email: order.profiles.email || order.billing_email,
      domain,
      package: order.plan_id
    });

    if (!result.success) {
      // Ulož chybu do databáze
      await supabase
        .from('user_hosting_services')
        .update({
          hestia_error: result.error,
          hestia_created: false
        })
        .eq('order_id', orderId);

      return result;
    }

    // Ulož údaje o hosting účtu do databáze
    const { error: updateError } = await supabase
      .from('user_hosting_services')
      .update({
        hestia_username: result.username,
        hestia_domain: result.domain,
        hestia_package: result.package,
        hestia_created: true,
        hestia_created_at: new Date().toISOString(),
        cpanel_url: result.cpanelUrl,
        ftp_host: result.domain,
        ftp_username: result.username,
        // POZNÁMKA: Heslo by mělo být zašifrované v produkci!
        // Pro testování ho ukládáme, ale v produkci by se mělo poslat emailem
        notes: `HestiaCP Username: ${result.username}\nPassword: ${result.password}\nControl Panel: ${result.cpanelUrl}`
      })
      .eq('order_id', orderId);

    if (updateError) {
      console.error('[HestiaCP Frontend] Failed to update hosting service:', updateError);
    }

    console.log('[HestiaCP Frontend] Hosting account created and saved successfully');

    return result;
  } catch (error) {
    console.error('[HestiaCP Frontend] Error creating hosting account for order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
