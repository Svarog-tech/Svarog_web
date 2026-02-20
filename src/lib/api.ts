// Backend API client – volání vlastního Node API (objednávky, hosting, tikety, profil)

import { getCurrentUser, getAuthHeader, refreshAccessToken } from './auth';
import type { UserProfile } from '../types/auth';
import { API_BASE_URL, API_ROOT_URL } from './apiConfig';
export { API_BASE_URL, API_ROOT_URL };

// SECURITY: CSRF guard header – prohlížeč neumí přidat custom header přes cross-site form submit
function getCsrfHeaders(method?: string): Record<string, string> {
  const m = (method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) {
    return { 'X-CSRF-Guard': '1' };
  }
  return {};
}

// Helper pro API volání s automatickým refresh tokenu
export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let headers = {
    'Content-Type': 'application/json',
    ...getCsrfHeaders(options.method),
    ...getAuthHeader(),
    ...options.headers,
  };

  // BUG FIX: credentials: 'include' je nutné pro odesílání httpOnly refresh token cookie
  // Bez toho se cookie nepošle a refresh token nebude fungovat
  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Pokud je token neplatný, zkus refresh
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers = {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(options.method),
        ...getAuthHeader(),
        ...options.headers,
      };
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

// ============================================
// PAGINATION
// ============================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

function buildQuery(params: PaginationParams): string {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  return q.toString() ? `?${q.toString()}` : '';
}

// ============================================
// ORDERS
// ============================================

