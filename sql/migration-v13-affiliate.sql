-- =============================================================================
-- Migration v13: Affiliate / Referral System
-- =============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS affiliate_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  referral_code VARCHAR(20) NOT NULL UNIQUE,
  commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 10.00 COMMENT 'Percentage commission',
  tier ENUM('bronze', 'silver', 'gold') NOT NULL DEFAULT 'bronze',
  total_earnings DECIMAL(10, 2) DEFAULT 0,
  total_paid_out DECIMAL(10, 2) DEFAULT 0,
  pending_balance DECIMAL(10, 2) DEFAULT 0,
  total_referrals INT DEFAULT 0,
  total_conversions INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (referral_code),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  affiliate_id BIGINT UNSIGNED NOT NULL,
  referred_user_id VARCHAR(36) NOT NULL,
  referred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45) NULL,
  converted BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMP NULL,
  FOREIGN KEY (affiliate_id) REFERENCES affiliate_accounts(id),
  UNIQUE KEY uk_referred_user (referred_user_id),
  INDEX idx_affiliate (affiliate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  affiliate_id BIGINT UNSIGNED NOT NULL,
  referral_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT NOT NULL,
  order_amount DECIMAL(10, 2) NOT NULL,
  commission_rate DECIMAL(5, 2) NOT NULL,
  commission_amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'approved', 'paid', 'rejected') NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMP NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (affiliate_id) REFERENCES affiliate_accounts(id),
  FOREIGN KEY (referral_id) REFERENCES affiliate_referrals(id),
  INDEX idx_affiliate_status (affiliate_id, status),
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  affiliate_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payout_method ENUM('credit', 'bank_transfer') NOT NULL DEFAULT 'credit',
  status ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  notes TEXT NULL,
  processed_by VARCHAR(36) NULL,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (affiliate_id) REFERENCES affiliate_accounts(id),
  INDEX idx_affiliate (affiliate_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add referral tracking to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by VARCHAR(20) NULL AFTER credit_balance;
