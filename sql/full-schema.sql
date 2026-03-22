-- =============================================================================
-- Alatyr Hosting - Full Database Schema
-- Generated: 2026-03-19
-- MariaDB 10.x+ / MySQL 8.x+
-- =============================================================================
-- USAGE:
--   mysql -u USERNAME -p DATABASE_NAME < full-schema.sql
--
-- Na HestiaCP:
--   1. Vytvor databazi v HestiaCP panelu (napr. epgmooky_alatyr_db)
--   2. Vytvor uzivatele s pristupem k databazi
--   3. Importuj: mysql -u epgmooky_epgmooky_db -p epgmooky_alatyr_db < full-schema.sql
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- -----------------------------------------------------------------------------
-- 1. USERS - zakladni tabulka uzivatelu (auth)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` char(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `email_verified` tinyint(1) DEFAULT 0,
  `email_verification_token` varchar(255) DEFAULT NULL,
  `reset_password_token` varchar(255) DEFAULT NULL,
  `reset_password_expires` datetime DEFAULT NULL,
  `provider` varchar(50) DEFAULT 'email',
  `provider_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_login` timestamp NULL DEFAULT NULL,
  `mfa_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `mfa_secret` varchar(64) DEFAULT NULL,
  `mfa_recovery_codes` text DEFAULT NULL,
  `mfa_confirmed_at` datetime DEFAULT NULL,
  `failed_logins` int(11) NOT NULL DEFAULT 0,
  `locked_until` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`),
  KEY `idx_provider` (`provider`,`provider_id`),
  KEY `idx_email_verification_token` (`email_verification_token`),
  KEY `idx_reset_password_token` (`reset_password_token`),
  KEY `idx_email_verified` (`email_verified`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. PROFILES - uzivatelske profily (1:1 s users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `profiles` (
  `id` char(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `full_name` varchar(200) GENERATED ALWAYS AS (concat(`first_name`,' ',`last_name`)) STORED,
  `avatar_url` text DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `company` varchar(200) DEFAULT NULL,
  `is_admin` tinyint(1) DEFAULT 0,
  `newsletter_subscription` tinyint(1) DEFAULT 0,
  `hestia_username` varchar(50) DEFAULT NULL,
  `hestia_password_encrypted` text DEFAULT NULL,
  `hestia_package` varchar(50) DEFAULT NULL,
  `hestia_created` tinyint(1) DEFAULT 0,
  `hestia_created_at` timestamp NULL DEFAULT NULL,
  `hestia_error` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_login` timestamp NULL DEFAULT NULL,
  `ico` varchar(20) DEFAULT NULL,
  `dic` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`),
  KEY `idx_is_admin` (`is_admin`),
  KEY `idx_full_name` (`full_name`),
  KEY `idx_hestia_username` (`hestia_username`),
  CONSTRAINT `fk_profiles_user` FOREIGN KEY (`id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. REFRESH TOKENS - JWT refresh tokeny
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `fk_refresh_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. USER ORDERS - objednavky
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_orders` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `plan_id` varchar(50) NOT NULL,
  `plan_name` varchar(200) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `currency` varchar(3) DEFAULT 'CZK',
  `billing_email` varchar(255) DEFAULT NULL,
  `billing_name` varchar(200) DEFAULT NULL,
  `billing_company` varchar(200) DEFAULT NULL,
  `billing_address` text DEFAULT NULL,
  `billing_phone` varchar(20) DEFAULT NULL,
  `customer_email` varchar(255) DEFAULT NULL,
  `customer_name` varchar(200) DEFAULT NULL,
  `status` enum('pending','processing','active','cancelled','expired') DEFAULT 'pending',
  `payment_status` enum('unpaid','processing','paid','refunded','partially_refunded','failed') DEFAULT 'unpaid',
  `domain_name` varchar(255) DEFAULT NULL,
  `service_start_date` date DEFAULT NULL,
  `service_end_date` date DEFAULT NULL,
  `auto_renewal` tinyint(1) DEFAULT 1,
  `payment_id` varchar(255) DEFAULT NULL,
  `payment_url` text DEFAULT NULL,
  `stripe_session_id` varchar(255) DEFAULT NULL,
  `stripe_subscription_id` varchar(255) DEFAULT NULL,
  `stripe_customer_id` varchar(255) DEFAULT NULL,
  `paypal_order_id` varchar(255) DEFAULT NULL,
  `gopay_status` varchar(50) DEFAULT NULL,
  `provider_status` varchar(50) DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `payment_provider` enum('gopay','stripe','paypal') DEFAULT 'gopay',
  `transaction_id` varchar(255) DEFAULT NULL,
  `payment_date` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `invoice_number` varchar(50) DEFAULT NULL,
  `invoice_issued_at` timestamp NULL DEFAULT NULL,
  `billing_ico` varchar(20) DEFAULT NULL,
  `billing_dic` varchar(20) DEFAULT NULL,
  `refund_reason` varchar(500) DEFAULT NULL,
  `refunded_at` timestamp NULL DEFAULT NULL,
  `refunded_by` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_payment_status` (`payment_status`),
  KEY `idx_created_at` (`created_at` DESC),
  KEY `idx_payment_id` (`payment_id`),
  KEY `idx_user_created` (`user_id`,`created_at` DESC),
  KEY `idx_status_user` (`status`,`user_id`),
  KEY `idx_payment_provider` (`payment_provider`),
  KEY `idx_stripe_session_id` (`stripe_session_id`),
  KEY `idx_paypal_order_id` (`paypal_order_id`),
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. USER HOSTING SERVICES - hostingove sluzby
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_hosting_services` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `order_id` bigint(20) NOT NULL,
  `plan_name` varchar(100) NOT NULL,
  `plan_id` varchar(50) NOT NULL,
  `status` enum('pending','active','suspended','expired','cancelled') NOT NULL DEFAULT 'pending',
  `price` decimal(10,2) NOT NULL,
  `billing_period` enum('monthly','yearly','one-time') NOT NULL DEFAULT 'monthly',
  `disk_space` int(11) DEFAULT NULL,
  `bandwidth` int(11) DEFAULT NULL,
  `databases` int(11) DEFAULT NULL,
  `email_accounts` int(11) DEFAULT NULL,
  `domains` int(11) DEFAULT NULL,
  `ftp_host` varchar(255) DEFAULT NULL,
  `ftp_username` varchar(100) DEFAULT NULL,
  `ftp_password_encrypted` text DEFAULT NULL,
  `db_host` varchar(255) DEFAULT NULL,
  `db_name` varchar(100) DEFAULT NULL,
  `db_username` varchar(100) DEFAULT NULL,
  `db_password_encrypted` text DEFAULT NULL,
  `hestia_username` varchar(50) DEFAULT NULL,
  `hestia_domain` varchar(255) DEFAULT NULL,
  `hestia_package` varchar(50) DEFAULT NULL,
  `hestia_created` tinyint(1) DEFAULT 0,
  `hestia_created_at` timestamp NULL DEFAULT NULL,
  `hestia_error` text DEFAULT NULL,
  `cpanel_url` varchar(500) DEFAULT NULL,
  `activated_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `next_billing_date` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `notes` text DEFAULT NULL,
  `auto_renewal` tinyint(1) DEFAULT 1,
  `renewal_period` enum('monthly','yearly') DEFAULT 'monthly',
  `last_renewed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_order_id` (`order_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_hestia_username` (`hestia_username`),
  KEY `idx_hestia_domain` (`hestia_domain`),
  KEY `idx_auto_renewal_active` (`auto_renewal`,`status`,`expires_at`),
  CONSTRAINT `fk_services_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_services_order` FOREIGN KEY (`order_id`) REFERENCES `user_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. STRIPE CUSTOMERS - mapovani uzivatelu na Stripe
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stripe_customers` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `stripe_customer_id` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `stripe_customer_id` (`stripe_customer_id`),
  CONSTRAINT `fk_stripe_customers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. STRIPE SUBSCRIPTIONS - predplatne
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stripe_subscriptions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `order_id` bigint(20) NOT NULL,
  `stripe_subscription_id` varchar(255) NOT NULL,
  `stripe_customer_id` varchar(255) NOT NULL,
  `stripe_price_id` varchar(255) NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `current_period_start` timestamp NULL DEFAULT NULL,
  `current_period_end` timestamp NULL DEFAULT NULL,
  `cancel_at_period_end` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `stripe_subscription_id` (`stripe_subscription_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_stripe_customer` (`stripe_customer_id`),
  KEY `idx_stripe_sub_status` (`status`),
  CONSTRAINT `fk_stripe_subs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stripe_subs_order` FOREIGN KEY (`order_id`) REFERENCES `user_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. SUPPORT TICKETS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `status` enum('open','in_progress','waiting','resolved','closed') DEFAULT 'open',
  `priority` enum('low','medium','high','urgent') DEFAULT 'medium',
  `category` varchar(50) DEFAULT 'general',
  `assigned_to` char(36) DEFAULT NULL,
  `discord_channel_id` varchar(32) DEFAULT NULL,
  `discord_message_id` varchar(32) DEFAULT NULL,
  `last_reply_at` timestamp NULL DEFAULT NULL,
  `last_reply_by` char(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_assigned_to` (`assigned_to`),
  KEY `idx_created_at` (`created_at` DESC),
  KEY `idx_user_created` (`user_id`,`created_at` DESC),
  KEY `idx_status_priority` (`status`,`priority`,`created_at` DESC),
  KEY `idx_discord_channel` (`discord_channel_id`),
  CONSTRAINT `fk_tickets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tickets_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tickets_last_reply` FOREIGN KEY (`last_reply_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. TICKET MESSAGES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ticket_messages` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `ticket_id` bigint(20) NOT NULL,
  `user_id` char(36) NOT NULL,
  `message` text NOT NULL,
  `is_admin_reply` tinyint(1) DEFAULT 0,
  `source` enum('web','discord','email') DEFAULT 'web',
  `discord_message_id` varchar(32) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ticket_id` (`ticket_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_discord_message` (`discord_message_id`),
  CONSTRAINT `fk_messages_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_messages_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 10. TICKET ATTACHMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ticket_attachments` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `ticket_id` bigint(20) NOT NULL,
  `file_url` text NOT NULL,
  `file_name` text NOT NULL,
  `file_type` varchar(100) NOT NULL,
  `file_size` int(11) DEFAULT NULL,
  `uploaded_by` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ticket_id` (`ticket_id`),
  KEY `idx_uploaded_by` (`uploaded_by`),
  CONSTRAINT `fk_attachments_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_attachments_user` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 11. TICKET MENTIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ticket_mentions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `message_id` bigint(20) NOT NULL,
  `mentioned_user_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_message_id` (`message_id`),
  KEY `idx_mentioned_user_id` (`mentioned_user_id`),
  CONSTRAINT `fk_mentions_message` FOREIGN KEY (`message_id`) REFERENCES `ticket_messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mentions_user` FOREIGN KEY (`mentioned_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 12. DISCORD USER MAPPINGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `discord_user_mappings` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `discord_user_id` varchar(32) NOT NULL,
  `discord_username` varchar(100) DEFAULT NULL,
  `linked_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_discord_user` (`discord_user_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_discord_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 13. WEBHOOK EVENTS - idempotence pro platebni webhooky
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `webhook_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `payment_id` varchar(100) NOT NULL,
  `event_type` varchar(50) NOT NULL,
  `provider` varchar(20) DEFAULT 'gopay',
  `processed_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payment_event_provider` (`payment_id`,`event_type`,`provider`),
  KEY `idx_processed` (`processed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 14. AUDIT LOG
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(36) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `target_type` varchar(50) DEFAULT NULL,
  `target_id` varchar(100) DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_action` (`user_id`,`action`),
  KEY `idx_created` (`created_at`),
  KEY `idx_action_target` (`action`,`target_type`,`target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 15. SERVICE STATISTICS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `service_statistics` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `service_id` bigint(20) NOT NULL,
  `disk_used_mb` decimal(10,2) DEFAULT 0.00,
  `bandwidth_used_mb` decimal(10,2) DEFAULT 0.00,
  `email_accounts_used` int(11) DEFAULT 0,
  `databases_used` int(11) DEFAULT 0,
  `web_domains_used` int(11) DEFAULT 0,
  `cpu_usage_percent` decimal(5,2) DEFAULT 0.00,
  `memory_usage_percent` decimal(5,2) DEFAULT 0.00,
  `recorded_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_service_recorded` (`service_id`,`recorded_at` DESC),
  KEY `idx_recorded_at` (`recorded_at`),
  CONSTRAINT `fk_stats_service` FOREIGN KEY (`service_id`) REFERENCES `user_hosting_services` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 16. SERVICE ALERTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `service_alerts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `service_id` bigint(20) NOT NULL,
  `alert_type` enum('disk_limit','bandwidth_limit','email_limit','database_limit','domain_limit','cpu_high','memory_high') NOT NULL,
  `threshold_value` decimal(10,2) DEFAULT NULL,
  `current_value` decimal(10,2) DEFAULT NULL,
  `severity` enum('warning','critical') DEFAULT 'warning',
  `acknowledged` tinyint(1) DEFAULT 0,
  `acknowledged_at` timestamp NULL DEFAULT NULL,
  `acknowledged_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_service_alert` (`service_id`,`created_at` DESC),
  KEY `idx_unacknowledged` (`acknowledged`,`created_at`),
  KEY `idx_service_unacknowledged` (`service_id`,`acknowledged`,`created_at`),
  CONSTRAINT `fk_alerts_service` FOREIGN KEY (`service_id`) REFERENCES `user_hosting_services` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-create profile after user registration
DELIMITER ;;
CREATE TRIGGER IF NOT EXISTS `trg_create_profile_after_user`
AFTER INSERT ON `users`
FOR EACH ROW
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name)
  VALUES (NEW.id, NEW.email, '', '');
END;;
DELIMITER ;

-- Auto-create hosting service after order is paid & activated
DELIMITER ;;
CREATE TRIGGER IF NOT EXISTS `trg_create_hosting_service_after_payment`
AFTER UPDATE ON `user_orders`
FOR EACH ROW
BEGIN
  IF NEW.status = 'active'
     AND NEW.payment_status = 'paid'
     AND (OLD.status != 'active' OR OLD.payment_status != 'paid')
     AND NOT EXISTS (
       SELECT 1 FROM user_hosting_services
       WHERE order_id = NEW.id
     ) THEN

    INSERT INTO user_hosting_services (
      user_id, order_id, plan_name, plan_id, status, price,
      billing_period, activated_at, expires_at, next_billing_date
    ) VALUES (
      NEW.user_id, NEW.id, NEW.plan_name, NEW.plan_id, 'active', NEW.price,
      'monthly', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY)
    );
  END IF;
END;;
DELIMITER ;

-- =============================================================================
-- VIEWS
-- =============================================================================

CREATE OR REPLACE VIEW `v_user_profile_stats` AS
SELECT
  p.id, p.email, p.first_name, p.last_name, p.full_name,
  p.avatar_url, p.phone, p.company, p.is_admin,
  p.newsletter_subscription, p.hestia_username,
  p.hestia_password_encrypted, p.hestia_package,
  p.hestia_created, p.hestia_created_at, p.hestia_error,
  p.created_at, p.updated_at, p.last_login,
  COUNT(DISTINCT o.id) AS total_orders,
  COUNT(DISTINCT CASE WHEN o.status = 'active' THEN o.id END) AS active_orders,
  COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.price ELSE 0 END), 0) AS total_spent,
  COUNT(DISTINCT h.id) AS total_hosting_services,
  COUNT(DISTINCT CASE WHEN h.status = 'active' THEN h.id END) AS active_hosting_services,
  COUNT(DISTINCT t.id) AS total_tickets,
  COUNT(DISTINCT CASE WHEN t.status IN ('open','in_progress') THEN t.id END) AS open_tickets
FROM profiles p
LEFT JOIN user_orders o ON o.user_id = p.id
LEFT JOIN user_hosting_services h ON h.user_id = p.id
LEFT JOIN support_tickets t ON t.user_id = p.id
GROUP BY p.id;

-- =============================================================================
SET FOREIGN_KEY_CHECKS = 1;
-- Schema import complete.