export interface Order {
  id?: number;
  user_id?: string | null;
  plan_id: string;
  plan_name: string;
  price: number;
  currency?: string;
  // Billing info
  billing_email?: string;
  billing_name?: string;
  billing_company?: string;
  billing_address?: string;
  billing_phone?: string;
  // Customer info
  customer_email?: string;
  customer_name?: string;
  // Order status
  status?: 'pending' | 'processing' | 'active' | 'cancelled' | 'expired';
  payment_status?: 'unpaid' | 'paid' | 'refunded' | 'failed';
  // Service details
  domain_name?: string;
  service_start_date?: string | Date;
  service_end_date?: string | Date;
  auto_renewal?: boolean;
  // Payment details (GoPay)
  payment_id?: string;
  payment_url?: string;
  gopay_status?: string;
  payment_method?: string;
  transaction_id?: string;
  payment_date?: string | Date;
  // Notes
  notes?: string;
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export const createOrder = async (orderData: Omit<Order, 'id' | 'created_at'>) => {
  const result = await apiCall<{ success: boolean; order: Order; error?: string }>('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });

  if (result.success) {
    return result.order;
  }
  throw new Error(result.error || 'Failed to create order');
};

export const getOrders = async (params: PaginationParams = {}): Promise<PaginatedResult<Order>> => {
  const result = await apiCall<{ orders: Order[]; pagination: PaginationMeta }>(`/orders${buildQuery(params)}`);
  return { data: result.orders || [], pagination: result.pagination };
};

// ============================================
// OAUTH (TODO: Implementovat pokud je potřeba)
// ============================================

export const oauthProviders = {
  google: 'google',
  github: 'github'
} as const;

export type OAuthProvider = keyof typeof oauthProviders;

export const signInWithOAuth = async (provider: OAuthProvider) => {
  throw new Error('OAuth není momentálně podporováno');
};

// ============================================
// AUTH FUNCTIONS (re-export z auth.ts)
// ============================================

export { getCurrentUser, signOut, signOutAllDevices, onAuthStateChange } from './auth';

export const signInWithEmail = async (email: string, password: string) => {
  const { signIn } = await import('./auth');
  return signIn({ email, password });
};

export const updateLastLogin = async (userId: string) => {
  // Update last login se dělá automaticky při přihlášení na backendu
  // Tato funkce je zachována pro kompatibilitu
  try {
    await apiCall('/auth/update-last-login', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  } catch (err) {
    console.error('Update last login error:', err);
  }
};

// ============================================
// USER PROFILE
// ============================================

export const getUserProfile = async (userId?: string) => {
  const targetUserId = userId || (await getCurrentUser())?.id;

  if (!targetUserId) {
    return null;
  }

  try {
    const result = await apiCall<{ profile?: UserProfile | null }>(`/profile/${targetUserId}`);
    return (result.profile as UserProfile | null) || null;
  } catch (error) {
    console.error('Get user profile error:', error);
    return null;
  }
};

export interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  avatarUrl?: string;
  newsletter?: boolean;
}

export const updateUserProfile = async (userId: string, data: ProfileUpdateData) => {
  const result = await apiCall<{ success: boolean; profile?: UserProfile; error?: string }>('/profile', {
    method: 'PUT',
    body: JSON.stringify({
      userId,
      ...data,
    }),
  });

  if (result.success) {
    return result.profile;
  }
  throw new Error(result.error || 'Failed to update profile');
};

// ============================================
// HOSTING ORDERS
// ============================================

export interface HostingOrderData {
  planId: string;
  planName: string;
  price: number;
  currency?: string;
  billingEmail?: string;
  billingName?: string;
  billingCompany?: string;
  billingAddress?: string;
  billingPhone?: string;
  domainName?: string;
}

export const createHostingOrder = async (data: HostingOrderData) => {
  const result = await apiCall<{ success: boolean; order: Order; error?: string }>('/orders/hosting', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (result.success) {
    return result.order;
  }
  throw new Error(result.error || 'Failed to create hosting order');
};

export const getUserOrders = async (userId?: string): Promise<Order[]> => {
  const targetUserId = userId || (await getCurrentUser())?.id;

  if (!targetUserId) {
    return [];
  }

  try {
    const result = await apiCall<{ orders: Order[] }>(`/orders/user/${targetUserId}`);
    return result.orders || [];
  } catch (error) {
    console.error('Get user orders error:', error);
    return [];
  }
};

// ============================================
// SUPPORT TICKETS
// ============================================

export interface SupportTicketData {
  subject: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
}

export const createSupportTicket = async (data: SupportTicketData) => {
  const result = await apiCall<{ success: boolean; ticket?: any; error?: string }>('/tickets', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (result.success) {
    return result.ticket;
  }
  throw new Error(result.error || 'Failed to create support ticket');
};

// ============================================
// PASSWORD RESET (re-export z auth.ts)
// ============================================

export { resetPassword, updatePassword } from './auth';

// ============================================
// HOSTING SERVICES
// ============================================

export interface HostingService {
  id: number;
  user_id: string;
  order_id: number;
  plan_name: string;
  plan_id: string;
  status: 'pending' | 'active' | 'suspended' | 'expired' | 'cancelled';
  price: number;
  billing_period: string;
  disk_space?: number;
  bandwidth?: number;
  databases?: number;
  email_accounts?: number;
  domains?: number;
  ftp_host?: string;
  ftp_username?: string;
  db_host?: string;
  db_name?: string;
  activated_at?: string;
  expires_at?: string;
  next_billing_date?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  // HestiaCP údaje
  hestia_username?: string;
  hestia_domain?: string;
  hestia_package?: string;
  hestia_created?: boolean;
  hestia_created_at?: string;
  hestia_error?: string;
  cpanel_url?: string;
}

export type RenewalPeriod = 'monthly' | 'yearly';

/**
 * Získá aktivní hosting služby uživatele
 */
export const getUserHostingServices = async (): Promise<HostingService[]> => {
  try {
    const result = await apiCall<{ services: HostingService[] }>('/hosting-services/active');
    return result.services || [];
  } catch (error) {
    console.error('Error fetching hosting services:', error);
    throw error;
  }
};

/**
 * Aktualizuje nastavení automatického prodloužení pro službu
 */
export const updateHostingServiceAutoRenewal = async (
  serviceId: number,
  autoRenewal: boolean,
  renewalPeriod?: RenewalPeriod
): Promise<HostingService> => {
  const body: any = { auto_renewal: autoRenewal };
  if (renewalPeriod) {
    body.renewal_period = renewalPeriod;
  }

  const result = await apiCall<{ success: boolean; service: HostingService }>(
    `/hosting-services/${serviceId}/auto-renewal`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    }
  );

  if (!result.success || !result.service) {
    throw new Error('Failed to update auto renewal settings');
  }

  return result.service;
};

/**
 * Získá všechny hosting služby uživatele (včetně vypršených)
 */
export const getAllUserHostingServices = async (params: PaginationParams = {}): Promise<PaginatedResult<HostingService>> => {
  try {
    const result = await apiCall<{ services: HostingService[]; pagination: PaginationMeta }>(`/hosting-services${buildQuery(params)}`);
    return { data: result.services || [], pagination: result.pagination };
  } catch (error) {
    console.error('Error fetching all hosting services:', error);
    throw error;
  }
};

/**
 * Získá detail konkrétní hosting služby
 */
export const getHostingService = async (serviceId: number): Promise<HostingService> => {
  try {
    const result = await apiCall<{ service: HostingService }>(`/hosting-services/${serviceId}`);
    return result.service;
  } catch (error) {
    console.error('Error fetching hosting service:', error);
    throw error;
  }
};

/**
 * Statistiky využití z HestiaCP
 */
export interface HostingServiceStats {
  disk_used_mb: number;
  disk_limit_mb: number | 'unlimited';
  bandwidth_used_mb: number;
  bandwidth_limit_mb: number | 'unlimited';
  email_accounts_used: number;
  email_accounts_limit: number | 'unlimited';
  databases_used: number;
  databases_limit: number | 'unlimited';
  web_domains_used: number;
  web_domains_limit: number | 'unlimited';
  suspended: boolean;
}

/**
 * Získá real-time statistiky z HestiaCP pro konkrétní službu
 */
export const getHostingServiceStats = async (serviceId: number): Promise<HostingServiceStats | null> => {
  try {
    const result = await apiCall<{ stats: HostingServiceStats | null; hestia_available: boolean }>(`/hosting-services/${serviceId}/stats`);
    return result.stats;
  } catch (error) {
    console.error('Error fetching hosting service stats:', error);
    return null;
  }
};

/**
 * Aktualizace hosting služby (pouze admin)
 */
export const updateHostingService = async (serviceId: number, updates: Partial<HostingService>): Promise<HostingService> => {
  const result = await apiCall<{ success: boolean; service: HostingService; error?: string }>(`/hosting-services/${serviceId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });

  if (result.success) {
    return result.service;
  }
  throw new Error(result.error || 'Failed to update hosting service');
};
