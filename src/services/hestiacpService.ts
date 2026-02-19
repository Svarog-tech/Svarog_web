/**
 * HestiaCP Service - Frontend
 * Handles communication with HestiaCP API through backend proxy
 */

import { apiCall } from '../lib/api';

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
 */
export const createHostingAccount = async (
  params: CreateHostingAccountParams
): Promise<CreateHostingAccountResult> => {
  try {
    const result = await apiCall<CreateHostingAccountResult>('/hestiacp/create-account', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create hosting account',
      };
    }

    return {
      success: true,
      username: result.username,
      password: result.password,
      domain: result.domain,
      cpanelUrl: result.cpanelUrl,
      package: result.package,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
};

/**
 * Suspenduje hosting účet (vyžaduje admin práva)
 */
export const suspendHostingAccount = async (
  username: string
): Promise<HostingAccountActionResult> => {
  try {
    const result = await apiCall<HostingAccountActionResult>('/hestiacp/suspend-account', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to suspend hosting account',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
};

/**
 * Obnoví suspendovaný hosting účet (vyžaduje admin práva)
 */
export const unsuspendHostingAccount = async (
  username: string
): Promise<HostingAccountActionResult> => {
  try {
    const result = await apiCall<HostingAccountActionResult>('/hestiacp/unsuspend-account', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to unsuspend hosting account',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
};

/**
 * Smaže hosting účet (vyžaduje admin práva)
 */
export const deleteHostingAccount = async (
  username: string
): Promise<HostingAccountActionResult> => {
  try {
    const result = await apiCall<HostingAccountActionResult>('/hestiacp/delete-account', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete hosting account',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
};

/**
 * Automaticky vytvoří hosting účet po zaplacení objednávky
 */
export const createHostingAccountForOrder = async (
  orderId: number,
  domain: string
): Promise<CreateHostingAccountResult> => {
  try {
    // Získej údaje o objednávce
    let order: any = null;
    try {
      const orderResult = await apiCall<{ order: any }>(`/orders/${orderId}`);
      order = orderResult.order;
    } catch {
      // Order fetch failed
    }

    if (!order) {
      return {
        success: false,
        error: 'Order not found',
      };
    }

    // Vytvoř hosting účet
    const result = await createHostingAccount({
      email: order.profiles?.email || order.billing_email,
      domain,
      package: order.plan_id,
    });

    // Najdi hosting službu podle order_id
    let hostingService: any = null;
    try {
      const servicesResult = await apiCall<{ services: any[] }>('/hosting-services');
      hostingService = servicesResult.services?.find((s: any) => s.order_id === orderId);
    } catch {
      // Services fetch failed
    }

    if (!result.success) {
      // Ulož chybu do databáze
      if (hostingService) {
        try {
          await apiCall(`/hosting-services/${hostingService.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              hestia_error: result.error,
              hestia_created: false,
            }),
          });
        } catch {
          // Update failed silently
        }
      }
      return result;
    }

    // Ulož údaje o hosting účtu do databáze
    if (hostingService) {
      try {
        await apiCall(`/hosting-services/${hostingService.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            hestia_username: result.username,
            hestia_domain: result.domain,
            hestia_package: result.package,
            hestia_created: true,
            hestia_created_at: new Date().toISOString(),
            cpanel_url: result.cpanelUrl,
            ftp_host: result.domain,
            ftp_username: result.username,
            // SECURITY: Heslo NIKDY neukládej do databáze!
            notes: `HestiaCP Username: ${result.username}\nControl Panel: ${result.cpanelUrl}`,
          }),
        });
      } catch {
        // Update failed silently
      }
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
