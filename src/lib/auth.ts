// Authentication Service
// Používá vlastní backend API místo Supabase

import type {
  UserProfile,
  RegistrationData,
  LoginData,
  OAuthProvider,
  AppUser,
} from '../types/auth';

// API Base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Token storage keys
const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

// ==============================================
// TOKEN MANAGEMENT
// ==============================================

/**
 * Uloží access token do localStorage
 */
function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

/**
 * Získá access token z localStorage
 */
function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Uloží refresh token do localStorage
 */
function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

/**
 * Získá refresh token z localStorage
 */
function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Smaže všechny tokeny
 */
function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Získá authorization header s tokenem
 */
function getAuthHeader(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Refresh access token pomocí refresh tokenu
 */
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (data.success && data.accessToken) {
      setAccessToken(data.accessToken);
      return true;
    }

    // Refresh token je neplatný, smaž tokeny
    clearTokens();
    return false;
  } catch (error) {
    console.error('Token refresh error:', error);
    clearTokens();
    return false;
  }
}

// ==============================================
// HELPER FUNKCE PRO VALIDACI
// ==============================================

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string, t?: (key: string) => string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push(t ? t('validation.password.min8') : 'Heslo musí mít alespoň 8 znaků');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push(t ? t('validation.password.uppercase') : 'Heslo musí obsahovat alespoň jedno velké písmeno');
  }
  if (!/[a-z]/.test(password)) {
    errors.push(t ? t('validation.password.lowercase') : 'Heslo musí obsahovat alespoň jedno malé písmeno');
  }
  if (!/\d/.test(password)) {
    errors.push(t ? t('validation.password.digit') : 'Heslo musí obsahovat alespoň jednu číslici');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateRegistrationData = (data: RegistrationData, t?: (key: string) => string): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};

  if (!validateEmail(data.email)) {
    errors.email = t ? t('validation.email.invalid') : 'Zadejte platnou emailovou adresu';
  }

  if (!data.firstName || data.firstName.trim().length < 2) {
    errors.firstName = t ? t('validation.firstName.min2') : 'Jméno musí mít alespoň 2 znaky';
  }

  if (!data.lastName || data.lastName.trim().length < 2) {
    errors.lastName = t ? t('validation.lastName.min2') : 'Příjmení musí mít alespoň 2 znaky';
  }

  const passwordValidation = validatePassword(data.password, t);
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.errors[0];
  }

  if (!data.agreeToTerms) {
    errors.terms = t ? t('registration.errors.termsRequired') : 'Musíte souhlasit s obchodními podmínkami';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// ==============================================
// REGISTRACE
// ==============================================

export const signUp = async (data: RegistrationData) => {
  try {
    // Validace
    if (!validateEmail(data.email)) {
      return { success: false, error: 'Neplatná emailová adresa' };
    }

    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.isValid) {
      return { success: false, error: passwordValidation.errors[0] };
    }

    if (!data.agreeToTerms) {
      return { success: false, error: 'Musíte souhlasit s obchodními podmínkami' };
    }

    // Registrace přes API
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      }),
    });

    const result = await response.json();

    if (result.success && result.accessToken && result.refreshToken) {
      // Ulož tokeny
      setAccessToken(result.accessToken);
      setRefreshToken(result.refreshToken);

      // Převeď user na AppUser formát
      const appUser: AppUser = {
        id: result.user.id,
        email: result.user.email,
        user_metadata: {
          first_name: result.user.first_name,
          last_name: result.user.last_name,
        },
        app_metadata: {
          provider: 'email',
        },
        email_confirmed_at: result.user.email_verified ? new Date().toISOString() : undefined,
      };

      return {
        success: true,
        user: appUser,
        message: result.message || 'Registrace úspěšná!',
      };
    }

    return {
      success: false,
      error: result.error || 'Registrace se nezdařila',
    };
  } catch (error: any) {
    console.error('Sign up error:', error);
    return { success: false, error: 'Nastala neočekávaná chyba při registraci' };
  }
};

// ==============================================
// PŘIHLÁŠENÍ
// ==============================================

export const signIn = async (data: LoginData) => {
  try {
    if (!validateEmail(data.email)) {
      return { success: false, error: 'Neplatná emailová adresa' };
    }

    if (!data.password) {
      return { success: false, error: 'Zadejte heslo' };
    }

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
      }),
    });

    const result = await response.json();

    if (result.success && result.accessToken && result.refreshToken) {
      // Ulož tokeny
      setAccessToken(result.accessToken);
      setRefreshToken(result.refreshToken);

      // Převeď user na AppUser formát
      const appUser: AppUser = {
        id: result.user.id,
        email: result.user.email,
        user_metadata: {
          first_name: result.user.first_name,
          last_name: result.user.last_name,
        },
        app_metadata: {
          provider: 'email',
        },
        email_confirmed_at: result.user.email_verified ? new Date().toISOString() : undefined,
      };

      return {
        success: true,
        user: appUser,
        session: {
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
        },
      };
    }

    return {
      success: false,
      error: result.error || 'Nesprávný email nebo heslo',
    };
  } catch (error: any) {
    console.error('Sign in error:', error);
    return { success: false, error: 'Nastala neočekávaná chyba při přihlášení' };
  }
};

