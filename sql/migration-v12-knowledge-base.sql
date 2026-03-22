-- =============================================================================
-- Migration v12: Knowledge Base / Help Center
-- =============================================================================

CREATE TABLE IF NOT EXISTS kb_categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NULL,
  icon VARCHAR(50) NULL COMMENT 'FontAwesome icon name',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kb_articles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL UNIQUE,
  content TEXT NOT NULL,
  excerpt VARCHAR(1000) NULL,
  tags JSON NULL,
  views INT DEFAULT 0,
  helpful_yes INT DEFAULT 0,
  helpful_no INT DEFAULT 0,
  is_published BOOLEAN DEFAULT TRUE,
  author_id VARCHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES kb_categories(id),
  INDEX idx_category (category_id, is_published),
  INDEX idx_slug (slug),
  FULLTEXT INDEX ft_search (title, content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default categories
INSERT INTO kb_categories (name, slug, description, icon, sort_order) VALUES
('Začínáme', 'zaciname', 'Základní průvodce pro nové zákazníky', 'faRocket', 1),
('Hosting', 'hosting', 'Správa hostingu, PHP, databáze', 'faServer', 2),
('E-mail', 'email', 'Nastavení e-mailových účtů a klientů', 'faEnvelope', 3),
('Domény a DNS', 'domeny-dns', 'Registrace domén a správa DNS', 'faGlobe', 4),
('FTP a soubory', 'ftp-soubory', 'Připojení přes FTP a správa souborů', 'faFolder', 5),
('Bezpečnost', 'bezpecnost', 'SSL, zálohy a zabezpečení', 'faShieldAlt', 6),
('Fakturace', 'fakturace', 'Platby, faktury a promo kódy', 'faFileInvoice', 7);

-- Insert starter articles
INSERT INTO kb_articles (category_id, title, slug, content, excerpt) VALUES
(1, 'Jak aktivovat hosting po objednávce', 'jak-aktivovat-hosting', 'Po úspěšné platbě je váš hosting aktivován automaticky během několika minut. Přihlašovací údaje k HestiaCP panelu obdržíte e-mailem.\n\n## Kroky po aktivaci\n\n1. Otevřete e-mail s přihlašovacími údaji\n2. Přihlaste se do HestiaCP panelu\n3. Nastavte svou doménu\n4. Nahrajte soubory webu přes File Manager nebo FTP\n\n## Časté problémy\n\n- **Nedostali jste e-mail?** Zkontrolujte složku spam nebo kontaktujte podporu.\n- **Hosting není aktivní?** Ověřte, zda byla platba úspěšně dokončena.', 'Průvodce aktivací hostingu po úspěšné platbě'),
(1, 'Přehled HestiaCP panelu', 'prehled-hestiacp', 'HestiaCP je moderní open-source panel pro správu webhostingu. Nabízí intuitivní rozhraní pro správu domén, e-mailů, databází, souborů a dalších služeb.\n\n## Hlavní sekce\n\n- **Web** - správa domén a webových stránek\n- **DNS** - správa DNS záznamů\n- **Mail** - e-mailové účty\n- **DB** - databáze MySQL/MariaDB\n- **Cron** - plánované úlohy\n- **Backup** - zálohy', 'Základní přehled funkcí HestiaCP panelu'),
(2, 'Jak změnit verzi PHP', 'zmena-verze-php', 'V HestiaCP panelu můžete snadno změnit verzi PHP pro každou doménu.\n\n## Postup\n\n1. Přihlaste se do HestiaCP\n2. Přejděte do sekce **Web**\n3. Klikněte na doménu, kterou chcete upravit\n4. V nastavení najděte **PHP Version**\n5. Vyberte požadovanou verzi (doporučujeme PHP 8.x)\n6. Uložte změny\n\nZměna se projeví okamžitě.', 'Návod na změnu PHP verze v HestiaCP'),
(2, 'Jak vytvořit databázi', 'vytvoreni-databaze', 'Databázi MySQL/MariaDB vytvoříte snadno přes náš panel nebo přímo v HestiaCP.\n\n## Přes Alatyr panel\n\n1. Přejděte do správy služby\n2. Klikněte na **Databáze**\n3. Zadejte název databáze a heslo\n4. Klikněte **Vytvořit**\n\n## Připojení k databázi\n\n- Host: localhost\n- Port: 3306\n- Uživatel: váš_hestia_username_nazev\n- Heslo: zvolené heslo', 'Návod na vytvoření a připojení k databázi'),
(3, 'Jak vytvořit e-mailový účet', 'vytvoreni-emailu', 'E-mailový účet vytvoříte přes náš panel v sekci správy služby.\n\n## Postup\n\n1. Přejděte do správy vaší služby\n2. Klikněte na **E-maily**\n3. Klikněte **Nový e-mail**\n4. Zadejte adresu a heslo\n5. Potvrďte vytvoření\n\n## Nastavení e-mailového klienta\n\n### IMAP (doporučeno)\n- Server: mail.vaše-doména.cz\n- Port: 993 (SSL)\n- Uživatel: celá e-mailová adresa\n\n### SMTP (odchozí)\n- Server: mail.vaše-doména.cz\n- Port: 465 (SSL)\n- Uživatel: celá e-mailová adresa', 'Vytvoření e-mailu a nastavení klienta'),
(4, 'Jak nastavit DNS záznamy', 'nastaveni-dns', 'DNS záznamy spravujete přes sekci DNS ve správě vaší služby.\n\n## Běžné typy záznamů\n\n- **A** - směruje doménu na IP adresu\n- **CNAME** - alias pro jinou doménu\n- **MX** - mailový server\n- **TXT** - textový záznam (SPF, DKIM, verifikace)\n- **NS** - nameserver\n\n## Postup přidání záznamu\n\n1. Přejděte do **DNS** sekce\n2. Vyberte doménu\n3. Klikněte **Přidat záznam**\n4. Vyplňte typ, název a hodnotu\n5. Uložte\n\nZměny DNS se propagují 1-48 hodin.', 'Průvodce nastavením DNS záznamů'),
(5, 'Jak se připojit přes FTP', 'pripojeni-ftp', 'Pro přenos souborů na hosting použijte FTP klienta (doporučujeme FileZilla).\n\n## Přihlašovací údaje\n\n- **Server**: vaše-doména.cz (nebo IP adresa serveru)\n- **Uživatel**: vaše HestiaCP uživatelské jméno\n- **Heslo**: heslo k HestiaCP účtu\n- **Port**: 21 (FTP) nebo 22 (SFTP - doporučeno)\n\n## Doporučený postup\n\n1. Stáhněte FileZilla (filezilla-project.org)\n2. Zadejte přihlašovací údaje\n3. Připojte se\n4. Soubory nahrávejte do složky `/web/vaše-doména/public_html/`', 'Návod na FTP připojení pomocí FileZilla'),
(6, 'Jak fungují zálohy', 'zalohy', 'Alatyr Hosting provádí automatické denní zálohy vašich dat.\n\n## Automatické zálohy\n\n- Zálohy probíhají denně v nočních hodinách\n- Uchováváme zálohy za posledních 7 dní\n- Zahrnují: soubory, databáze, e-maily, DNS záznamy\n\n## Ruční záloha\n\n1. Přejděte do správy služby\n2. Klikněte na **Zálohy**\n3. Klikněte **Vytvořit zálohu**\n\n## Obnovení ze zálohy\n\n1. V sekci **Zálohy** najděte požadovanou zálohu\n2. Klikněte **Obnovit**\n3. Potvrzujte obnovení', 'Informace o automatických a ručních zálohách');
