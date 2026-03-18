// Authentication Service
// Používá vlastní backend API místo Supabase

import type {
  UserProfile,
  RegistrationData,
  LoginData,
  OAuthProvider,
  AppUser,
} from '../types/auth';
import { API_BASE_URL } from './apiConfig';

// ==============================================
// TOKEN MANAGEMENT
// SECURITY: Access token v paměti (ne localStorage), refresh token v httpOnly cookie
// ==============================================

// Access token uložený v paměti + localStorage jako fallback pro page refresh
let accessTokenInMemory: string | null = null;
const TOKEN_STORAGE_KEY = 'alatyr_access_token';

function setAccessToken(token: string): void {
  accessTokenInMemory = token;
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // localStorage nedostupný (private mode apod.)
  }
}

function getAccessToken(): string | null {
  if (accessTokenInMemory) return accessTokenInMemory;
  // Fallback: obnov z localStorage po page refresh / HMR
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      accessTokenInMemory = stored;
      return stored;
    }
  } catch {
    // localStorage nedostupný
  }
  return null;
}

/**
 * Refresh token je uložený v httpOnly cookie na backendu.
 * Frontend ho nepotřebuje číst - cookie se posílá automaticky s credentials: 'include'.
 */
function clearTokens(): void {
  accessTokenInMemory = null;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // localStorage nedostupný
  }
  // Refresh token cookie se smaže přes /api/auth/logout endpoint
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
  try {
    // Refresh token je v httpOnly cookie - posílá se automaticky přes credentials: 'include'
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Guard': '1',
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (data.success && data.accessToken) {
      setAccessToken(data.accessToken);
      return true;
    }

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

    // Registrace přes API (credentials: 'include' pro httpOnly cookie s refresh tokenem)
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Guard': '1',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      }),
    });

    const result = await response.json();

    if (result.success && result.accessToken) {
      // Access token do paměti, refresh token přijde jako httpOnly cookie
      setAccessToken(result.accessToken);

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
        'X-CSRF-Guard': '1',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        mfaCode: data.mfaCode,
      }),
    });

    // Bezpečné parsování odpovědi – zkus JSON i při chybových status kódech
    let result: any = null;
    const contentType = response.headers.get('content-type') || '';
    
    try {
      if (contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // Zkus parsovat jako JSON i když content-type není správný
        const text = await response.text();
        try {
          result = JSON.parse(text);
        } catch {
          // Pokud to není JSON, použij text jako error message
          result = { 
            success: false, 
            error: text || `Chyba serveru (${response.status} ${response.statusText})` 
          };
        }
      }
    } catch (parseError) {
      // Pokud parsování selže úplně
      result = { 
        success: false, 
        error: `Chyba při zpracování odpovědi serveru (${response.status})` 
      };
    }
    
    // Pokud server vrátil chybový status a result nemá error, přidej ho
    if (!response.ok && !result.error) {
      result.error = result.message || `Chyba serveru (${response.status})`;
    }

    if (result.success && result.accessToken) {
      // Access token do paměti, refresh token přijde jako httpOnly cookie
      setAccessToken(result.accessToken);

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
        },
      };
    }

    // Zpracuj chybovou odpověď
    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || result.message || `Chyba při přihlášení (${response.status})`,
        mfaRequired: !!result.mfaRequired,
      };
    }

    return {
      success: false,
      error: result.error || 'Nesprávný email nebo heslo',
      mfaRequired: !!result.mfaRequired,
    };
  } catch (error: any) {
    console.error('Sign in error:', error);
    return { 
      success: false, 
      error: error.message || 'Nastala neočekávaná chyba při přihlášení' 
    };
  }
};

// ==============================================
// OAUTH PŘIHLÁŠENÍ
// ==============================================

export const signInWithOAuth = async (provider: OAuthProvider) => {
  if (typeof window === 'undefined') {
    return;
  }

  // OAuth flow je řešený na backendu (redirect na Google/GitHub, vytvoření session, návrat na /auth/callback)
  // Frontend pouze přesměruje na start endpoint.
  const redirectUrl = `${window.location.origin}/auth/callback`;
  const url = `${API_BASE_URL}/auth/oauth/${provider}/start?redirect=${encodeURIComponent(redirectUrl)}`;

  window.location.href = url;
};

// ==============================================
// ODHLÁŠENÍ
// ==============================================

export const signOut = async () => {
  try {
    // Refresh token je v httpOnly cookie - posílá se automaticky
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Guard': '1',
        },
        credentials: 'include',
      });
    } catch (error) {
      console.warn('Logout API call failed:', error);
    }

    // Smaž access token z paměti
    clearTokens();

    return { success: true };
  } catch (error: any) {
    console.error('Sign out error:', error);
    clearTokens();
    return { success: false, error: 'Nastala chyba při odhlašování' };
  }
};

/**
 * Odhlášení ze všech zařízení (invalidace všech refresh tokenů uživatele)
 */
export const signOutAllDevices = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const token = getAccessToken();
    const response = await fetch(`${API_BASE_URL}/auth/logout-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Guard': '1',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { success: false, error: data.error || 'Odhlášení ze všech zařízení se nezdařilo' };
    }

    clearTokens();
    return { success: true };
  } catch (error: unknown) {
    console.error('SignOutAll error:', error);
    clearTokens();
    return { success: false, error: 'Nastala chyba při odhlašování ze všech zařízení' };
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

    // Backend endpoint: POST /api/auth/reset-password-request
    const response = await fetch(`${API_BASE_URL}/auth/reset-password-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Guard': '1',
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

export const updatePassword = async (newPassword: string, oldPassword: string) => {
  try {
    if (!oldPassword || oldPassword.trim().length === 0) {
      return { success: false, error: 'Zadejte současné heslo' };
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return { success: false, error: passwordValidation.errors[0] };
    }

    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Guard': '1',
        ...getAuthHeader(),
      },
      credentials: 'include',
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
    let token = getAccessToken();

    // Když není access token v paměti (např. po refreshi) – dříve: return null BEZ api volání; nyní zkus obnovit z refresh cookie
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        return null;
      }
      token = getAccessToken();
    }

    // Zkus refresh token pokud je access token neplatný
    // Backend endpoint: GET /api/auth/user
    let response = await fetch(`${API_BASE_URL}/auth/user`, {
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
      response = await fetch(`${API_BASE_URL}/auth/user`, {
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

  if (!token) {
    return null;
  }

  return {
    access_token: token,
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
    // Backend endpoint: GET /api/auth/user
    const response = await fetch(`${API_BASE_URL}/auth/user`, {
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

      const retryResponse = await fetch(`${API_BASE_URL}/auth/user`, {
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
    const response = await fetch(`${API_BASE_URL}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Guard': '1',
        ...getAuthHeader(),
      },
      credentials: 'include',
      body: JSON.stringify({ userId, ...updates }),
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

export { getAuthHeader, getAccessToken, setAccessToken, refreshAccessToken };
