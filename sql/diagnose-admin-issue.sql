-- Diagnostika problému s admin rolí
-- Tento script zkontroluje aktuální stav databáze

-- 1. Zkontroluj strukturu tabulky profiles (má sloupec is_admin?)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 2. Zkontroluj aktuální RLS policies na profiles
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- 3. Zkontroluj konkrétní uživatelský profil
SELECT id, email, first_name, last_name, is_admin, created_at, updated_at
FROM public.profiles
WHERE email = 'adam.broz.cz@gmail.com';

-- 4. Zkontroluj všechny profily (je tam vůbec nějaký is_admin = TRUE?)
SELECT email, is_admin
FROM public.profiles
ORDER BY created_at DESC;

-- 5. Zkus přečíst profil jako authenticated user (simulace)
-- Tento dotaz ukáže, jestli RLS policies blokují čtení is_admin pole
SET ROLE authenticated;
SELECT id, email, first_name, last_name, is_admin
FROM public.profiles
WHERE email = 'adam.broz.cz@gmail.com';
RESET ROLE;
