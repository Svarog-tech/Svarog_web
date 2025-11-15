# 💳 GoPay Payment Gateway Setup

## 🔑 Testovací credentials (SANDBOX)

```
GoID: 8801275087
Secure Key: JCHQAtu6Ks7RzBN5DUR7xnWm
Client ID: 1341082006
Client Secret: 57RdPFDE
Environment: SANDBOX
```

## ✅ Co jsem udělal

1. ✅ Přidal GoPay credentials do `.env` souboru
2. ✅ Vytvořil `setup-gopay-secrets.bat` pro Supabase secrets
3. ✅ Připravil GoPay integration:
   - `src/services/paymentService.ts` - Payment service
   - `supabase/functions/create-gopay-payment/` - Edge Function pro vytvoření platby
   - `supabase/functions/check-gopay-payment/` - Edge Function pro kontrolu statusu
   - `supabase/functions/gopay-webhook/` - Webhook pro notifikace

## 📋 Setup kroky

### ⚡ RYCHLÝ START (automatický deployment)

**Nejjednodušší způsob - spusť jen tento soubor:**
```bash
DEPLOY-VSETKO.bat
```
Tento skript udělá všechno za tebe! Otevře se prohlížeč pro přihlášení, potvrď ho a hotovo. ✨

---

### 📝 MANUÁLNÍ POSTUP (pokud automatický nefunguje)

#### Krok 1: Spusť SQL migraci pro GoPay

```bash
# V Supabase Dashboard → SQL Editor
# Zkopíruj a spusť: sql/add-admin-and-payment.sql
```

SQL migrace přidá:
- `payment_id` - GoPay payment ID
- `payment_url` - URL pro přesměrování na platbu
- `gopay_status` - Status platby z GoPay (PAID, CANCELED, etc.)
- `payment_status` - Interní status (paid, unpaid, failed, refunded)

#### Krok 2: Nasaď Edge Functions

**Spusť tyto soubory v pořadí:**
```bash
1-login-supabase.bat      # Přihlásí tě do Supabase
2-link-project.bat        # Propojí s projektem
3-set-secrets.bat         # Nastaví GoPay credentials
4-deploy-functions.bat    # Nasadí Edge Functions s CORS
supabase secrets set GOPAY_ENVIRONMENT=SANDBOX
```

### Krok 3: Nasaď Edge Functions

```bash
# Přihlas se do Supabase CLI
supabase login

# Link k projektu
supabase link --project-ref ccgxtldxeerwacyekzyk

# Nasaď funkce
supabase functions deploy create-gopay-payment --no-verify-jwt
supabase functions deploy check-gopay-payment --no-verify-jwt
supabase functions deploy gopay-webhook --no-verify-jwt
```

### Krok 4: Nastav Webhook URL v GoPay

