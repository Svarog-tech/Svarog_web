-- FIX pro Supabase Auth Registration Issue
-- Tento script opraví problém s trigger funkcí handle_new_user()

-- 1. Nejdřív dropni existující trigger a funkci
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Vytvoř novou verzi funkce s lepším error handlingem
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER -- Toto zajistí, že funkce běží s právy vlastníka (bypasse RLS)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Zkus vložit profil
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    provider,
    email_verified
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.app_metadata->>'provider', 'email'),
    COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE)
  )
  -- Pokud profil už existuje, aktualizuj ho
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
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

-- 4. Uprav RLS policy pro profiles, aby povolila insert během triggeru
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Nová policy, která umožňuje insert i během triggeru
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id OR
    -- Povolit insert během trigger funkce (když auth.uid() ještě není nastaven)
    auth.uid() IS NULL
  );

-- 5. Vytvoř policy pro service role (bypass všechno)
CREATE POLICY "Service role can do anything"
  ON public.profiles
  USING (auth.jwt()->>'role' = 'service_role');

-- HOTOVO! Nyní by registrace měla fungovat.
