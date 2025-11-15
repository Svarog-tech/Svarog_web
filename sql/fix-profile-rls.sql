-- Fix RLS policies pro profiles tabulku
-- Umožní uživatelům číst a upravovat VLASTNÍ profily

-- Nejprve smažeme všechny existující policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;

-- Povolit RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Uživatelé vidí VLASTNÍ profil
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Uživatelé mohou upravovat VLASTNÍ profil
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Policy 3: Uživatelé mohou vytvořit VLASTNÍ profil (při registraci)
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy 4: Admini vidí VŠECHNY profily
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Policy 5: Admini mohou upravovat VŠECHNY profily
CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Zkontroluj že profil existuje
-- Pokud neexistuje, vytvoř ho ručně
-- UPDATE: Nahraď 'tvuj-email@example.com' svým emailem!

-- Zkontroluj jestli profil existuje:
SELECT id, email, is_admin
FROM public.profiles
WHERE email = 'adam.broz.cz@gmail.com';

-- Pokud profil NEEXISTUJE, vytvoř ho:
-- INSERT INTO public.profiles (id, email, first_name, last_name, is_admin, created_at, updated_at)
-- SELECT
--   id,
--   email,
--   raw_user_meta_data->>'first_name' as first_name,
--   raw_user_meta_data->>'last_name' as last_name,
--   TRUE as is_admin,
--   NOW() as created_at,
--   NOW() as updated_at
-- FROM auth.users
-- WHERE email = 'adam.broz.cz@gmail.com';

-- Pokud profil EXISTUJE, jen nastav is_admin:
UPDATE public.profiles
SET is_admin = TRUE
WHERE email = 'adam.broz.cz@gmail.com';
