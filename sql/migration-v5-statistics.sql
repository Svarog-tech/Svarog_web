-- Alatyr Hosting - Migration v5
-- Statistics & Monitoring - Historical Data
-- Pro MariaDB (HestiaCP)

-- ============================================
-- 1. STATISTICS: Historická data statistik
-- ============================================

CREATE TABLE IF NOT EXISTS service_statistics (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  service_id BIGINT NOT NULL,
  disk_used_mb DECIMAL(10, 2) DEFAULT 0,
  bandwidth_used_mb DECIMAL(10, 2) DEFAULT 0,
  email_accounts_used INT DEFAULT 0,
  databases_used INT DEFAULT 0,
  web_domains_used INT DEFAULT 0,
  cpu_usage_percent DECIMAL(5, 2) DEFAULT 0,
  memory_usage_percent DECIMAL(5, 2) DEFAULT 0,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_service_recorded (service_id, recorded_at DESC),
  INDEX idx_recorded_at (recorded_at),
  FOREIGN KEY (service_id) REFERENCES user_hosting_services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. ALERTS: Systém upozornění
-- ============================================

CREATE TABLE IF NOT EXISTS service_alerts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  service_id BIGINT NOT NULL,
  alert_type ENUM('disk_limit', 'bandwidth_limit', 'email_limit', 'database_limit', 'domain_limit', 'cpu_high', 'memory_high') NOT NULL,
  threshold_value DECIMAL(10, 2),
  current_value DECIMAL(10, 2),
  severity ENUM('warning', 'critical') DEFAULT 'warning',
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP NULL,
  acknowledged_by VARCHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_service_alert (service_id, created_at DESC),
  INDEX idx_unacknowledged (acknowledged, created_at),
  INDEX idx_service_unacknowledged (service_id, acknowledged, created_at),
  FOREIGN KEY (service_id) REFERENCES user_hosting_services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
