-- Komplexní oprava admin funkcionality
-- Tento script vyřeší všechny možné problémy s is_admin polem

-- 1. NEJPRVE VYPNI RLS (dočasně, abychom mohli vše zkontrolovat)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Ujisti se, že sloupec is_admin existuje a má správný typ
DO $$
BEGIN
    -- Pokud sloupec neexistuje, vytvoř ho
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'is_admin'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
    END IF;

    -- Ujisti se, že má správnou default hodnotu
    ALTER TABLE public.profiles ALTER COLUMN is_admin SET DEFAULT FALSE;
    ALTER TABLE public.profiles ALTER COLUMN is_admin SET NOT NULL;
END $$;

-- 3. Nastav is_admin = TRUE pro tvůj účet
UPDATE public.profiles
SET is_admin = TRUE, updated_at = NOW()
WHERE email = 'adam.broz.cz@gmail.com';

-- 4. Zkontroluj, že UPDATE fungoval
SELECT
    email,
    is_admin,
    CASE
        WHEN is_admin = TRUE THEN '✅ ADMIN JE NASTAVEN'
        WHEN is_admin = FALSE THEN '❌ ADMIN NENÍ NASTAVEN'
        ELSE '⚠️ IS_ADMIN JE NULL'
    END as status
FROM public.profiles
WHERE email = 'adam.broz.cz@gmail.com';

-- 5. Smaž VŠECHNY existující RLS policies
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

-- 6. ZAPNI RLS zpět
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 7. Vytvoř JEDNODUCHÉ policies - bez jakékoliv rekurze
-- Policy pro čtení vlastního profilu (včetně is_admin pole!)
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy pro úpravu vlastního profilu
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy pro vytvoření profilu při registraci
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 8. Grant explicitní permissions na všechny sloupce včetně is_admin
GRANT SELECT (id, email, first_name, last_name, avatar_url, phone, is_admin, last_login, created_at, updated_at)
  ON public.profiles TO authenticated;

GRANT UPDATE (email, first_name, last_name, avatar_url, phone, updated_at)
  ON public.profiles TO authenticated;

GRANT INSERT (id, email, first_name, last_name, avatar_url, phone, is_admin, created_at, updated_at)
  ON public.profiles TO authenticated;

-- 9. Finální kontrola - toto by mělo vrátit tvůj profil s is_admin = TRUE
SELECT
    id,
    email,
    first_name,
    last_name,
    is_admin,
    CASE
        WHEN is_admin = TRUE THEN '✅ SUCCESS - ADMIN ROLE IS SET!'
        ELSE '❌ FAILED - SOMETHING IS WRONG'
    END as final_status
FROM public.profiles
WHERE email = 'adam.broz.cz@gmail.com';

-- 10. Vypis všechny aktivní policies
SELECT
    policyname,
    cmd as operation,
    CASE
        WHEN roles = '{authenticated}' THEN 'authenticated users'
        ELSE roles::text
    END as applies_to
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
