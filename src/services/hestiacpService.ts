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
    let order: { profiles?: { email?: string }; billing_email?: string; plan_id: string } | null = null;
    try {
      const orderResult = await apiCall<{ order: any }>(`/orders/${orderId}`);
      order = orderResult.order as typeof order;
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
    let hostingService: { id: number } | null = null;
    try {
      const servicesResult = await apiCall<{ services: { id: number; order_id: number }[] }>('/hosting-services');
      hostingService =
        servicesResult.services?.find((s) => s.order_id === orderId) || null;
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

// ============================================
// HestiaCP Live Data (Admin only)
// ============================================

export interface HestiaLiveUser {
  username: string;
  email: string;
  package: string;
  web_domains: number;
  dns_domains: number;
  mail_domains: number;
  databases: number;
  disk_used_mb: number;
  disk_quota_mb: number | 'unlimited';
  bandwidth_used_mb: number;
  bandwidth_limit_mb: number | 'unlimited';
  suspended: boolean;
  ip_addresses: string;
  creation_date: string;
  is_system_admin?: boolean;
  linked_local_user?: { id: string; email: string; name: string } | null;
}

export interface HestiaServerStats {
  total_users: number;
  active_users: number;
  suspended_users: number;
  total_web_domains: number;
  total_databases: number;
  total_mail_domains: number;
  total_disk_used_mb: number;
  total_bandwidth_used_mb: number;
}

export interface HestiaUserDetail {
  username: string;
  stats: Record<string, any> | null;
  domains: Array<{ domain: string; [key: string]: any }>;
  databases: Array<{ name: string; [key: string]: any }>;
  mail_domains: string[];
  linked_local_user: { id: string; email: string; first_name: string; last_name: string } | null;
}

export const getHestiaLiveUsers = async (): Promise<{ success: boolean; users: HestiaLiveUser[]; error?: string }> => {
  try {
    return await apiCall('/admin/hestiacp/users');
  } catch (error) {
    return { success: false, users: [], error: error instanceof Error ? error.message : 'Chyba sítě' };
  }
};

export const getHestiaUserDetail = async (username: string): Promise<HestiaUserDetail | null> => {
  try {
    const result = await apiCall<HestiaUserDetail & { success: boolean }>(`/admin/hestiacp/users/${encodeURIComponent(username)}`);
    return result.success ? result : null;
  } catch {
    return null;
  }
};

export const getHestiaServerStats = async (): Promise<HestiaServerStats | null> => {
  try {
    const result = await apiCall<{ success: boolean; stats: HestiaServerStats }>('/admin/hestiacp/server-stats');
    return result.success ? result.stats : null;
  } catch {
    return null;
  }
};
