// Import the properly configured Supabase client from auth.ts
import { supabase } from './auth';

export interface Order {
  id?: number;
  user_id?: string | null;
  plan_id: string;
  plan_name: string;
  price: number;
  customer_email: string;
  customer_name: string;
  status: 'pending' | 'completed' | 'failed';
  created_at?: string;
}

export const createOrder = async (orderData: Omit<Order, 'id' | 'created_at'>) => {
  const { data, error } = await supabase
    .from('user_orders')
    .insert([orderData])
    .select();

  if (error) throw error;
  return data[0];
};

export const getOrders = async () => {
  const { data, error } = await supabase
    .from('user_orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

// OAuth provider mapping
export const oauthProviders = {
  google: 'google',
  github: 'github'
} as const;

export type OAuthProvider = keyof typeof oauthProviders;

// OAuth sign in function
export const signInWithOAuth = async (provider: OAuthProvider) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as any,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  });

  if (error) {
    console.error(`OAuth ${provider} error:`, error);
    throw error;
  }

  return data;
};

// Get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    // Handle AuthSessionMissingError gracefully
    if (error.message.includes('AuthSessionMissingError') || error.message.includes('Auth session missing')) {
      console.warn('Auth session missing, user not authenticated');
      return null;
    }
    console.error('Get user error:', error);
    throw error;
  }

  return user;
};

// Sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

// Listen to auth changes
export const onAuthStateChange = (callback: (user: any) => void) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
};

// Registraci zpracovává auth.ts - tato funkce se nepoužívá

// Login with email and password
export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Login error:', error);
    throw error;
  }

  // Update last login
  if (data.user) {
    await updateLastLogin(data.user.id);
  }

  return data;
};

// Update last login timestamp
export const updateLastLogin = async (userId: string) => {
  try {
    const { error } = await supabase.rpc('update_last_login', {
      user_id: userId
    });

    if (error) {
      console.error('Update last login error:', error);
    }
  } catch (err) {
    console.error('Update last login error:', err);
  }
};

// Get user profile with stats - používá vlastní SQL funkci
export const getUserProfile = async (userId?: string) => {
  const targetUserId = userId || (await getCurrentUser())?.id;

  if (!targetUserId) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_user_profile', {
    user_id: targetUserId
  });

  if (error) {
    console.error('Get user profile error:', error);
    // Fallback - přímý přístup k profiles tabulce
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (profileError) {
      console.error('Fallback profile fetch error:', profileError);
      return null;
    }

    return profileData;
  }

  return data;
};

// Update user profile
export interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  avatarUrl?: string;
  newsletter?: boolean;
}

export const updateUserProfile = async (userId: string, data: ProfileUpdateData) => {
  const { data: result, error } = await supabase.rpc('update_user_profile', {
    user_id: userId,
    first_name: data.firstName,
    last_name: data.lastName,
    phone: data.phone,
    company: data.company,
    avatar_url: data.avatarUrl,
    newsletter: data.newsletter
  });

  if (error) {
    console.error('Update profile error:', error);
    throw error;
  }

  return result;
};

// Create hosting order
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
  const { data: result, error } = await supabase.rpc('create_hosting_order', {
    plan_id: data.planId,
    plan_name: data.planName,
    price: data.price,
    currency: data.currency || 'CZK',
    billing_email: data.billingEmail,
    billing_name: data.billingName,
    billing_company: data.billingCompany,
    billing_address: data.billingAddress,
    billing_phone: data.billingPhone,
    domain_name: data.domainName
  });

  if (error) {
    console.error('Create order error:', error);
    throw error;
  }

  return result;
};

// Get user orders - přímý přístup k tabulce místo RPC
export const getUserOrders = async (userId?: string) => {
  const targetUserId = userId || (await getCurrentUser())?.id;

  if (!targetUserId) {
    return [];
  }

  const { data, error } = await supabase
    .from('user_orders')
    .select('*')
    .eq('user_id', targetUserId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Get user orders error:', error);
    return [];
  }

  return data;
};

// Create support ticket
export interface SupportTicketData {
  subject: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
}

export const createSupportTicket = async (data: SupportTicketData) => {
  const { data: result, error } = await supabase.rpc('create_support_ticket', {
    subject: data.subject,
    message: data.message,
    priority: data.priority || 'medium',
    category: data.category || 'general'
  });

  if (error) {
    console.error('Create support ticket error:', error);
    throw error;
  }

  return result;
};

// Password reset
export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });

  if (error) {
    console.error('Password reset error:', error);
    throw error;
  }
};

// Update password
export const updatePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    console.error('Update password error:', error);
    throw error;
  }
};

// ============================================
// HOSTING SERVICES - Aktivní hostingy
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
export const getUserHostingServices = async () => {
  const { data, error } = await supabase
    .from('user_hosting_services')
    .select('*')
    .in('status', ['active', 'pending'])
    .order('activated_at', { ascending: false });

  if (error) {
    console.error('Error fetching hosting services:', error);
    throw error;
  }

  return data as HostingService[];
};

/**
 * Získá všechny hosting služby uživatele (včetně vypršených)
 */
export const getAllUserHostingServices = async () => {
  const { data, error } = await supabase
    .from('user_hosting_services')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all hosting services:', error);
    throw error;
  }

  return data as HostingService[];
};

/**
 * Získá detail konkrétní hosting služby
 */
export const getHostingService = async (serviceId: number) => {
  const { data, error } = await supabase
    .from('user_hosting_services')
    .select('*')
    .eq('id', serviceId)
    .single();

  if (error) {
    console.error('Error fetching hosting service:', error);
    throw error;
  }

  return data as HostingService;
};

/**
 * Aktualizace hosting služby (pouze admin)
 */
export const updateHostingService = async (serviceId: number, updates: Partial<HostingService>) => {
  const { data, error } = await supabase
    .from('user_hosting_services')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', serviceId)
    .select();

  if (error) {
    console.error('Error updating hosting service:', error);
    throw error;
  }

  return data[0] as HostingService;
};