1. Přihlas se na [GoPay Portal](https://gate.gopay.cz/)
2. **Nastavení** → **Notifikační URL**
3. Zadej webhook URL:
   ```
   https://ccgxtldxeerwacyekzyk.supabase.co/functions/v1/gopay-webhook
   ```
4. Ulož

### Krok 5: Nastav prvního admina

```sql
-- V Supabase Dashboard → SQL Editor
UPDATE public.profiles
SET is_admin = TRUE
WHERE email = 'tvuj@email.cz';
```

### Krok 6: Restartuj aplikaci

```bash
# Zastav aplikaci (Ctrl+C)
npm start
```

## 🧪 Testování platby

### 1. Vytvoř objednávku

1. Otevři Configurator: `http://localhost:3000/configurator`
2. Vyber plán a vyplň údaje
3. Klikni **"Objednat"**
4. Mělo by tě přesměrovat na GoPay platební bránu

### 2. Testovací platební karty (SANDBOX)

**Úspěšná platba:**
```
Číslo karty: 4111111111111111
Expirace: 12/28
CVV: 123
```

**Neúspěšná platba:**
```
Číslo karty: 4000000000000002
Expirace: 12/28
CVV: 123
```

### 3. Zkontroluj výsledek

- Po platbě tě přesměruje na: `http://localhost:3000/payment/success?payment_id=XXX`
- Stránka automaticky zkontroluje status každých 5 sekund
- V Admin panelu (`/admin`) uvidíš objednávku s aktualizovaným statusem

## 📊 Flow platby

```
1. User vytvoří objednávku v Configuratoru
   ↓
2. Frontend zavolá createOrder() → uloží do DB
   ↓
3. Frontend zavolá createGoPayPayment()
   ↓
4. Edge Function vytvoří platbu v GoPay
   ↓
5. Frontend přesměruje na payment_url
   ↓
6. User zaplatí na GoPay bráně
   ↓
7. GoPay webhook notifikuje Supabase
   ↓
8. Edge Function aktualizuje order status
   ↓
9. GoPay přesměruje usera na return_url
   ↓
10. PaymentSuccess stránka zobrazí výsledek
```

## 🔍 Monitoring a Debug

### Zkontroluj Edge Function logy

```bash
# Real-time logs
supabase functions logs create-gopay-payment --tail
supabase functions logs gopay-webhook --tail
```

### Zkontroluj objednávky v Admin panelu

1. Přihlas se jako admin
2. Otevři: `http://localhost:3000/admin`
3. Uvidíš:
   - Všechny objednávky
   - GoPay payment ID
   - Status platby
   - Možnost změnit status

### Zkontroluj databázi

```sql
-- Všechny objednávky s platebními informacemi
SELECT
  id,
  customer_name,
  customer_email,
  plan_name,
  price,
  status,
  payment_status,
  gopay_status,
  payment_id,
  created_at
FROM user_orders
ORDER BY created_at DESC;
```

## 🐛 Troubleshooting

### Edge Function vrací error

**Problém:** "GOPAY_CLIENT_ID is not defined"
**Řešení:** Zkontroluj secrets:
```bash
supabase secrets list
```
Měly by být nastavené všechny 4 secrets.

### Platba se nevytváří

**Problém:** Console error při createGoPayPayment()
**Řešení:**
1. Zkontroluj Edge Function logs
2. Ověř že jsou nasazené:
   ```bash
   supabase functions list
   ```

### Webhook nefunguje

**Problém:** Status se neaktualizuje po platbě
**Řešení:**
1. Zkontroluj webhook URL v GoPay Portalu
2. Zkontroluj Edge Function logs:
   ```bash
   supabase functions logs gopay-webhook --tail
   ```
3. Ověř že webhook má `--no-verify-jwt` flag

### Admin panel je prázdný

**Problém:** Nemáš přístup do admin panelu
**Řešení:** Nastav is_admin:
```sql
UPDATE public.profiles
SET is_admin = TRUE
WHERE email = 'tvuj@email.cz';
```

## 📈 Admin funkce

### Správa objednávek

V admin panelu můžeš:
- ✅ Zobrazit všechny objednávky
- ✅ Filtrovat podle statusu
- ✅ Vyhledávat podle jména/emailu
- ✅ Zobrazit detail objednávky
- ✅ Změnit status objednávky
- ✅ Změnit status platby
- ✅ Vidět GoPay payment ID

### Statistiky

Admin panel zobrazuje:
- 📊 Celkový počet objednávek
- 💰 Celkové tržby
- ⏳ Čekající objednávky
- ✅ Aktivní služby
- 📈 Grafy a trendy
- 💵 Průměrná hodnota objednávky

## 🚀 Produkční nasazení

### 1. Získej produkční credentials

1. Registruj se na [gopay.com](https://www.gopay.com/)
2. Získej produkční GoID, Client ID a Secret
3. Aktualizuj secrets:
   ```bash
   supabase secrets set GOPAY_ENVIRONMENT=PRODUCTION
   supabase secrets set GOPAY_GO_ID=your_production_go_id
   supabase secrets set GOPAY_CLIENT_ID=your_production_client_id
   supabase secrets set GOPAY_CLIENT_SECRET=your_production_client_secret
   ```

### 2. Aktualizuj .env pro produkci

```env
REACT_APP_GOPAY_GO_ID=your_production_go_id
REACT_APP_GOPAY_CLIENT_ID=your_production_client_id
REACT_APP_GOPAY_CLIENT_SECRET=your_production_client_secret
REACT_APP_GOPAY_ENVIRONMENT=PRODUCTION
```

### 3. Nastav produkční webhook URL

V GoPay Portalu zadej:
```
https://ccgxtldxeerwacyekzyk.supabase.co/functions/v1/gopay-webhook
```

### 4. Testuj s malými částkami

Nejdřív otestuj s minimálními částkami pro ověření funkčnosti.

## ✨ Features

### Automatické flow
- ✅ Automatické vytvoření platby po objednávce
- ✅ Přesměrování na GoPay bránu
- ✅ Webhook automaticky aktualizuje status
- ✅ Real-time kontrola statusu na success stránce

### Bezpečnost
- ✅ Secrets uložené v Supabase (ne v kódu)
- ✅ OAuth 2.0 authentication s GoPay
- ✅ Row Level Security v databázi
- ✅ Admin-only přístup k management funkcím

### User Experience
- ✅ Plynulé přesměrování na platbu
- ✅ Loading states a progress indikátory
- ✅ Error handling a retry logika
- ✅ Success/failed stavy s vizuální zpětnou vazbou

## 📞 Support

Pokud máš problémy:
1. Zkontroluj Edge Function logs
2. Zkontroluj browser console
3. Zkontroluj databázové záznamy
4. Kontaktuj GoPay support pro platební problémy

---

**Vytvořeno:** 2025
**Status:** ✅ Testovací prostředí připravené
**Next:** Nasaď Edge Functions a testuj platby! 🚀
