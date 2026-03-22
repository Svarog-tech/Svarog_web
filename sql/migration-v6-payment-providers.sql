-- Migration v6: Payment Providers (Stripe + PayPal)
-- Adds multi-gateway support alongside existing GoPay

-- 1. Add payment provider columns to user_orders
ALTER TABLE user_orders
  ADD COLUMN payment_provider ENUM('gopay','stripe','paypal') DEFAULT 'gopay' AFTER payment_method,
  ADD COLUMN stripe_session_id VARCHAR(255) DEFAULT NULL AFTER payment_url,
  ADD COLUMN stripe_subscription_id VARCHAR(255) DEFAULT NULL AFTER stripe_session_id,
  ADD COLUMN stripe_customer_id VARCHAR(255) DEFAULT NULL AFTER stripe_subscription_id,
  ADD COLUMN paypal_order_id VARCHAR(255) DEFAULT NULL AFTER stripe_customer_id,
  ADD COLUMN provider_status VARCHAR(50) DEFAULT NULL AFTER gopay_status,
  ADD INDEX idx_payment_provider (payment_provider),
  ADD INDEX idx_stripe_session_id (stripe_session_id),
  ADD INDEX idx_paypal_order_id (paypal_order_id);

-- 2. Add provider column to webhook_events for multi-gateway idempotency
ALTER TABLE webhook_events
  ADD COLUMN provider VARCHAR(20) DEFAULT 'gopay' AFTER event_type;

-- Update unique key to include provider (allow same payment_id across different providers)
ALTER TABLE webhook_events
  DROP INDEX uk_payment_event,
  ADD UNIQUE KEY uk_payment_event_provider (payment_id, event_type, provider);

-- 3. Stripe subscriptions table for recurring billing
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  order_id BIGINT NOT NULL,
  stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
  stripe_customer_id VARCHAR(255) NOT NULL,
  stripe_price_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP NULL,
  current_period_end TIMESTAMP NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES user_orders(id) ON DELETE CASCADE,
  INDEX idx_stripe_customer (stripe_customer_id),
  INDEX idx_stripe_sub_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Stripe customers table (map app users to Stripe customer IDs)
CREATE TABLE IF NOT EXISTS stripe_customers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  stripe_customer_id VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Add refund columns to user_orders
ALTER TABLE user_orders
  ADD COLUMN refund_reason VARCHAR(500) DEFAULT NULL,
  ADD COLUMN refunded_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN refunded_by CHAR(36) DEFAULT NULL;

-- 6. Extend payment_status ENUM to include 'partially_refunded' and 'processing'
ALTER TABLE user_orders
  MODIFY COLUMN payment_status ENUM('unpaid', 'processing', 'paid', 'refunded', 'partially_refunded', 'failed') DEFAULT 'unpaid';
