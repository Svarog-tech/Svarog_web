-- Skript pro vytvoření admin uživatele
-- Spusť tento SQL skript v MySQL klientu nebo přes phpMyAdmin
-- 
-- Email: misa4219@seznam.cz
-- Heslo: 42084208PmPm*
-- 
-- POZNÁMKA: Heslo je hashované pomocí bcrypt. Pokud potřebujete vygenerovat nový hash,
-- použijte: node -e "const bcrypt = require('bcrypt'); bcrypt.hash('42084208PmPm*', 10).then(h => console.log(h))"

-- 1. Vygeneruj UUID pro uživatele (nebo použij tento)
SET @user_id = UUID();
-- Nebo použij konkrétní UUID:
-- SET @user_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

-- 2. Hash hesla (vygeneruj pomocí Node.js, nebo použij tento - generován pro heslo: 42084208PmPm*)
-- Pro generování nového hashe spusť: node -e "const bcrypt = require('bcrypt'); bcrypt.hash('42084208PmPm*', 10).then(h => console.log(h))"
SET @password_hash = '$2b$10$YourGeneratedHashHere';

-- PRO NÁSLEDUJÍCÍ KROK: Nejdříve vygeneruj hash pomocí Node.js skriptu:
-- node -e "const bcrypt = require('bcrypt'); bcrypt.hash('42084208PmPm*', 10).then(h => console.log('SET @password_hash = ''' + h + ''';'))"
-- Pak zkopíruj výsledek a vlož sem.

-- 3. Vytvoř uživatele
INSERT INTO users (id, email, password_hash, email_verified, provider, created_at)
VALUES (
    @user_id,
    'misa4219@seznam.cz',
    @password_hash,
    TRUE,
    'email',
    NOW()
)
ON DUPLICATE KEY UPDATE email = email; -- Pokud už existuje, neudělá nic

-- 4. Zkontroluj, jestli profil existuje (trigger ho možná vytvořil automaticky)
-- Pokud neexistuje, vytvoř ho:
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
    last_name = 'User';

-- 5. Pokud uživatel existuje, jen přidej admin práva:
UPDATE profiles 
SET is_admin = TRUE, email_verified = TRUE
WHERE email = 'misa4219@seznam.cz' AND is_admin = FALSE;

-- 6. Ověření - zkontroluj, že uživatel má admin práva
SELECT 
    u.id,
    u.email,
    u.email_verified,
    p.first_name,
    p.last_name,
    p.is_admin,
    p.email_verified as profile_email_verified
FROM users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email = 'misa4219@seznam.cz';
