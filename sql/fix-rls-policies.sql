-- FIX pro RLS policies - umožnit čtení profilů
-- Problém: 406 Not Acceptable při čtení profiles

-- 1. Drop stávající SELECT policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- 2. Vytvoř novou SELECT policy s lepšími podmínkami
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id
  );

-- 3. Umožnit service_role vše (pro admin přístup)
DROP POLICY IF EXISTS "Service role can do anything" ON public.profiles;

CREATE POLICY "Service role can do anything"
  ON public.profiles
  FOR ALL
  USING (
    (auth.jwt()->>'role' = 'service_role') OR
    (auth.jwt()->'user_metadata'->>'role' = 'admin')
  );

-- 4. Ujisti se, že RLS je zapnuté
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Ujisti se, že anon role má přístup k SELECT
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.profiles TO authenticated;

-- Pro jistotu grant i INSERT/UPDATE pro authenticated uživatele
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
