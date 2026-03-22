-- =============================================================================
-- Migration v7: Webhook Events & Audit Logs
-- Ensures required tables exist for webhook idempotency and admin audit trail
-- =============================================================================

-- Webhook events table (idempotency for payment webhooks)
CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'gopay',
  event_type VARCHAR(100) NOT NULL,
  payload JSON NULL,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_payment_event (payment_id, provider, event_type),
  INDEX idx_processed (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit logs table (admin operations tracking)
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NULL,
  target_id VARCHAR(255) NULL,
  details JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id, created_at DESC),
  INDEX idx_action (action, created_at DESC),
  INDEX idx_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Upgrade existing webhook_events table if it lacks columns
-- (safe to run on both old and new schemas)
ALTER TABLE webhook_events
  MODIFY COLUMN payment_id VARCHAR(255) NOT NULL,
  MODIFY COLUMN event_type VARCHAR(100) NOT NULL,
  MODIFY COLUMN provider VARCHAR(50) NOT NULL DEFAULT 'gopay';

-- Add payload column if not exists (MariaDB/MySQL safe approach)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'webhook_events' AND COLUMN_NAME = 'payload');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE webhook_events ADD COLUMN payload JSON NULL AFTER event_type', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
