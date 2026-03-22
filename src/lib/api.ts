// Backend API client – volání vlastního Node API (objednávky, hosting, tikety, profil)

import { getCurrentUser, getAuthHeader, refreshAccessToken } from './auth';
import type { UserProfile } from '../types/auth';
import { API_BASE_URL, API_ROOT_URL } from './apiConfig';
export { API_BASE_URL, API_ROOT_URL };

/**
 * Bezpečný helper pro extrakci chybové zprávy z unknown catch hodnoty
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Neznámá chyba';
}

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let headers = {
    'Content-Type': 'application/json',
    ...getCsrfHeaders(options.method),
    ...getAuthHeader(),
    ...options.headers,
  };

  try {
    let response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
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
          signal: controller.signal,
        });
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
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
  // Payment details
  payment_id?: string;
  payment_url?: string;
  payment_provider?: 'gopay' | 'stripe' | 'paypal';
  provider_status?: string;
  gopay_status?: string;
  stripe_session_id?: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  paypal_order_id?: string;
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
  } catch {
    // Silently fail — last login update is non-critical
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
  } catch {
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
  promo_code?: string;
  country_code?: string;
  vat_number?: string;
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
  } catch {
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
  email?: string;
  name?: string;
}

export interface SupportTicket {
  id: number;
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

export const createSupportTicket = async (data: SupportTicketData) => {
  const result = await apiCall<{ success: boolean; ticket?: SupportTicket; error?: string }>('/tickets', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (result.success) {
    return result.ticket;
  }
  throw new Error(result.error || 'Failed to create support ticket');
};

/**
 * Create a public ticket without authentication (development only)
 * This bypasses auth and creates a Discord channel directly
 */
