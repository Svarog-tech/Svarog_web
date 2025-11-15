-- Jednoduchá oprava RLS policies - BEZ rekurze!

-- 1. Smazat VŠECHNY existující policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable all access for authenticated users to own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for anon during registration" ON public.profiles;
DROP POLICY IF EXISTS "Service role can do anything" ON public.profiles;

-- 2. Zapnout RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. JEDNODUCHÁ POLICY - každý vidí jen svůj profil
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 4. Každý může upravit jen svůj profil
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 5. Vytvoření profilu
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 6. Grant permissions
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;

-- 7. Nastav svůj účet jako admin
UPDATE public.profiles
SET is_admin = TRUE
WHERE email = 'adam.broz.cz@gmail.com';

-- 8. Zkontroluj výsledek
SELECT id, email, first_name, last_name, is_admin, created_at
FROM public.profiles
WHERE email = 'adam.broz.cz@gmail.com';
