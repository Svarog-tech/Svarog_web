-- Alatyr Hosting - Migration v3
-- Performance indexes + Invoice fields + Bug fixes
-- Pro MariaDB (HestiaCP)

-- ============================================
-- 1. PERFORMANCE: Chybějící indexy
-- ============================================

-- refresh_tokens: cleanup query pro expires_at
-- (již existuje idx_expires_at z původního schématu)

-- user_hosting_services: query pro auto_renewal + active + expires_at
-- (presunut nize - sloupec auto_renewal se vytvari az v sekci 5)

-- user_hosting_services: last_renewed_at (pokud sloupec existuje)
-- ALTER TABLE user_hosting_services ADD INDEX idx_last_renewed_at (last_renewed_at);

-- user_orders: composite index pro user_id + created_at (frequent query)
ALTER TABLE user_orders ADD INDEX idx_user_created (user_id, created_at DESC);

-- support_tickets: composite index pro user_id + created_at
ALTER TABLE support_tickets ADD INDEX idx_user_created (user_id, created_at DESC);

-- ============================================
-- 2. BUG FIX: Ticket status ENUM chybí 'waiting'
-- ============================================
ALTER TABLE support_tickets
  MODIFY COLUMN status ENUM('open', 'in_progress', 'waiting', 'resolved', 'closed') DEFAULT 'open';

-- ============================================
-- 3. INVOICE: Přidání fakturačních polí do user_orders
-- ============================================

-- Číslo faktury a datum vystavení (pokud ještě neexistují)
-- Tyto sloupce se používají v server.js (webhook + invoice endpoint)
ALTER TABLE user_orders ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50) DEFAULT NULL;
ALTER TABLE user_orders ADD COLUMN IF NOT EXISTS invoice_issued_at TIMESTAMP NULL DEFAULT NULL;

-- IČO/DIČ pro české faktury
ALTER TABLE user_orders ADD COLUMN IF NOT EXISTS billing_ico VARCHAR(20) DEFAULT NULL;
ALTER TABLE user_orders ADD COLUMN IF NOT EXISTS billing_dic VARCHAR(20) DEFAULT NULL;

-- ============================================
-- 4. INVOICE: Přidání IČO/DIČ do profiles (pro opakované použití)
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ico VARCHAR(20) DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dic VARCHAR(20) DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT DEFAULT NULL;

-- ============================================
-- 5. AUTO-RENEWAL: Sloupce pro hosting services (pokud chybí)
-- ============================================
ALTER TABLE user_hosting_services ADD COLUMN IF NOT EXISTS auto_renewal BOOLEAN DEFAULT TRUE;
ALTER TABLE user_hosting_services ADD COLUMN IF NOT EXISTS renewal_period ENUM('monthly', 'yearly') DEFAULT 'monthly';
ALTER TABLE user_hosting_services ADD COLUMN IF NOT EXISTS last_renewed_at TIMESTAMP NULL DEFAULT NULL;

-- Index pro auto_renewal (presunuto ze sekce 1 - sloupec musi existovat pred indexem)
ALTER TABLE user_hosting_services ADD INDEX IF NOT EXISTS idx_auto_renewal_active (auto_renewal, status, expires_at);

-- ============================================
-- 6. MFA: Sloupce v users tabulce (pokud chybí)
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(64) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_recovery_codes TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_confirmed_at DATETIME DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_logins INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until DATETIME DEFAULT NULL;

-- Index pro cleanup expired tokens
ALTER TABLE refresh_tokens ADD INDEX IF NOT EXISTS idx_expires_cleanup (expires_at);
