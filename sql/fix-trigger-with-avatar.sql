-- FIX pro Supabase Auth - PŘIDAT AVATAR_URL do triggeru
-- Tento script opraví trigger aby ukládal i profilovku z OAuth

-- 1. Dropni existující trigger a funkci
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Vytvoř novou verzi funkce S AVATAR_URL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Zkus vložit profil S AVATAR_URL
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    avatar_url,
    provider,
    email_verified
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    -- Zkus avatar_url nebo picture (Google používá picture)
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    COALESCE(NEW.app_metadata->>'provider', 'email'),
    COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE)
  )
  -- Pokud profil už existuje, aktualizuj ho
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), profiles.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), profiles.last_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    provider = COALESCE(EXCLUDED.provider, profiles.provider),
    email_verified = EXCLUDED.email_verified,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Logni chybu, ale nezbouchni celou registraci
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- 3. Vytvoř trigger znovu
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- HOTOVO! Nyní by se měla ukládat i profilovka z OAuth!
