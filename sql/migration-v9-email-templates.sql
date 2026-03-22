-- =============================================================================
-- Migration V9: Email Templates
-- Alatyr Hosting - Customizable email template management
-- =============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `email_templates` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `template_key` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `subject` varchar(500) NOT NULL,
  `body_html` text NOT NULL,
  `body_text` text DEFAULT NULL,
  `variables` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`variables`)),
  `category` enum('auth','payment','hosting','support','system') NOT NULL DEFAULT 'system',
  `is_active` tinyint(1) DEFAULT 1,
  `updated_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_template_key` (`template_key`),
  KEY `idx_category` (`category`),
  KEY `idx_key` (`template_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- Default templates matching existing hardcoded emails in emailService.js
-- =============================================================================

-- 1. Password Reset
INSERT INTO `email_templates` (`template_key`, `name`, `subject`, `body_html`, `body_text`, `variables`, `category`) VALUES
('password_reset', 'Reset hesla', 'Alatyr Hosting – reset hesla',
'<p>Dobrý den,</p>
<p>obdrželi jsme žádost o resetování hesla k Vašemu účtu na <strong>Alatyr Hosting</strong>.</p>
<p>Pokud jste o reset nežádali, můžete tento email ignorovat.</p>
<p>
  Pro nastavení nového hesla klikněte na tento odkaz:<br />
  <a href="{{reset_url}}" target="_blank" rel="noopener noreferrer">{{reset_url}}</a>
</p>
<p>Odkaz je platný <strong>1 hodinu</strong>.</p>
<p>S pozdravem,<br />Alatyr Hosting</p>',
'Dobrý den,\n\nobdrželi jsme žádost o resetování hesla k Vašemu účtu na Alatyr Hosting.\nPokud jste o reset nežádali, můžete tento email ignorovat.\n\nPro nastavení nového hesla použijte tento odkaz:\n{{reset_url}}\n\nOdkaz je platný 1 hodinu.\n\nS pozdravem,\nAlatyr Hosting',
'["reset_url"]',
'auth');

-- 2. Email Verification
INSERT INTO `email_templates` (`template_key`, `name`, `subject`, `body_html`, `body_text`, `variables`, `category`) VALUES
('email_verification', 'Ověření emailu', 'Alatyr Hosting – ověření emailu',
'<p>Dobrý den,</p>
<p>děkujeme za registraci na <strong>Alatyr Hosting</strong>.</p>
<p>Pro dokončení registrace je potřeba ověřit vaši emailovou adresu.</p>
<p>
  Pro ověření emailu klikněte na tento odkaz:<br />
  <a href="{{verify_url}}" target="_blank" rel="noopener noreferrer">{{verify_url}}</a>
</p>
<p>Pokud jste se neregistrovali, můžete tento email ignorovat.</p>
<p>S pozdravem,<br />Alatyr Hosting</p>',
'Dobrý den,\n\nděkujeme za registraci na Alatyr Hosting.\nPro dokončení registrace je potřeba ověřit vaši emailovou adresu.\n\nPro ověření emailu použijte tento odkaz:\n{{verify_url}}\n\nPokud jste se neregistrovali, můžete tento email ignorovat.\n\nS pozdravem,\nAlatyr Hosting',
'["verify_url"]',
'auth');

-- 3. Payment Confirmation
INSERT INTO `email_templates` (`template_key`, `name`, `subject`, `body_html`, `body_text`, `variables`, `category`) VALUES
('payment_confirmation', 'Potvrzení platby', 'Alatyr Hosting – potvrzení platby',
'<p>Dobrý den,</p>
<p>děkujeme za vaši platbu za hostingovou službu na <strong>Alatyr Hosting</strong>.</p>
<p><strong>Částka:</strong> {{amount}} {{currency}}<br/>
   <strong>ID objednávky:</strong> {{order_id}}</p>
<p>Fakturu k této platbě si můžete zobrazit zde:<br/>
  <a href="{{invoice_url}}" target="_blank" rel="noopener noreferrer">{{invoice_url}}</a>
</p>
<p>S pozdravem,<br />Alatyr Hosting</p>',
'Dobrý den,\n\nděkujeme za vaši platbu za hostingovou službu na Alatyr Hosting.\nČástka: {{amount}} {{currency}}\nID objednávky: {{order_id}}\n\nFakturu k této platbě si můžete zobrazit zde:\n{{invoice_url}}\n\nS pozdravem,\nAlatyr Hosting',
'["invoice_url", "amount", "currency", "order_id"]',
'payment');

-- 4. Ticket Notification
INSERT INTO `email_templates` (`template_key`, `name`, `subject`, `body_html`, `body_text`, `variables`, `category`) VALUES
('ticket_notification', 'Notifikace k ticketu', 'Alatyr Hosting – {{subject_suffix}}',
'<p>Dobrý den,</p>
<p>{{subject_suffix}}</p>
<p><strong>Náhled zprávy:</strong><br/>{{message_preview}}</p>
<p>Detail ticketu najdete v klientské sekci:<br/>
  <a href="{{ticket_url}}" target="_blank" rel="noopener noreferrer">{{ticket_url}}</a>
</p>
<p>S pozdravem,<br />Alatyr Hosting</p>',
'Dobrý den,\n\n{{subject_suffix}}\n\nNáhled zprávy:\n{{message_preview}}\n\nDetail ticketu najdete v klientské sekci: {{ticket_url}}\n\nS pozdravem,\nAlatyr Hosting',
'["subject_suffix", "message_preview", "ticket_url", "ticket_id"]',
'support');

-- 5. Service Activated
INSERT INTO `email_templates` (`template_key`, `name`, `subject`, `body_html`, `body_text`, `variables`, `category`) VALUES
('service_activated', 'Služba aktivována', 'Alatyr Hosting – služba aktivována',
'<p>Dobrý den,</p>
<p>vaše hostingová služba <strong>{{plan_name}}</strong> byla úspěšně aktivována.</p>
{{#domain}}<p><strong>Doména:</strong> {{domain}}</p>{{/domain}}
{{#expires_at}}<p><strong>Platnost do:</strong> {{expires_at}}</p>{{/expires_at}}
<p>Správu služby najdete v <a href="{{dashboard_url}}" target="_blank" rel="noopener noreferrer">klientské sekci</a>.</p>
<p>S pozdravem,<br />Alatyr Hosting</p>',
'Dobrý den,\n\nvaše hostingová služba "{{plan_name}}" byla úspěšně aktivována.\n{{#domain}}Doména: {{domain}}\n{{/domain}}{{#expires_at}}Platnost do: {{expires_at}}\n{{/expires_at}}\nSprávu služby najdete v klientské sekci: {{dashboard_url}}\n\nS pozdravem,\nAlatyr Hosting',
'["plan_name", "domain", "expires_at", "dashboard_url"]',
'hosting');

-- 6. Service Expiring
INSERT INTO `email_templates` (`template_key`, `name`, `subject`, `body_html`, `body_text`, `variables`, `category`) VALUES
('service_expiring', 'Služba brzy vyprší', 'Alatyr Hosting – služba brzy vyprší',
'<p>Dobrý den,</p>
<p>vaše hostingová služba <strong>{{plan_name}}</strong>{{#domain}} ({{domain}}){{/domain}} vyprší <strong>{{expires_at}}</strong>.</p>
<p>Pokud máte zapnuté automatické prodlužování, služba bude obnovena automaticky.</p>
<p>V opačném případě ji můžete obnovit v <a href="{{dashboard_url}}" target="_blank" rel="noopener noreferrer">klientské sekci</a>.</p>
<p>S pozdravem,<br />Alatyr Hosting</p>',
'Dobrý den,\n\nvaše hostingová služba "{{plan_name}}"{{#domain}} ({{domain}}){{/domain}} vyprší {{expires_at}}.\n\nPokud máte zapnuté automatické prodlužování, služba bude obnovena automaticky.\nV opačném případě ji můžete obnovit v klientské sekci: {{dashboard_url}}\n\nS pozdravem,\nAlatyr Hosting',
'["plan_name", "domain", "expires_at", "dashboard_url"]',
'hosting');

-- 7. Password Changed
INSERT INTO `email_templates` (`template_key`, `name`, `subject`, `body_html`, `body_text`, `variables`, `category`) VALUES
('password_changed', 'Heslo změněno', 'Alatyr Hosting – heslo bylo změněno',
'<p>Dobrý den,</p>
<p>vaše heslo k účtu na <strong>Alatyr Hosting</strong> bylo právě změněno.</p>
<p>Pokud jste tuto změnu neprovedli vy, kontaktujte nás <strong>ihned</strong> na support.</p>
<p>S pozdravem,<br />Alatyr Hosting</p>',
'Dobrý den,\n\nvaše heslo k účtu na Alatyr Hosting bylo právě změněno.\nPokud jste tuto změnu neprovedli vy, kontaktujte nás ihned na support.\n\nS pozdravem,\nAlatyr Hosting',
'[]',
'auth');

-- 8. Welcome Email (new template)
INSERT INTO `email_templates` (`template_key`, `name`, `subject`, `body_html`, `body_text`, `variables`, `category`) VALUES
('welcome_email', 'Uvítací email', 'Vítejte na Alatyr Hosting!',
'<p>Dobrý den {{user_name}},</p>
<p>vítáme vás na <strong>Alatyr Hosting</strong>! Váš účet byl úspěšně vytvořen.</p>
<p>Pro začátek můžete:</p>
<ul>
  <li>Prohlédnout si naše <a href="{{dashboard_url}}" target="_blank" rel="noopener noreferrer">hostingové plány</a></li>
  <li>Nastavit si <a href="{{profile_url}}" target="_blank" rel="noopener noreferrer">svůj profil</a></li>
</ul>
<p>Pokud budete mít jakékoli otázky, neváhejte nás kontaktovat prostřednictvím support ticketu.</p>
<p>S pozdravem,<br />Alatyr Hosting</p>',
'Dobrý den {{user_name}},\n\nvítáme vás na Alatyr Hosting! Váš účet byl úspěšně vytvořen.\n\nPro začátek můžete:\n- Prohlédnout si naše hostingové plány: {{dashboard_url}}\n- Nastavit si svůj profil: {{profile_url}}\n\nPokud budete mít jakékoli otázky, neváhejte nás kontaktovat prostřednictvím support ticketu.\n\nS pozdravem,\nAlatyr Hosting',
'["user_name", "dashboard_url", "profile_url"]',
'auth');

-- 9. 2FA Enabled (new template)
INSERT INTO `email_templates` (`template_key`, `name`, `subject`, `body_html`, `body_text`, `variables`, `category`) VALUES
('2fa_enabled', '2FA aktivováno', 'Alatyr Hosting – dvoufaktorové ověření aktivováno',
'<p>Dobrý den,</p>
<p>dvoufaktorové ověření (2FA) bylo úspěšně aktivováno na vašem účtu na <strong>Alatyr Hosting</strong>.</p>
<p>Od teď budete při přihlášení potřebovat kromě hesla i ověřovací kód z vaší autentizační aplikace.</p>
<p>Pokud jste tuto změnu neprovedli vy, kontaktujte nás <strong>ihned</strong> na support.</p>
<p>S pozdravem,<br />Alatyr Hosting</p>',
'Dobrý den,\n\ndvoufaktorové ověření (2FA) bylo úspěšně aktivováno na vašem účtu na Alatyr Hosting.\n\nOd teď budete při přihlášení potřebovat kromě hesla i ověřovací kód z vaší autentizační aplikace.\n\nPokud jste tuto změnu neprovedli vy, kontaktujte nás ihned na support.\n\nS pozdravem,\nAlatyr Hosting',
'[]',
'auth');
