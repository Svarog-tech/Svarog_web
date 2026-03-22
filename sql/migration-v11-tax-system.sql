-- =============================================================================
-- Migration v11: Tax/VAT System for EU Compliance
-- =============================================================================

SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- TAX RATES table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_rates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  country_code CHAR(2) NOT NULL,
  country_name VARCHAR(100) NOT NULL,
  tax_rate DECIMAL(5, 2) NOT NULL,
  tax_type ENUM('vat', 'sales_tax', 'gst') NOT NULL DEFAULT 'vat',
  is_eu BOOLEAN DEFAULT FALSE,
  is_default BOOLEAN DEFAULT FALSE,
  effective_from DATE NOT NULL DEFAULT '2024-01-01',
  effective_until DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_country_type (country_code, tax_type, effective_from),
  INDEX idx_eu (is_eu)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert EU VAT rates (2024 standard rates)
INSERT INTO tax_rates (country_code, country_name, tax_rate, tax_type, is_eu, is_default) VALUES
('CZ', 'Česká republika', 21.00, 'vat', TRUE, TRUE),
('SK', 'Slovensko', 23.00, 'vat', TRUE, FALSE),
('DE', 'Německo', 19.00, 'vat', TRUE, FALSE),
('AT', 'Rakousko', 20.00, 'vat', TRUE, FALSE),
('PL', 'Polsko', 23.00, 'vat', TRUE, FALSE),
('HU', 'Maďarsko', 27.00, 'vat', TRUE, FALSE),
('FR', 'Francie', 20.00, 'vat', TRUE, FALSE),
('IT', 'Itálie', 22.00, 'vat', TRUE, FALSE),
('ES', 'Španělsko', 21.00, 'vat', TRUE, FALSE),
('NL', 'Nizozemsko', 21.00, 'vat', TRUE, FALSE),
('BE', 'Belgie', 21.00, 'vat', TRUE, FALSE),
('PT', 'Portugalsko', 23.00, 'vat', TRUE, FALSE),
('SE', 'Švédsko', 25.00, 'vat', TRUE, FALSE),
('DK', 'Dánsko', 25.00, 'vat', TRUE, FALSE),
('FI', 'Finsko', 25.50, 'vat', TRUE, FALSE),
('IE', 'Irsko', 23.00, 'vat', TRUE, FALSE),
('RO', 'Rumunsko', 19.00, 'vat', TRUE, FALSE),
('BG', 'Bulharsko', 20.00, 'vat', TRUE, FALSE),
('HR', 'Chorvatsko', 25.00, 'vat', TRUE, FALSE),
('SI', 'Slovinsko', 22.00, 'vat', TRUE, FALSE),
('LT', 'Litva', 21.00, 'vat', TRUE, FALSE),
('LV', 'Lotyšsko', 21.00, 'vat', TRUE, FALSE),
('EE', 'Estonsko', 22.00, 'vat', TRUE, FALSE),
('LU', 'Lucembursko', 17.00, 'vat', TRUE, FALSE),
('MT', 'Malta', 18.00, 'vat', TRUE, FALSE),
('CY', 'Kypr', 19.00, 'vat', TRUE, FALSE),
('EL', 'Řecko', 24.00, 'vat', TRUE, FALSE);

-- Add tax columns to orders
ALTER TABLE user_orders ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 2) DEFAULT 0 AFTER discount_amount;
ALTER TABLE user_orders ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2) DEFAULT 0 AFTER tax_rate;
ALTER TABLE user_orders ADD COLUMN IF NOT EXISTS country_code CHAR(2) NULL AFTER tax_amount;
ALTER TABLE user_orders ADD COLUMN IF NOT EXISTS vat_number VARCHAR(50) NULL AFTER country_code;
ALTER TABLE user_orders ADD COLUMN IF NOT EXISTS price_without_tax DECIMAL(10, 2) NULL AFTER vat_number;

-- Add country/VAT to user profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_code CHAR(2) DEFAULT 'CZ' AFTER company;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vat_number VARCHAR(50) NULL AFTER country_code;
