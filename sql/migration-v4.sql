-- Alatyr Hosting - Migration v4
-- Security fixes + Performance indexes + Audit v4
-- Pro MariaDB (HestiaCP)

-- ============================================
-- 1. PERFORMANCE: Chybějící indexy (z auditu v4)
-- ============================================

-- user_orders: index na payment_id (webhook lookup)
ALTER TABLE user_orders ADD INDEX IF NOT EXISTS idx_payment_id (payment_id);

-- user_orders: composite index pro status + user_id (list queries)
ALTER TABLE user_orders ADD INDEX IF NOT EXISTS idx_status_user (status, user_id);

-- refresh_tokens: index na user_id (logout invalidation)
ALTER TABLE refresh_tokens ADD INDEX IF NOT EXISTS idx_user_id (user_id);

-- users: index na email_verified (pro filtrování neověřených)
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_email_verified (email_verified);

-- users: index na reset_password_token (password reset lookup)
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_reset_token (reset_password_token);

-- support_tickets: index pro admin listing (status + priority + created_at)
ALTER TABLE support_tickets ADD INDEX IF NOT EXISTS idx_status_priority (status, priority, created_at DESC);

-- ============================================
-- 2. SECURITY: Audit log tabulka
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) DEFAULT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) DEFAULT NULL,
  target_id VARCHAR(100) DEFAULT NULL,
  details JSON DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_action (user_id, action),
  INDEX idx_created (created_at),
  INDEX idx_action_target (action, target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. SECURITY: Webhook idempotency (dedup)
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_payment_event (payment_id, event_type),
  INDEX idx_processed (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
