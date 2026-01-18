// Database API Service
// Nahrazuje Supabase databázové dotazy s vlastním API

import { getCurrentUser, getAuthHeader, refreshAccessToken } from './auth';

// API Base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Helper pro API volání s automatickým refresh tokenu
async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Pokud je token neplatný, zkus refresh
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers = {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
        ...options.headers,
      };
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
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
  const result = await apiCall<any>('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });

  if (result.success) {
    return result.order;
  }
  throw new Error(result.error || 'Failed to create order');
};

export const getOrders = async (): Promise<Order[]> => {
  const result = await apiCall<{ orders: Order[] }>('/orders');
  return result.orders || [];
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

export { getCurrentUser, signOut, onAuthStateChange } from './auth';

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
    const result = await apiCall<any>(`/profile/${targetUserId}`);
    return result.profile || null;
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
  const result = await apiCall<any>('/profile', {
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
  const result = await apiCall<any>('/orders/hosting', {
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
  const result = await apiCall<any>('/tickets', {
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
 * Získá všechny hosting služby uživatele (včetně vypršených)
 */
export const getAllUserHostingServices = async (): Promise<HostingService[]> => {
  try {
    const result = await apiCall<{ services: HostingService[] }>('/hosting-services');
    return result.services || [];
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
