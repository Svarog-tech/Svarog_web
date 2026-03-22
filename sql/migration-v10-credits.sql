-- =============================================================================
-- Migration V10: Account Credits System
-- =============================================================================

CREATE TABLE IF NOT EXISTS account_credits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  transaction_type ENUM('deposit', 'payment', 'refund', 'adjustment', 'promo') NOT NULL,
  description VARCHAR(500) NULL,
  order_id BIGINT NULL,
  created_by VARCHAR(36) NULL COMMENT 'admin who made adjustment, or NULL for system',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id, created_at DESC),
  INDEX idx_type (transaction_type),
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add credit_balance column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(10, 2) DEFAULT 0 AFTER email;

-- Add credits_applied column to user_orders table
ALTER TABLE user_orders ADD COLUMN IF NOT EXISTS credits_applied DECIMAL(10, 2) DEFAULT 0 AFTER discount_amount;