// ==============================================
// OAUTH PŘIHLÁŠENÍ (TODO: Implementovat pokud je potřeba)
// ==============================================

export const signInWithOAuth = async (provider: OAuthProvider) => {
  // TODO: Implementovat OAuth pokud je potřeba
  throw new Error('OAuth není momentálně podporováno');
};

// ==============================================
// ODHLÁŠENÍ
// ==============================================

export const signOut = async () => {
  try {
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      // Zavolej API pro logout
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });
      } catch (error) {
        console.warn('Logout API call failed:', error);
      }
    }

    // Smaž tokeny lokálně
    clearTokens();

    return { success: true };
  } catch (error: any) {
    console.error('Sign out error:', error);
    clearTokens(); // Smaž tokeny i při chybě
    return { success: false, error: 'Nastala chyba při odhlašování' };
  }
};

// ==============================================
// RESETOVÁNÍ HESLA
// ==============================================

export const resetPassword = async (email: string) => {
  try {
    if (!validateEmail(email)) {
      return { success: false, error: 'Neplatná emailová adresa' };
    }

    const response = await fetch(`${API_BASE_URL}/auth/request-password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        message: result.message || 'Email pro resetování hesla byl odeslán',
      };
    }

    return {
      success: false,
      error: result.error || 'Zaslání emailu se nezdařilo',
    };
  } catch (error: any) {
    console.error('Reset password error:', error);
    return { success: false, error: 'Nastala chyba při resetování hesla' };
  }
};

// ==============================================
// AKTUALIZACE HESLA
// ==============================================

export const updatePassword = async (newPassword: string, oldPassword?: string) => {
  try {
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return { success: false, error: passwordValidation.errors[0] };
    }

    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ oldPassword, newPassword }),
    });

    const result = await response.json();

    if (result.success) {
      return { success: true, message: result.message || 'Heslo bylo úspěšně změněno' };
    }

    return {
      success: false,
      error: result.error || 'Změna hesla se nezdařila',
    };
  } catch (error: any) {
    console.error('Update password error:', error);
    return { success: false, error: 'Nastala chyba při změně hesla' };
  }
};

// ==============================================
// ZÍSKÁNÍ AKTUÁLNÍHO UŽIVATELE
// ==============================================

export const getCurrentUser = async (): Promise<AppUser | null> => {
  try {
    const token = getAccessToken();

    if (!token) {
      return null;
    }

    // Zkus refresh token pokud je access token neplatný
    let response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        ...getAuthHeader(),
      },
    });

    // Pokud je token neplatný, zkus refresh
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        return null;
      }

      // Zkus znovu s novým tokenem
      response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          ...getAuthHeader(),
        },
      });
    }

    if (!response.ok) {
      return null;
    }

    const result = await response.json();

    if (result.success && result.user) {
      const user = result.user;
      return {
        id: user.id,
        email: user.email,
        user_metadata: {
          first_name: user.first_name,
          last_name: user.last_name,
        },
        app_metadata: {
          provider: 'email',
        },
        email_confirmed_at: user.email_verified ? new Date().toISOString() : undefined,
      };
    }

    return null;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
};

export const getCurrentSession = async () => {
  const token = getAccessToken();
  const refreshToken = getRefreshToken();

  if (!token) {
    return null;
  }

  return {
    access_token: token,
    refresh_token: refreshToken,
  };
};

// ==============================================
// AUTH STATE CHANGE LISTENER (simulace)
// ==============================================

// Simulace auth state change listeneru
// V reálné aplikaci byste použili custom event system nebo state management
const authStateListeners: Set<(user: AppUser | null) => void> = new Set();

export const onAuthStateChange = (callback: (user: AppUser | null) => void) => {
  authStateListeners.add(callback);

  // Zavolej callback okamžitě s aktuálním uživatelem
  getCurrentUser().then(user => callback(user));

  return {
    data: {
      subscription: {
        unsubscribe: () => {
          authStateListeners.delete(callback);
        },
      },
    },
  };
};

// ==============================================
// PROFIL MANAGEMENT
// ==============================================

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!response.ok) {
      // Zkus refresh token
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        return null;
      }

      const retryResponse = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!retryResponse.ok) {
        return null;
      }

      const result = await retryResponse.json();
      if (result.success && result.user) {
        return result.user;
      }
      return null;
    }

    const result = await response.json();
    if (result.success && result.user) {
      return result.user;
    }

    return null;
  } catch (error) {
    console.error('Get user profile error:', error);
    return null;
  }
};

export const updateProfile = async (userId: string, updates: Partial<UserProfile>) => {
  try {
    // TODO: Implementovat update profile API endpoint na backendu
    // Prozatím použijeme existující /auth/me endpoint
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(updates),
    });

    const result = await response.json();

    if (result.success) {
      return { success: true };
    }

    return { success: false, error: result.error || 'Aktualizace profilu se nezdařila' };
  } catch (error: any) {
    console.error('Update profile error:', error);
    return { success: false, error: 'Nastala chyba při aktualizaci profilu' };
  }
};

export const createUserProfile = async (user: AppUser): Promise<UserProfile | null> => {
  // Profil se vytváří automaticky při registraci
  return await getUserProfile(user.id);
};

// ==============================================
// EXPORT getAuthHeader pro použití v jiných modulech
// ==============================================

export { getAuthHeader, getAccessToken, refreshAccessToken };
