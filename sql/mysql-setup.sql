-- Alatyr Hosting - MySQL Schema
-- Migrace z PostgreSQL/Supabase na MySQL

-- 1. Tabulka pro uživatele (autentizace)
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY, -- UUID jako string
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL, -- bcrypt hash
  email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token VARCHAR(255),
  reset_password_token VARCHAR(255),
  reset_password_expires DATETIME,
  provider VARCHAR(50) DEFAULT 'email', -- 'email', 'google', 'github'
  provider_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  INDEX idx_email (email),
  INDEX idx_provider (provider, provider_id),
  INDEX idx_email_verification_token (email_verification_token),
  INDEX idx_reset_password_token (reset_password_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabulka profiles (rozšířené profily uživatelů)
CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) PRIMARY KEY, -- UUID - reference na users.id
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  full_name VARCHAR(200) GENERATED ALWAYS AS (CONCAT(first_name, ' ', last_name)) STORED,
  avatar_url TEXT,
  phone VARCHAR(20),
  company VARCHAR(200),
  is_admin BOOLEAN DEFAULT FALSE,
  newsletter_subscription BOOLEAN DEFAULT FALSE,
  -- HestiaCP údaje
  hestia_username VARCHAR(50),
  hestia_password_encrypted TEXT,
  hestia_package VARCHAR(50),
  hestia_created BOOLEAN DEFAULT FALSE,
  hestia_created_at TIMESTAMP NULL,
  hestia_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_email (email),
  INDEX idx_is_admin (is_admin),
  INDEX idx_full_name (full_name),
  INDEX idx_hestia_username (hestia_username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabulka pro hosting objednávky
CREATE TABLE IF NOT EXISTS user_orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  plan_id VARCHAR(50) NOT NULL,
  plan_name VARCHAR(200) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CZK',
  
  -- Billing info
  billing_email VARCHAR(255),
  billing_name VARCHAR(200),
  billing_company VARCHAR(200),
  billing_address TEXT,
  billing_phone VARCHAR(20),
  
  -- Customer info (může být jiné než billing info)
  customer_email VARCHAR(255),
  customer_name VARCHAR(200),
  
  -- Order status
  status ENUM('pending', 'processing', 'active', 'cancelled', 'expired') DEFAULT 'pending',
  payment_status ENUM('unpaid', 'paid', 'refunded', 'failed') DEFAULT 'unpaid',
  
  -- Service details
  domain_name VARCHAR(255),
  service_start_date DATE,
  service_end_date DATE,
  auto_renewal BOOLEAN DEFAULT TRUE,
  
  -- Payment details (GoPay)
  payment_id VARCHAR(255),
  payment_url TEXT,
  gopay_status VARCHAR(50),
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  payment_date TIMESTAMP NULL,
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_payment_status (payment_status),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_payment_id (payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabulka pro aktivní hosting služby
CREATE TABLE IF NOT EXISTS user_hosting_services (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  order_id BIGINT NOT NULL,
  
  -- Informace o hostingu
  plan_name VARCHAR(100) NOT NULL,
  plan_id VARCHAR(50) NOT NULL,
  
  -- Status služby
  status ENUM('pending', 'active', 'suspended', 'expired', 'cancelled') NOT NULL DEFAULT 'pending',
  
  -- Cena a platby
  price DECIMAL(10, 2) NOT NULL,
  billing_period ENUM('monthly', 'yearly', 'one-time') NOT NULL DEFAULT 'monthly',
  
  -- Technické údaje
  disk_space INT, -- v GB
  bandwidth INT, -- v GB
  databases INT,
  email_accounts INT,
  domains INT,
  
  -- FTP přístup
  ftp_host VARCHAR(255),
  ftp_username VARCHAR(100),
  ftp_password_encrypted TEXT,
  
  -- Databázové přístupy
  db_host VARCHAR(255),
  db_name VARCHAR(100),
  db_username VARCHAR(100),
  db_password_encrypted TEXT,
  
  -- HestiaCP údaje
  hestia_username VARCHAR(50),
  hestia_domain VARCHAR(255),
  hestia_package VARCHAR(50),
  hestia_created BOOLEAN DEFAULT FALSE,
  hestia_created_at TIMESTAMP NULL,
  hestia_error TEXT,
  cpanel_url VARCHAR(500),
  
  -- Datumy
  activated_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  next_billing_date TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Poznámky
  notes TEXT,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES user_orders(id) ON DELETE CASCADE,
  UNIQUE KEY unique_order_id (order_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_order_id (order_id),
  INDEX idx_hestia_username (hestia_username),
  INDEX idx_hestia_domain (hestia_domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabulka pro support tikety
CREATE TABLE IF NOT EXISTS support_tickets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  category VARCHAR(50) DEFAULT 'general',
  
  -- Support agent
  assigned_to CHAR(36),
  last_reply_at TIMESTAMP NULL,
  last_reply_by CHAR(36),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (last_reply_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabulka pro ticket zprávy
CREATE TABLE IF NOT EXISTS ticket_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  user_id CHAR(36) NOT NULL,
  message TEXT NOT NULL,
  is_admin_reply BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabulka pro ticket attachments
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size INT,
  uploaded_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_uploaded_by (uploaded_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tabulka pro ticket mentions
CREATE TABLE IF NOT EXISTS ticket_mentions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  message_id BIGINT NOT NULL,
  mentioned_user_id CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (message_id) REFERENCES ticket_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_message_id (message_id),
  INDEX idx_mentioned_user_id (mentioned_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Tabulka pro refresh tokeny (pro JWT)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. View pro user profil s statistikami
CREATE OR REPLACE VIEW v_user_profile_stats AS
SELECT 
  p.*,
  COUNT(DISTINCT o.id) as total_orders,
  COUNT(DISTINCT CASE WHEN o.status = 'active' THEN o.id END) as active_orders,
  COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.price ELSE 0 END), 0) as total_spent,
  COUNT(DISTINCT h.id) as total_hosting_services,
  COUNT(DISTINCT CASE WHEN h.status = 'active' THEN h.id END) as active_hosting_services,
  COUNT(DISTINCT t.id) as total_tickets,
  COUNT(DISTINCT CASE WHEN t.status = 'open' OR t.status = 'in_progress' THEN t.id END) as open_tickets
FROM profiles p
LEFT JOIN user_orders o ON o.user_id = p.id
LEFT JOIN user_hosting_services h ON h.user_id = p.id
LEFT JOIN support_tickets t ON t.user_id = p.id
GROUP BY p.id;

-- 11. Trigger pro automatické vytvoření profilu po vytvoření uživatele
DELIMITER //
CREATE TRIGGER trg_create_profile_after_user
AFTER INSERT ON users
FOR EACH ROW
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name, provider, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    '',
    '',
    NEW.provider,
    NEW.email_verified
  );
END//
DELIMITER ;

-- 12. Trigger pro automatické vytvoření hosting služby po zaplacení objednávky
DELIMITER //
CREATE TRIGGER trg_create_hosting_service_after_payment
AFTER UPDATE ON user_orders
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
      user_id,
      order_id,
      plan_name,
      plan_id,
      status,
      price,
      billing_period,
      activated_at,
      expires_at,
      next_billing_date
    ) VALUES (
      NEW.user_id,
      NEW.id,
      NEW.plan_name,
      NEW.plan_id,
      'active',
      NEW.price,
      'monthly',
      NOW(),
      DATE_ADD(NOW(), INTERVAL 30 DAY),
      DATE_ADD(NOW(), INTERVAL 30 DAY)
    );
  END IF;
END//
DELIMITER ;

-- KONEC SCHÉMATU
