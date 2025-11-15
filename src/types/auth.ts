import { User as SupabaseUser } from '@supabase/supabase-js';

// Basic User Profile Interface
export interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  address?: string;
  company?: string;
  provider?: string;
  provider_id?: string;
  email_verified?: boolean;
  two_factor_enabled?: boolean;
  newsletter_subscription?: boolean;
  is_admin?: boolean;
  created_at?: string;
  updated_at?: string;
  last_login?: string;
}

// Extended User with Profile Data
export interface AppUser extends SupabaseUser {
  profile?: UserProfile;
}

// Registration Data
export interface RegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  agreeToTerms: boolean;
}

// Login Data
export interface LoginData {
  email: string;
  password: string;
}

// Auth State
export interface AuthState {
  user: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
}

// Auth Context Interface
export interface AuthContextType extends AuthState {
  signUp: (data: RegistrationData) => Promise<AuthResult>;
  signIn: (data: LoginData) => Promise<AuthResult>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
}

// OAuth Providers
export type OAuthProvider = 'google' | 'github';

// Auth Operation Result
export interface AuthResult {
  success: boolean;
  error?: string;
  message?: string;
  user?: AppUser | null;
  session?: any;
}

// Auth Error Types
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'invalid_credentials',
  EMAIL_ALREADY_EXISTS = 'email_already_exists',
  WEAK_PASSWORD = 'weak_password',
  EMAIL_NOT_CONFIRMED = 'email_not_confirmed',
  NETWORK_ERROR = 'network_error',
  UNKNOWN_ERROR = 'unknown_error',
  OAUTH_ERROR = 'oauth_error',
  PROFILE_UPDATE_ERROR = 'profile_update_error',
}

export interface AuthError {
  type: AuthErrorType;
  message: string;
  originalError?: any;
}

// Form Validation
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// Password Requirements
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

// Auth Configuration
export interface AuthConfig {
  redirectTo: string;
  passwordRequirements: PasswordRequirements;
  enabledOAuthProviders: OAuthProvider[];
  sessionTimeout: number;
}