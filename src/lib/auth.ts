import { createClient } from '@supabase/supabase-js';
import type {
  UserProfile,
  RegistrationData,
  LoginData,
  OAuthProvider
} from '../types/auth';

// Configuration - použití čistě Supabase Auth
// SECURITY: API klíče musí být v environment variables, ne hardcoded!
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ SECURITY ERROR: Missing Supabase configuration in environment variables!');
  throw new Error('Missing required Supabase configuration. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your .env file.');
}

// Vytvoření Supabase klienta s optimálním nastavením
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
});

// ==============================================
// HELPER FUNKCE PRO VALIDACI
// ==============================================

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Heslo musí mít alespoň 8 znaků');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Heslo musí obsahovat alespoň jedno velké písmeno');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Heslo musí obsahovat alespoň jedno malé písmeno');
  }
  if (!/\d/.test(password)) {
    errors.push('Heslo musí obsahovat alespoň jednu číslici');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateRegistrationData = (data: RegistrationData): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};

  if (!validateEmail(data.email)) {
    errors.email = 'Zadejte platnou emailovou adresu';
  }

  if (!data.firstName || data.firstName.trim().length < 2) {
    errors.firstName = 'Jméno musí mít alespoň 2 znaky';
  }

  if (!data.lastName || data.lastName.trim().length < 2) {
    errors.lastName = 'Příjmení musí mít alespoň 2 znaky';
  }

  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.errors[0];
  }

  if (!data.agreeToTerms) {
    errors.terms = 'Musíte souhlasit s obchodními podmínkami';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// ==============================================
// REGISTRACE (Email/Password)
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

    // Registrace přes Supabase Auth
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    });

    if (error) {
      console.error('Sign up error:', error);

      // Zpracování specifických chyb
      if (error.message.includes('already registered')) {
        return { success: false, error: 'Tento email je již registrován' };
      }
      if (error.message.includes('Password')) {
        return { success: false, error: 'Heslo je příliš slabé' };
      }

      return { success: false, error: error.message };
    }

    return {
      success: true,
      user: authData.user as any,
      message: 'Registrace úspěšná! Zkontrolujte svůj email pro potvrzení.'
    };
  } catch (error: any) {
    console.error('Sign up error:', error);
    return { success: false, error: 'Nastala neočekávaná chyba při registraci' };
  }
};

// ==============================================
// PŘIHLÁŠENÍ (Email/Password)
// ==============================================

export const signIn = async (data: LoginData) => {
  try {
    if (!validateEmail(data.email)) {
      return { success: false, error: 'Neplatná emailová adresa' };
    }

    if (!data.password) {
      return { success: false, error: 'Zadejte heslo' };
    }

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      console.error('Sign in error:', error);

      if (error.message.includes('Invalid login credentials')) {
        return { success: false, error: 'Nesprávný email nebo heslo' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { success: false, error: 'Email nebyl potvrzen. Zkontrolujte svou emailovou schránku.' };
      }

      return { success: false, error: error.message };
    }

    // Aktualizace last_login
    if (authData.user) {
      try {
        await supabase
          .from('profiles')
          .update({ last_login: new Date().toISOString() })
          .eq('id', authData.user.id);
      } catch (err) {
        console.warn('Failed to update last_login:', err);
      }
    }

    return {
      success: true,
      user: authData.user as any,
      session: authData.session
    };
  } catch (error: any) {
    console.error('Sign in error:', error);
    return { success: false, error: 'Nastala neočekávaná chyba při přihlášení' };
  }
};

// ==============================================
// OAUTH PŘIHLÁŠENÍ (Google, GitHub)
// ==============================================

export const signInWithOAuth = async (provider: OAuthProvider) => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });

    if (error) {
      console.error(`OAuth ${provider} error:`, error);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error(`OAuth ${provider} error:`, error);
    throw error;
  }
};

// ==============================================
// ODHLÁŠENÍ
// ==============================================

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Sign out error:', error);
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

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      console.error('Reset password error:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: 'Email pro resetování hesla byl odeslán'
    };
  } catch (error: any) {
    console.error('Reset password error:', error);
    return { success: false, error: 'Nastala chyba při resetování hesla' };
  }
};

// ==============================================
// AKTUALIZACE HESLA
// ==============================================

export const updatePassword = async (newPassword: string) => {
  try {
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return { success: false, error: passwordValidation.errors[0] };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error('Update password error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, message: 'Heslo bylo úspěšně změněno' };
  } catch (error: any) {
    console.error('Update password error:', error);
    return { success: false, error: 'Nastala chyba při změně hesla' };
  }
};

// ==============================================
// ZÍSKÁNÍ AKTUÁLNÍHO UŽIVATELE A SESSION
// ==============================================

export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      if (error.message.includes('Auth session missing')) {
        return null;
      }
      console.error('Get user error:', error);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
};

export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      if (error.message.includes('Auth session missing')) {
        return null;
      }
      console.error('Get session error:', error);
      return null;
    }

    return session;
  } catch (error) {
    console.error('Get session error:', error);
    return null;
  }
};

// ==============================================
// AUTH STATE CHANGE LISTENER
// ==============================================

export const onAuthStateChange = (callback: (user: any) => void) => {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
};

// ==============================================
// PROFIL MANAGEMENT
// ==============================================

// UserProfile interface je importovaný z types/auth.ts

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    console.log('🔍 Fetching profile for user:', userId);

    // Explicitně vyber všechny sloupce včetně is_admin
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, avatar_url, phone, is_admin, last_login, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.warn('⚠️ Profile not found for user:', userId);
        return null;
      }
      console.error('❌ Get profile error:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return null;
    }

    console.log('✅ Profile successfully loaded from database');
    console.log('📥 Full profile data:', JSON.stringify(data, null, 2));
    console.log('🔐 is_admin value:', data?.is_admin);
    console.log('🔐 is_admin type:', typeof data?.is_admin);

    return data;
  } catch (error) {
    console.error('❌ Unexpected error in getUserProfile:', error);
    return null;
  }
};

export const updateProfile = async (userId: string, updates: Partial<UserProfile>) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Update profile error:', error);
    return { success: false, error: 'Nastala chyba při aktualizaci profilu' };
  }
};

// ==============================================
// EXPORTS PRO KOMPATIBILITU
// ==============================================

// All types are imported from types/auth.ts

// Vytvoření profilu se teď dělá automaticky přes SQL trigger
// Tato funkce je jen pro explicitní vytvoření pokud by trigger selhal
export const createUserProfile = async (user: any): Promise<UserProfile | null> => {
  try {
    // Zkontroluj jestli profil už neexistuje
    const existingProfile = await getUserProfile(user.id);
    if (existingProfile) {
      return existingProfile;
    }

    // Vytvoř profil
    const profileData = {
      id: user.id,
      email: user.email,
      first_name: user.user_metadata?.first_name || '',
      last_name: user.user_metadata?.last_name || '',
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
      provider: user.app_metadata?.provider || 'email',
      email_verified: user.email_confirmed_at !== null,
    };

    const { data, error } = await supabase
      .from('profiles')
      .insert([profileData])
      .select()
      .single();

    if (error) {
      console.error('Create profile error:', error);
      return profileData as UserProfile;
    }

    return data;
  } catch (error) {
    console.warn('Create profile error:', error);
    return null;
  }
};
