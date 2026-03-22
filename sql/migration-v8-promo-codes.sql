-- =============================================================================
-- Migration V8: Promo Codes / Coupon System
-- Date: 2026-03-21
-- =============================================================================

SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- PROMO CODES table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promo_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  discount_type ENUM('percent', 'fixed') NOT NULL DEFAULT 'percent',
  discount_value DECIMAL(10, 2) NOT NULL,
  min_order_amount DECIMAL(10, 2) DEFAULT 0,
  max_uses INT DEFAULT NULL,
  current_uses INT DEFAULT 0,
  per_user_limit INT DEFAULT 1,
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP NULL,
  applicable_plans JSON NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_active_valid (is_active, valid_from, valid_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- PROMO CODE USAGE tracking
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  promo_code_id BIGINT UNSIGNED NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  order_id BIGINT NOT NULL,
  discount_amount DECIMAL(10, 2) NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id),
  INDEX idx_user_promo (user_id, promo_code_id),
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Add promo columns to orders table
-- -----------------------------------------------------------------------------
ALTER TABLE user_orders ADD COLUMN IF NOT EXISTS promo_code_id BIGINT UNSIGNED NULL AFTER payment_method;
ALTER TABLE user_orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0 AFTER promo_code_id;
ALTER TABLE user_orders ADD COLUMN IF NOT EXISTS original_price DECIMAL(10, 2) NULL AFTER discount_amount;
