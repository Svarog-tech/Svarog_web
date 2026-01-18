-- ============================================
-- Skript pro vytvoření admin uživatele
-- ============================================
-- 
-- Email: misa4219@seznam.cz
-- Heslo: 42084208PmPm*
-- 
-- INSTRUKCE:
-- 1. Spusť tento skript v MySQL klientu (např. phpMyAdmin, MySQL Workbench, nebo příkazový řádek)
-- 2. Ověř, že uživatel byl vytvořen (poslední SELECT dotaz)
-- 3. Přihlaste se s emailem: misa4219@seznam.cz a heslem: 42084208PmPm*
-- ============================================

-- 1. Vygeneruj UUID pro uživatele
SET @user_id = UUID();

-- 2. Hash hesla (bcrypt hash pro heslo: 42084208PmPm*)
SET @password_hash = '$2b$10$dcVZwOpKTBGw.pWZZSU2IegYFmVEy8wuJCoOeryQiZDb2Q/F.odbu';

-- 3. Zkontroluj, jestli uživatel už existuje a použij jeho ID, nebo vytvoř nového
SET @existing_user_id = (SELECT id FROM users WHERE email = 'misa4219@seznam.cz' LIMIT 1);

-- 4. Pokud uživatel neexistuje, vytvoř ho
INSERT INTO users (id, email, password_hash, email_verified, provider, created_at)
SELECT 
    @user_id,
    'misa4219@seznam.cz',
    @password_hash,
    TRUE,
    'email',
    NOW()
WHERE @existing_user_id IS NULL;

-- 5. Použij ID existujícího nebo nového uživatele
SET @user_id = COALESCE(@existing_user_id, @user_id);

-- 6. Zkontroluj, jestli profil existuje (trigger ho možná vytvořil automaticky)
-- Pokud neexistuje, vytvoř ho, pokud existuje, aktualizuj ho
INSERT INTO profiles (id, email, first_name, last_name, is_admin, email_verified, created_at)
VALUES (
    @user_id,
    'misa4219@seznam.cz',
    'Admin',
    'User',
    TRUE,
    TRUE,
    NOW()
)
ON DUPLICATE KEY UPDATE 
    is_admin = TRUE,
    email_verified = TRUE,
    first_name = 'Admin',
    last_name = 'User',
    email = 'misa4219@seznam.cz';

-- 7. Zajisti, že uživatel má admin práva (aktualizace pro případ, že už existoval)
UPDATE profiles 
SET is_admin = TRUE, email_verified = TRUE
WHERE id = @user_id AND (is_admin = FALSE OR email_verified = FALSE);

-- 8. OVĚŘENÍ - zkontroluj, že uživatel byl vytvořen správně
SELECT 
    u.id AS user_id,
    u.email,
    u.email_verified AS user_email_verified,
    u.provider,
    u.created_at AS user_created_at,
    p.first_name,
    p.last_name,
    p.is_admin,
    p.email_verified AS profile_email_verified,
    CASE 
        WHEN p.is_admin = TRUE THEN '✅ ANO - MÁ ADMIN PRÁVA'
        ELSE '❌ NE - NEMÁ ADMIN PRÁVA'
    END AS admin_status
FROM users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email = 'misa4219@seznam.cz';

-- ============================================
-- Pokud výše uvedený SELECT vrátí řádek s:
-- - is_admin = 1 (TRUE)
-- - email_verified = 1 (TRUE)
-- - email = 'misa4219@seznam.cz'
-- 
-- Pak je uživatel vytvořen správně a můžete se přihlásit!
-- ============================================
-- 
-- Přihlašovací údaje:
-- Email:    misa4219@seznam.cz
-- Heslo:    42084208PmPm*
-- ============================================
