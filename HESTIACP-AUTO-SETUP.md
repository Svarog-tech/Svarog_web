# 🚀 Automatické vytváření HestiaCP účtů po platbě

Tento dokument popisuje, jak funguje automatické vytváření hosting účtů v HestiaCP po úspěšném zaplacení objednávky přes GoPay.

## 📋 Obsah

- [Jak to funguje](#jak-to-funguje)
- [Požadavky](#požadavky)
- [Instalace a konfigurace](#instalace-a-konfigurace)
- [Databázové změny](#databázové-změny)
- [Testování](#testování)
- [Řešení problémů](#řešení-problémů)

---

## 🔄 Jak to funguje

### Kompletní flow

```
1. Zákazník vybere hosting plán
   ↓
2. Vyplní doménu a údaje
   ↓
3. Vytvoří se objednávka v databázi (user_orders)
   ↓
4. Přesměrování na GoPay platební bránu
   ↓
5. Zákazník zaplatí
   ↓
6. GoPay notification → checkPaymentStatus()
   ↓
7. Status = PAID → Aktualizace user_orders
   ↓
8. Database trigger → Vytvoří user_hosting_services
   ↓
9. PaymentService → Zavolá createHostingAccountForOrder()
   ↓
10. HestiaCP API → Vytvoří uživatele + doménu
   ↓
11. Uložení HestiaCP údajů do user_hosting_services
   ↓
12. ✅ Hotovo! Zákazník má hosting účet
```

---

## 📦 Požadavky

### HestiaCP Server

- ✅ HestiaCP nainstalovaný a běžící
- ✅ Port 8083 otevřený (HestiaCP API)
- ✅ Vygenerované API Access Keys
- ✅ Firewall povoluje přístup z vaší IP

### Aplikace

- ✅ Node.js backend (server.js)
- ✅ Supabase databáze
- ✅ GoPay účet (pro platby)

---

## ⚙️ Instalace a konfigurace

### 1. Nastavení HestiaCP API

#### a) Vygenerování Access Keys

Na HestiaCP serveru spusť:

```bash
# Přihlaš se jako admin
ssh root@your-server-ip

# Vygeneruj access keys
v-add-access-key admin '*' mykey json

# Zobrazí ti ACCESS_KEY_ID a SECRET_ACCESS_KEY
# Ulož si je bezpečně!
```

#### b) Povolení IP adresy

```bash
# Přidej svou IP do firewallu
v-add-firewall-rule ACCEPT your-ip-address 8083 tcp "API access"

# Restartuj HestiaCP
sudo systemctl restart hestia
```

#### c) Test API připojení

```bash
# Zkopíruj .env.deploy.example jako .env.deploy
cp .env.deploy.example .env.deploy

# Vyplň HestiaCP údaje v .env.deploy
nano .env.deploy

# Spusť test
chmod +x test-hestia-api.sh
./test-hestia-api.sh
```

### 2. Konfigurace aplikace

#### a) Backend (.env)

Přidej do svého `.env` souboru:

```env
# HestiaCP Configuration
HESTIACP_URL=https://your-server-ip:8083
HESTIACP_USERNAME=your-hestia-admin-username
HESTIACP_ACCESS_KEY=your-access-key-id
HESTIACP_SECRET_KEY=your-secret-access-key
HESTIACP_DEFAULT_PACKAGE=default
HESTIACP_SERVER_IP=your-server-ip
```

**Příklad s reálnými hodnotami:**

```env
HESTIACP_URL=https://185.123.45.67:8083
HESTIACP_USERNAME=epgmooky
HESTIACP_ACCESS_KEY=o2z6TO8bZ7M89w1SrfUr
HESTIACP_SECRET_KEY=x62zVT1n=tS6gqZXiDfjApFJd9ppdXLU_VW6lIp-
HESTIACP_DEFAULT_PACKAGE=default
HESTIACP_SERVER_IP=185.123.45.67
```

#### b) Restart serveru

```bash
# Zastaví běžící server
# Spusť znovu
node server.js
```

Měl bys vidět:

```
================================================
  GoPay & HestiaCP Proxy Server
================================================
...
HestiaCP Status: ✅ Configured
================================================
```

---

## 🗄️ Databázové změny

### Spuštění SQL migrace

Přihlaš se do Supabase SQL Editoru a spusť:

```bash
# V Supabase Dashboard
SQL Editor → New Query → zkopíruj obsah souboru:
```

📁 `sql/add-hestiacp-integration.sql`

Tato migrace přidá do tabulek:

**user_hosting_services:**
- `hestia_username` - HestiaCP uživatelské jméno
- `hestia_domain` - Primární doména
- `hestia_package` - Balíček (basic, standard, pro)
- `hestia_created` - Zda byl účet vytvořen
- `hestia_created_at` - Datum vytvoření
- `hestia_error` - Chybová zpráva (pokud se nepodařilo)
- `cpanel_url` - URL pro přístup do panelu

**user_orders:**
- `payment_id` - GoPay payment ID
- `payment_url` - GoPay platební URL
- `gopay_status` - GoPay status (CREATED, PAID, CANCELED)

---

## 🧪 Testování

### 1. Test HestiaCP API přímo

```bash
# Spusť testovací script
./test-hestia-api.sh
```

Očekávaný výstup:

```
✅ Server is reachable
✅ API authentication successful
✅ API commands are responding
🎉 You're ready to deploy!
```

### 2. Test vytvoření účtu přes API

Pomocí curl nebo Postman:

```bash
curl -X POST http://localhost:3001/api/hestiacp/create-account \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "domain": "testdomain.com",
    "package": "basic"
  }'
```

Očekávaná odpověď:

```json
{
  "success": true,
  "username": "test123abc",
  "password": "generatedPassword123",
  "domain": "testdomain.com",
  "cpanelUrl": "https://your-server-ip:8083/login/?user=test123abc",
  "package": "basic"
}
```

### 3. Test kompletního flow (End-to-End)

1. **Otevři aplikaci** v prohlížeči
2. **Vyber hosting plán** (např. Basic)
3. **Vyplň údaje:**
   - Email: `test@example.com`
   - Doména: `testdomain.com`
   - Jméno, adresa atd.
4. **Klikni "Zaplatit"**
5. **V GoPay Sandbox** použij testovací kartu:
   - Číslo: `4111111111111111`
   - Datum: jakýkoliv budoucí datum
   - CVV: `123`
6. **Potvrď platbu**
7. **Zkontroluj v databázi:**

```sql
-- V Supabase SQL Editor
SELECT * FROM user_orders WHERE billing_email = 'test@example.com';
SELECT * FROM user_hosting_services WHERE hestia_created = TRUE;
```

8. **Zkontroluj v HestiaCP:**
   - Přihlaš se do HestiaCP panelu
   - Menu → Users → měl bys vidět nového uživatele
   - Menu → Web → měl bys vidět novou doménu

---

## 🔧 Řešení problémů

### ❌ HestiaCP API nedostupné

**Chyba:**
```
Cannot reach server at https://server-ip:8083
```

**Řešení:**

1. Zkontroluj že HestiaCP běží:
   ```bash
   sudo systemctl status hestia
   ```

2. Zkontroluj firewall:
   ```bash
   v-list-firewall
   # Přidej pravidlo pokud chybí
   v-add-firewall-rule ACCEPT your-ip 8083 tcp "API"
   ```

3. Zkontroluj že port 8083 je otevřený:
   ```bash
   curl -k https://server-ip:8083
   ```

### ❌ Authentication fails

**Chyba:**
```
API authentication failed
```

**Řešení:**

1. Zkontroluj access keys v `.env`:
   ```bash
   cat .env | grep HESTIACP
   ```

2. Vygeneruj nové access keys:
   ```bash
   v-delete-access-key admin mykey
   v-add-access-key admin '*' mykey json
   ```

3. Aktualizuj `.env` s novými keys

### ❌ User already exists

**Chyba:**
```
User xyz123 already exists
```

**Řešení:**

Automaticky se vygeneruje nové uživatelské jméno s náhodným suffixem. Pokud problém přetrvává, smaž testovacího uživatele:

```bash
v-delete-user testovaci-username yes
```

### ❌ Domain creation failed

**Chyba:**
```
Failed to create domain: testdomain.com
```

**Možné příčiny:**

1. **Doména už existuje** - zkontroluj:
   ```bash
   v-list-web-domains username
   ```

2. **Nesprávná IP adresa** - zkontroluj HESTIACP_SERVER_IP v `.env`

3. **DNS problémy** - to nevadí, doména se vytvoří i bez DNS

### ❌ SSL setup failed

**Upozornění:**
```
SSL setup failed (this is OK if domain DNS is not ready yet)
```

**Vysvětlení:**

To není chyba! SSL certifikát se nastaví automaticky až když:
1. Doména je namířená na server (A záznam)
2. DNS propagace proběhla (24-48 hodin)

Můžeš ho nastavit později manuálně:

```bash
v-add-letsencrypt-domain username domain.com www.domain.com
```

### 🐛 Debug mode

Pro podrobnější logy přidej do `server.js`:

```javascript
// Na začátek souboru
process.env.DEBUG = 'hestiacp:*';
```

A v HestiaCP serveru:

```bash
# Sleduj API logy
tail -f /var/log/hestia/api.log
```

---

## 📚 API Reference

### Backend Endpoints

#### `POST /api/hestiacp/create-account`

Vytvoří nový hosting účet.

**Request:**
```json
{
  "email": "user@example.com",
  "domain": "example.com",
  "package": "basic",
  "username": "optional-custom-username",
  "password": "optional-custom-password"
}
```

**Response:**
```json
{
  "success": true,
  "username": "user123abc",
  "password": "generatedPassword",
  "domain": "example.com",
  "cpanelUrl": "https://server:8083/login/?user=user123abc",
  "package": "basic"
}
```

#### `POST /api/hestiacp/suspend-account`

Suspenduje hosting účet.

**Request:**
```json
{
  "username": "user123abc"
}
```

#### `POST /api/hestiacp/unsuspend-account`

Obnoví suspendovaný účet.

#### `POST /api/hestiacp/delete-account`

Smaže hosting účet (včetně všech dat!).

---

## 🔒 Bezpečnost

### ✅ Co je zabezpečené

- ✅ **API keys místo hesel** - používáme access keys místo admin hesla
- ✅ **HTTPS** - veškerá komunikace přes HTTPS
- ✅ **IP Whitelist** - pouze povolené IP mohou volat API
- ✅ **Row Level Security** - uživatelé vidí jen svoje data
- ✅ **Environment variables** - citlivé údaje v .env (ne v kódu)

### ⚠️ Bezpečnostní doporučení

1. **NIKDY necommituj** `.env` soubor do Gitu
   - Je v `.gitignore` - zkontroluj to!

2. **Hesla do databáze** by měla být zašifrovaná
   - V produkci použij: `bcrypt` nebo `crypto.encrypt()`

3. **Posílej přihlašovací údaje emailem**
   - Ne do databáze! (Momentálně v `notes` - jen pro testování)

4. **Pravidelně rotuj API keys**
   ```bash
   v-delete-access-key admin oldkey
   v-add-access-key admin '*' newkey json
   ```

5. **Používej 2FA** pro HestiaCP admin účet

---

## 📧 Automatické emaily (TODO)

Pro produkci by sis měl přidat automatické posílání emailů:

```typescript
// Po vytvoření účtu
await sendWelcomeEmail({
  to: email,
  subject: 'Váš hosting účet je aktivní!',
  template: 'welcome',
  data: {
    username: result.username,
    password: result.password,
    cpanelUrl: result.cpanelUrl,
    domain: result.domain
  }
});
```

Doporučené služby:
- **SendGrid** - https://sendgrid.com/
- **Mailgun** - https://www.mailgun.com/
- **AWS SES** - https://aws.amazon.com/ses/

---

## 🎯 Další vylepšení

### 1. Webhook od GoPay

Místo checkování platby v clientu, nastav webhook:

```javascript
// server.js
app.post('/api/gopay/webhook', async (req, res) => {
  const { id, state } = req.body;

  // Zkontroluj platbu
  const result = await checkPayment(id);

  if (result.status === 'PAID') {
    // Automaticky vytvoř hosting
  }

  res.sendStatus(200);
});
```

V GoPay nastav notification URL:
```
https://your-domain.com/api/gopay/webhook
```

### 2. Email notifikace

- Po vytvoření účtu
- Když vyprší platba
- Když je účet suspendován

### 3. Admin panel

- Zobrazit všechny hosting účty
- Manuálně vytvořit/smazat/suspendovat
- Zobrazit HestiaCP logy

### 4. Automatická obnova

```sql
-- Cron job který zkontroluje expirující účty
SELECT * FROM user_hosting_services
WHERE expires_at < NOW() + INTERVAL '7 days'
AND auto_renewal = TRUE;
```

---

## 📞 Kontakt a podpora

Pokud máš problémy:

1. Zkontroluj logy: `tail -f /var/log/hestia/api.log`
2. Zkontroluj browser console: F12 → Console
3. Zkontroluj server logy: logs v terminálu kde běží `node server.js`

---

## ✅ Checklist před spuštěním do produkce

- [ ] HestiaCP běží a je dostupný na port 8083
- [ ] API keys vygenerované a uložené v `.env`
- [ ] Firewall povoluje přístup
- [ ] Test HestiaCP API prošel (`./test-hestia-api.sh`)
- [ ] SQL migrace spuštěna (`add-hestiacp-integration.sql`)
- [ ] GoPay nastaveno na PRODUCTION (ne SANDBOX)
- [ ] Test kompletního flow prošel (objednávka → platba → hosting)
- [ ] `.env` je v `.gitignore`
- [ ] Hesla nejsou ukládána do databáze v plain textu
- [ ] Email notifikace nastaveny
- [ ] Webhook od GoPay nakonfigurován
- [ ] SSL certifikáty nastaveny
- [ ] Backup databáze nakonfigurován

---

**🎉 Hotovo! Nyní máš plně funkční automatické vytváření hosting účtů!**

Pro další otázky se podívej do `API-INFO.md` nebo `DEPLOYMENT.md`.
