import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type {
  AuthContextType,
  AuthState,
  AppUser,
  AuthResult,
  RegistrationData,
  LoginData,
  UserProfile,
  OAuthProvider,
} from '../types/auth';
import {
  signUp as authSignUp,
  signIn as authSignIn,
  signInWithOAuth as authSignInWithOAuth,
  signOut as authSignOut,
  resetPassword as authResetPassword,
  updateProfile as authUpdateProfile,
  getCurrentUser,
  getUserProfile,
  createUserProfile,
  onAuthStateChange,
} from '../lib/auth';
import { createHostingAccount } from '../services/hestiacpService';

// Create Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Vytvoří hosting účet v HestiaCP po registraci
 * Vytvoří jen uživatele v HestiaCP (bez domény), doména se přidá při objednávce
 * Účet bude mít přístup jen na web hosting, ne do HestiaCP panelu (běžný uživatel)
 */
const createHestiaCPAccount = async (user: AppUser, profile: UserProfile) => {
  try {
    const tempDomain = `temp-${user.id.substring(0, 8)}.hostingforge.eu`;

    const result = await createHostingAccount({
      email: user.email || profile.email,
      domain: tempDomain,
      package: 'default'
    });

    if (!result.success) {
      console.warn('[AuthContext] HestiaCP account creation deferred');
    }
  } catch (error) {
    console.warn('[AuthContext] HestiaCP account creation deferred');
  }
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth Provider Component
interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    initialized: false,
  });

  // Helper function to update state
  const updateState = useCallback((updates: Partial<AuthState>) => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);

  // Load user profile
  const loadUserProfile = useCallback(async (user: AppUser): Promise<UserProfile | null> => {
    try {
      let profile = await getUserProfile(user.id);

      if (!profile) {
        profile = await createUserProfile(user);
      }

      return profile;
    } catch (error) {
      console.error('Profile loading failed:', error);

      // Create a fallback profile from user metadata if database is not ready
      const fallbackProfile: UserProfile = {
        id: user.id,
        email: user.email || '',
        first_name: user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.last_name || '',
        avatar_url: user.user_metadata?.avatar_url,
        phone: user.user_metadata?.phone,
        is_admin: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return fallbackProfile;
    }
  }, []);

  // Handle auth state changes
  const handleAuthStateChange = useCallback(async (user: AppUser | null) => {
    if (user) {
      updateState({ loading: true });

      // Load user profile
      const profile = await loadUserProfile(user);

      updateState({
        user,
        profile,
        loading: false,
        initialized: true,
      });
    } else {
      updateState({
        user: null,
        profile: null,
        loading: false,
        initialized: true,
      });
    }
  }, [loadUserProfile, updateState]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get current user
        const user = await getCurrentUser();

        if (mounted) {
          await handleAuthStateChange(user);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          updateState({
            user: null,
            profile: null,
            loading: false,
            initialized: true,
          });
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, [handleAuthStateChange, updateState]);

  // Listen to auth changes
  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange(handleAuthStateChange);

    return () => {
      subscription.unsubscribe();
    };
  }, [handleAuthStateChange]);

  // Sign up function
  const signUp = useCallback(async (data: RegistrationData): Promise<AuthResult> => {
    updateState({ loading: true });

    try {
      const result = await authSignUp(data);

      if (result.success && result.user) {
        // Load profile for the new user
        const profile = await loadUserProfile(result.user);

        // Vytvoř hosting účet v HestiaCP (asynchronně, neblokuje registraci)
        if (profile && result.user.email) {
          createHestiaCPAccount(result.user, profile).catch(error => {
            console.error('[AuthContext] Failed to create HestiaCP account:', error);
            // Nezobrazuj chybu uživateli, protože registrace byla úspěšná
          });
        }

        updateState({
          user: result.user,
          profile,
          loading: false,
        });
      } else {
        updateState({ loading: false });
      }

      return result;
    } catch (error) {
      updateState({ loading: false });
      return {
        success: false,
        error: 'Registrace se nezdařila',
      };
    }
  }, [loadUserProfile, updateState]);

  // Sign in function
  const signIn = useCallback(async (data: LoginData): Promise<AuthResult> => {
    updateState({ loading: true });

    try {
      const result = await authSignIn(data);

      if (result.success && result.user) {
        // Load profile for the user
        const profile = await loadUserProfile(result.user);

        updateState({
          user: result.user,
          profile,
          loading: false,
        });
      } else {
        updateState({ loading: false });
      }

      return result;
    } catch (error) {
      updateState({ loading: false });
      return {
        success: false,
        error: 'Přihlášení se nezdařilo',
      };
    }
  }, [loadUserProfile, updateState]);

  // OAuth sign in function
  const signInWithOAuth = useCallback(async (provider: OAuthProvider): Promise<void> => {
    try {
      // OAuth redirects to callback page, so we don't handle state here
      await authSignInWithOAuth(provider);
    } catch (error) {
      console.error(`OAuth ${provider} error:`, error);
      throw error;
    }
  }, []);

  // Sign out function
  const signOut = useCallback(async (): Promise<void> => {
    updateState({ loading: true });

    try {
      await authSignOut();

      updateState({
        user: null,
        profile: null,
        loading: false,
      });
    } catch (error) {
      console.error('Sign out error:', error);
      updateState({ loading: false });
      throw error;
    }
  }, [updateState]);

  // Update profile function
  const updateProfile = useCallback(async (updates: Partial<UserProfile>): Promise<AuthResult> => {
    if (!state.user) {
      return {
        success: false,
        error: 'Uživatel není přihlášen',
      };
    }

    try {
      const result = await authUpdateProfile(state.user.id, updates);

      if (result.success && state.profile) {
        // Update local profile state
        const updatedProfile = { ...state.profile, ...updates };
        updateState({ profile: updatedProfile });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: 'Aktualizace profilu se nezdařila',
      };
    }
  }, [state.user, state.profile, updateState]);

  // Reset password function
  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      return await authResetPassword(email);
    } catch (error) {
      return {
        success: false,
        error: 'Resetování hesla se nezdařilo',
      };
    }
  }, []);

  // Context value
  const contextValue: AuthContextType = {
    user: state.user,
    profile: state.profile,
    loading: state.loading,
    initialized: state.initialized,
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    updateProfile,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Additional hooks for convenience
export const useUser = () => {
  const { user } = useAuth();
  return user;
};

export const useProfile = () => {
  const { profile } = useAuth();
  return profile;
};

export const useAuthLoading = () => {
  const { loading } = useAuth();
  return loading;
};

export const useIsAuthenticated = () => {
  const { user, initialized } = useAuth();
  return { isAuthenticated: !!user, initialized };
};