export const createPublicTicket = async (data: SupportTicketData) => {
  const API_URL = import.meta.env.VITE_API_URL || '/api';
  const response = await fetch(`${API_URL}/tickets/public`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (result.success) {
    return result;
  }
  throw new Error(result.error || 'Failed to create ticket');
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
  const body: { auto_renewal: boolean; renewal_period?: RenewalPeriod } = { auto_renewal: autoRenewal };
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
  } catch {
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

// ============================================
// SERVICE ALERTS
// ============================================

export interface ServiceAlert {
  id: number;
  service_id: number;
  plan_name?: string;
  hestia_domain?: string;
  alert_type: 'disk_limit' | 'bandwidth_limit' | 'email_limit' | 'database_limit' | 'domain_limit' | 'cpu_high' | 'memory_high';
  threshold_value: number;
  current_value: number;
  severity: 'warning' | 'critical';
  acknowledged: boolean;
  created_at: string;
}

/**
 * Získá nepřečtené alerty pro aktuálního uživatele
 */
export const getUnreadAlerts = async (): Promise<{ count: number; alerts: ServiceAlert[] }> => {
  try {
    const result = await apiCall<{ count: number; alerts: ServiceAlert[] }>('/alerts/unread');
    return { count: result.count || 0, alerts: result.alerts || [] };
  } catch {
    return { count: 0, alerts: [] };
  }
};

/**
 * Získá alerty pro konkrétní službu
 */
export const getServiceAlerts = async (serviceId: number): Promise<ServiceAlert[]> => {
  try {
    const result = await apiCall<{ alerts: ServiceAlert[] }>(`/hosting-services/${serviceId}/alerts`);
    return result.alerts || [];
  } catch {
    return [];
  }
};

/**
 * Potvrdí (acknowledge) konkrétní alert
 */
export const acknowledgeAlert = async (serviceId: number, alertId: number): Promise<void> => {
  await apiCall<{ success: boolean }>(`/hosting-services/${serviceId}/alerts/${alertId}/acknowledge`, {
    method: 'POST',
  });
};

/**
 * Získá historii statistik pro graf
 */
export interface StatisticsHistoryEntry {
  timestamp: string;
  value: number;
  metric: string;
}

export const getStatisticsHistory = async (
  serviceId: number,
  period: string = '24h',
  metric: string = 'disk'
): Promise<StatisticsHistoryEntry[]> => {
  try {
    const result = await apiCall<{ history: StatisticsHistoryEntry[] }>(
      `/hosting-services/${serviceId}/statistics/history?period=${period}&metric=${metric}`
    );
    return result.history || [];
  } catch {
    return [];
  }
};

// ============================================
// PROMO CODES
// ============================================

export interface PromoValidationResult {
  valid: boolean;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  discount_amount: number;
  final_price: number;
  code: string;
  description?: string;
}

export interface PromoCode {
  id: number;
  code: string;
  description?: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  current_uses: number;
  per_user_limit: number | null;
  valid_from: string;
  valid_until: string | null;
  applicable_plans: string[] | null;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PromoCodeUsage {
  id: number;
  promo_code_id: number;
  user_id: string;
  order_id: number;
  discount_amount: number;
  used_at: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Validate a promo code (authenticated users)
 */
export const validatePromoCode = async (
  code: string,
  plan_id?: string,
  amount?: number
): Promise<PromoValidationResult> => {
  return apiCall<PromoValidationResult>('/promo/validate', {
    method: 'POST',
    body: JSON.stringify({ code, plan_id, amount }),
  });
};

/**
 * Admin: List all promo codes
 */
export const getPromoCodes = async (
  params: PaginationParams & { search?: string } = {}
): Promise<{ promo_codes: PromoCode[]; pagination: PaginationMeta }> => {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.search) q.set('search', params.search);
  const qs = q.toString() ? `?${q.toString()}` : '';
  return apiCall<{ promo_codes: PromoCode[]; pagination: PaginationMeta }>(`/admin/promo${qs}`);
};

/**
 * Admin: Create promo code
 */
export const createPromoCode = async (data: Partial<PromoCode>): Promise<{ success: boolean; promo_code: PromoCode }> => {
  return apiCall<{ success: boolean; promo_code: PromoCode }>('/admin/promo', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * Admin: Update promo code
 */
export const updatePromoCode = async (id: number, data: Partial<PromoCode>): Promise<{ success: boolean; promo_code: PromoCode }> => {
  return apiCall<{ success: boolean; promo_code: PromoCode }>(`/admin/promo/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

/**
 * Admin: Deactivate (soft delete) promo code
 */
export const deletePromoCode = async (id: number): Promise<{ success: boolean; message: string }> => {
  return apiCall<{ success: boolean; message: string }>(`/admin/promo/${id}`, {
    method: 'DELETE',
  });
};

/**
 * Admin: Get usage history for a promo code
 */
export const getPromoCodeUsage = async (
  id: number,
  params: PaginationParams = {}
): Promise<{ promo_code: string; usage: PromoCodeUsage[]; pagination: PaginationMeta }> => {
  return apiCall<{ promo_code: string; usage: PromoCodeUsage[]; pagination: PaginationMeta }>(
    `/admin/promo/${id}/usage${buildQuery(params)}`
  );
};

// ============================================
// ACCOUNT CREDITS
// ============================================

export interface CreditTransaction {
  id: number;
  amount: number;
  balance_after: number;
  transaction_type: 'deposit' | 'payment' | 'refund' | 'adjustment' | 'promo';
  description: string | null;
  order_id: number | null;
  created_at: string;
}

/**
 * Get current user's credit balance
 */
export const getCreditBalance = async (): Promise<{ balance: number; currency: string }> => {
  return apiCall<{ balance: number; currency: string }>('/credits/balance');
};

/**
 * Get current user's credit transaction history
 */
export const getCreditHistory = async (
  page?: number
): Promise<{ transactions: CreditTransaction[]; pagination: PaginationMeta }> => {
  const q = page ? `?page=${page}` : '';
  return apiCall<{ transactions: CreditTransaction[]; pagination: PaginationMeta }>(`/credits/history${q}`);
};

/**
 * Admin: Adjust a user's credit balance
 */
export const adminAdjustCredit = async (
  userId: string,
  amount: number,
  description: string
): Promise<void> => {
  await apiCall<{ success: boolean }>(`/admin/credits/${userId}/adjust`, {
    method: 'POST',
    body: JSON.stringify({ amount, description }),
  });
};

/**
 * Admin: Get a user's credit history
 */
export const adminGetCreditHistory = async (
  userId: string,
  page?: number
): Promise<{ balance: number; currency: string; transactions: CreditTransaction[]; pagination: PaginationMeta }> => {
  const q = page ? `?page=${page}` : '';
  return apiCall<{ balance: number; currency: string; transactions: CreditTransaction[]; pagination: PaginationMeta }>(
    `/admin/credits/${userId}${q}`
  );
};

// ============================================
// REVENUE & ANALYTICS (admin)
// ============================================

export interface RevenueAnalytics {
  total_revenue: number;
  mrr: number;
  arr: number;
  period_revenue: number;
  revenue_by_month: { month: string; revenue: number; orders: number }[];
  revenue_by_plan: { plan_name: string; revenue: number; count: number }[];
  revenue_by_provider: { provider: string; revenue: number; count: number }[];
  avg_order_value: number;
}

export interface CustomerAnalytics {
  total_customers: number;
  active_customers: number;
  new_customers_this_month: number;
  churn_rate: number;
  customers_by_month: { month: string; new_count: number; churned: number; total: number }[];
  avg_lifetime_value: number;
}

export interface ServiceAnalytics {
  total_services: number;
  active_services: number;
  suspended_services: number;
  expired_services: number;
  services_by_plan: { plan_name: string; count: number }[];
  services_by_status: { status: string; count: number }[];
  avg_disk_usage_percent: number;
  avg_bandwidth_usage_percent: number;
}

/**
 * Admin: Get revenue analytics
 */
export const getRevenueAnalytics = async (period?: string): Promise<RevenueAnalytics> => {
  const q = period ? `?period=${period}` : '';
  return apiCall<RevenueAnalytics>(`/admin/analytics/revenue${q}`);
};

/**
 * Admin: Get customer analytics
 */
export const getCustomerAnalytics = async (): Promise<CustomerAnalytics> => {
  return apiCall<CustomerAnalytics>('/admin/analytics/customers');
};

/**
 * Admin: Get service analytics
 */
export const getServiceAnalytics = async (): Promise<ServiceAnalytics> => {
  return apiCall<ServiceAnalytics>('/admin/analytics/services');
};

// ============================================
// TAX / VAT
// ============================================

export interface TaxRate {
  id: number;
  country_code: string;
  country_name: string;
  tax_rate: number;
  tax_type: 'vat' | 'sales_tax' | 'gst';
  is_eu: boolean;
}

export interface TaxCalculation {
  price_without_tax: number;
  tax_rate: number;
  tax_amount: number;
  total_price: number;
  reverse_charge: boolean;
}

/**
 * Get all active tax rates (public, no auth needed for checkout display)
 */
export const getTaxRates = async (): Promise<TaxRate[]> => {
  const result = await apiCall<{ rates: TaxRate[] }>('/tax/rates');
  return result.rates || [];
};

/**
 * Calculate tax for an order (authenticated)
 */
export const calculateTax = async (
  amount: number,
  countryCode: string,
  vatNumber?: string
): Promise<TaxCalculation> => {
  const result = await apiCall<TaxCalculation & { success: boolean }>('/tax/calculate', {
    method: 'POST',
    body: JSON.stringify({ amount, country_code: countryCode, vat_number: vatNumber }),
  });
  return {
    price_without_tax: result.price_without_tax,
    tax_rate: result.tax_rate,
    tax_amount: result.tax_amount,
    total_price: result.total_price,
    reverse_charge: result.reverse_charge,
  };
};

/**
 * Validate EU VAT number format (authenticated)
 */
export const validateVatNumber = async (
  vatNumber: string,
  countryCode: string
): Promise<{ valid: boolean; formatted_number: string }> => {
  return apiCall<{ valid: boolean; formatted_number: string }>('/tax/validate-vat', {
    method: 'POST',
    body: JSON.stringify({ vat_number: vatNumber, country_code: countryCode }),
  });
};

// ============================================
// EMAIL TEMPLATES (Admin)
// ============================================

export interface EmailTemplate {
  id: number;
  template_key: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: string[];
  category: 'auth' | 'payment' | 'hosting' | 'support' | 'system';
  is_active: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Admin: List all email templates with optional category filter
 */
export const getEmailTemplates = async (
  category?: string,
  params: PaginationParams = {}
): Promise<{ templates: EmailTemplate[]; pagination: PaginationMeta }> => {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (category) q.set('category', category);
  const qs = q.toString() ? `?${q.toString()}` : '';
  return apiCall<{ templates: EmailTemplate[]; pagination: PaginationMeta }>(`/admin/email-templates${qs}`);
};

/**
 * Admin: Get a single email template by ID
 */
export const getEmailTemplate = async (id: number): Promise<EmailTemplate> => {
  const result = await apiCall<{ template: EmailTemplate }>(`/admin/email-templates/${id}`);
  return result.template;
};

/**
 * Admin: Update an email template
 */
export const updateEmailTemplate = async (
  id: number,
  data: { subject?: string; body_html?: string; body_text?: string | null; is_active?: boolean }
): Promise<EmailTemplate> => {
  const result = await apiCall<{ success: boolean; template: EmailTemplate }>(`/admin/email-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return result.template;
};

/**
 * Admin: Preview a template with sample variables
 */
export const previewEmailTemplate = async (
  id: number,
  variables?: Record<string, string>
): Promise<{ html: string; subject: string; text: string | null; variables_used: Record<string, string> }> => {
  return apiCall<{ html: string; subject: string; text: string | null; variables_used: Record<string, string> }>(
    `/admin/email-templates/${id}/preview`,
    {
      method: 'POST',
      body: JSON.stringify({ variables }),
    }
  );
};

/**
 * Admin: Send a test email for a template to the admin's address
 */
export const testEmailTemplate = async (id: number): Promise<{ success: boolean; sent_to: string }> => {
  return apiCall<{ success: boolean; sent_to: string }>(`/admin/email-templates/${id}/test`, {
    method: 'POST',
  });
};

/**
 * Admin: Reset a template to its default content
 */
export const resetEmailTemplate = async (id: number): Promise<EmailTemplate> => {
  const result = await apiCall<{ success: boolean; template: EmailTemplate }>(
    `/admin/email-templates/reset/${id}`,
    { method: 'POST' }
  );
  return result.template;
};

// ============================================
// KNOWLEDGE BASE
// ============================================

export interface KBCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  article_count: number;
}

export interface KBArticle {
  id: number;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  tags: string[];
  views: number;
  helpful_yes: number;
  helpful_no: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get all active KB categories with article counts (public)
 */
export const getKBCategories = async (): Promise<KBCategory[]> => {
  const result = await apiCall<{ categories: KBCategory[] }>('/kb/categories');
  return result.categories || [];
};

/**
 * Get published KB articles with optional filters (public)
 */
export const getKBArticles = async (
  params?: { category?: string; search?: string; page?: number }
): Promise<{ articles: KBArticle[]; pagination: PaginationMeta }> => {
  const q = new URLSearchParams();
  if (params?.category) q.set('category', params.category);
  if (params?.search) q.set('search', params.search);
  if (params?.page) q.set('page', String(params.page));
  const qs = q.toString() ? `?${q.toString()}` : '';
  return apiCall<{ articles: KBArticle[]; pagination: PaginationMeta }>(`/kb/articles${qs}`);
};

/**
 * Get a single KB article by slug (public)
 */
export const getKBArticle = async (slug: string): Promise<KBArticle> => {
  const result = await apiCall<{ article: KBArticle }>(`/kb/articles/${encodeURIComponent(slug)}`);
  return result.article;
};

/**
 * Rate a KB article as helpful or not (public)
 */
export const rateKBArticle = async (id: number, helpful: boolean): Promise<void> => {
  await apiCall<{ success: boolean }>(`/kb/articles/${id}/helpful`, {
    method: 'POST',
    body: JSON.stringify({ helpful }),
  });
};

// ============================================
// AFFILIATE PROGRAM
// ============================================

export interface AffiliateAccount {
  id: number;
  user_id: string;
  referral_code: string;
  commission_rate: number;
  tier: 'bronze' | 'silver' | 'gold';
  total_earnings: number;
  pending_balance: number;
  paid_balance: number;
  total_referrals: number;
  total_conversions: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AffiliateCommission {
  id: number;
  affiliate_id: number;
  order_id: number;
  order_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  created_at: string;
}

export interface AffiliateReferral {
  id: number;
  affiliate_id: number;
  referred_user_id: string;
  converted: boolean;
  converted_at: string | null;
  created_at: string;
}

export interface AffiliatePayout {
  id: number;
  affiliate_id: number;
  amount: number;
  method: string;
  status: 'pending' | 'completed' | 'rejected';
  created_at: string;
}

export interface AffiliateStats {
  total_earnings: number;
  pending_balance: number;
  total_referrals: number;
  total_conversions: number;
  conversion_rate: number;
  tier: string;
  commission_rate: number;
}

/**
 * Get current user's affiliate account
 */
export const getAffiliateAccount = async (): Promise<AffiliateAccount | null> => {
  try {
    const result = await apiCall<{ account: AffiliateAccount | null }>('/affiliate/account');
    return result.account || null;
  } catch {
    return null;
  }
};

/**
 * Join the affiliate program
 */
export const joinAffiliateProgram = async (): Promise<AffiliateAccount> => {
  const result = await apiCall<{ success: boolean; account: AffiliateAccount }>('/affiliate/join', {
    method: 'POST',
  });
  return result.account;
};

/**
 * Get affiliate stats
 */
export const getAffiliateStats = async (): Promise<AffiliateStats> => {
  return apiCall<AffiliateStats>('/affiliate/stats');
};

/**
 * Get affiliate commissions
 */
export const getAffiliateCommissions = async (
  page?: number
): Promise<{ commissions: AffiliateCommission[]; pagination: PaginationMeta }> => {
  const q = page ? `?page=${page}` : '';
  return apiCall<{ commissions: AffiliateCommission[]; pagination: PaginationMeta }>(`/affiliate/commissions${q}`);
};

/**
 * Get affiliate referrals
 */
export const getAffiliateReferrals = async (
  page?: number
): Promise<{ referrals: AffiliateReferral[]; pagination: PaginationMeta }> => {
  const q = page ? `?page=${page}` : '';
  return apiCall<{ referrals: AffiliateReferral[]; pagination: PaginationMeta }>(`/affiliate/referrals${q}`);
};

/**
 * Get affiliate payouts
 */
export const getAffiliatePayouts = async (
  page?: number
): Promise<{ payouts: AffiliatePayout[]; pagination: PaginationMeta }> => {
  const q = page ? `?page=${page}` : '';
  return apiCall<{ payouts: AffiliatePayout[]; pagination: PaginationMeta }>(`/affiliate/payouts${q}`);
};

/**
 * Request affiliate payout to credit
 */
export const requestAffiliatePayout = async (amount: number): Promise<{ success: boolean; payout: AffiliatePayout }> => {
  return apiCall<{ success: boolean; payout: AffiliatePayout }>('/affiliate/payout', {
    method: 'POST',
    body: JSON.stringify({ amount, method: 'credit' }),
  });
};

// ============================================
// ADMIN AFFILIATE
// ============================================

export interface AdminAffiliateStats {
  total_affiliates: number;
  active_affiliates: number;
  total_commissions: number;
  pending_payouts: number;
}

export interface AdminAffiliateAccount extends AffiliateAccount {
  user_email?: string;
  user_first_name?: string;
  user_last_name?: string;
}

/**
 * Admin: Get affiliate overview stats
 */
export const getAdminAffiliateStats = async (): Promise<AdminAffiliateStats> => {
  return apiCall<AdminAffiliateStats>('/admin/affiliate/stats');
};

/**
 * Admin: Get all affiliate accounts
 */
export const getAdminAffiliateAccounts = async (
  params?: { page?: number; search?: string }
): Promise<{ accounts: AdminAffiliateAccount[]; pagination: PaginationMeta }> => {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.search) q.set('search', params.search);
  const qs = q.toString() ? `?${q.toString()}` : '';
  return apiCall<{ accounts: AdminAffiliateAccount[]; pagination: PaginationMeta }>(`/admin/affiliate/accounts${qs}`);
};

/**
 * Admin: Update affiliate account
 */
export const updateAdminAffiliateAccount = async (
  id: number,
  data: { commission_rate?: number; tier?: string; is_active?: boolean }
): Promise<{ success: boolean; account: AffiliateAccount }> => {
  return apiCall<{ success: boolean; account: AffiliateAccount }>(`/admin/affiliate/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

/**
 * Admin: Get all commissions
 */
export const getAdminAffiliateCommissions = async (
  params?: { page?: number; status?: string }
): Promise<{ commissions: (AffiliateCommission & { user_email?: string; referral_code?: string })[]; pagination: PaginationMeta }> => {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.status) q.set('status', params.status);
  const qs = q.toString() ? `?${q.toString()}` : '';
  return apiCall<{ commissions: (AffiliateCommission & { user_email?: string; referral_code?: string })[]; pagination: PaginationMeta }>(`/admin/affiliate/commissions${qs}`);
};

/**
 * Admin: Approve or reject a commission
 */
export const updateAdminCommissionStatus = async (
  id: number,
  status: 'approved' | 'rejected'
): Promise<{ success: boolean }> => {
  return apiCall<{ success: boolean }>(`/admin/affiliate/commissions/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
};

/**
 * Admin: Bulk approve commissions
 */
export const bulkApproveCommissions = async (ids: number[]): Promise<{ success: boolean; updated: number }> => {
  return apiCall<{ success: boolean; updated: number }>('/admin/affiliate/commissions/bulk-approve', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
};

/**
 * Admin: Get all payouts
 */
export const getAdminAffiliatePayouts = async (
  params?: { page?: number; status?: string }
): Promise<{ payouts: (AffiliatePayout & { user_email?: string; referral_code?: string })[]; pagination: PaginationMeta }> => {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.status) q.set('status', params.status);
  const qs = q.toString() ? `?${q.toString()}` : '';
  return apiCall<{ payouts: (AffiliatePayout & { user_email?: string; referral_code?: string })[]; pagination: PaginationMeta }>(`/admin/affiliate/payouts${qs}`);
};

/**
 * Admin: Process or reject a payout
 */
export const updateAdminPayoutStatus = async (
  id: number,
  status: 'completed' | 'rejected'
): Promise<{ success: boolean }> => {
  return apiCall<{ success: boolean }>(`/admin/affiliate/payouts/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
};

// ============================================
// Activity Log
// ============================================

export interface ActivityLogEntry {
  action: string;
  action_label: string;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  created_at: string;
}

export async function getActivityLog(page?: number): Promise<{ activities: ActivityLogEntry[]; pagination: PaginationMeta }> {
  return apiCall<{ activities: ActivityLogEntry[]; pagination: PaginationMeta }>(`/profile/activity?page=${page || 1}`);
}

// ============================================
// GDPR
// ============================================

export async function exportAccountData(): Promise<Blob> {
  const headers = {
    ...getAuthHeader(),
    ...getCsrfHeaders('GET'),
  };

  const response = await fetch(`${API_BASE_URL}/account/export`, {
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to export account data');
  }

  return response.blob();
}

export async function deleteAccount(password: string): Promise<void> {
  await apiCall<{ success: boolean; message: string }>('/account', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
}

// ============================================
// Status Page
// ============================================

export interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'major_outage';
  uptime_30d: number;
}

export interface StatusIncident {
  id: number;
  title: string;
  description: string | null;
  severity: 'minor' | 'major' | 'critical';
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  affected_services: string[] | null;
  started_at: string;
  resolved_at: string | null;
  created_at: string;
}

export interface StatusData {
  overall_status: 'operational' | 'degraded' | 'major_outage';
  services: ServiceStatus[];
  incidents: StatusIncident[];
}

export async function getServerStatus(): Promise<StatusData> {
  const response = await fetch(`${API_BASE_URL}/status`);
  if (!response.ok) {
    throw new Error('Failed to fetch server status');
  }
  return response.json();
}
