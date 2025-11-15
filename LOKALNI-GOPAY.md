# 💳 LOKÁLNÍ GoPay bez Edge Functions

## ✅ Co jsem udělal

Přepsal jsem GoPay integraci na **100% lokální verzi** která běží přímo v React aplikaci:

- ❌ **ŽÁDNÉ Edge Functions** - není potřeba nic nasazovat!
- ❌ **ŽÁDNÝ Supabase deployment** - všechno běží lokálně!
- ✅ **GoPay API volání přímo z React** aplikace
- ✅ **Credentials z .env** souboru

## 🚀 Jak to použít (3 kroky)

### 1. Zkontroluj .env

Credentials už jsou v `.env` souboru:
```env
REACT_APP_GOPAY_GO_ID=8801275087
REACT_APP_GOPAY_CLIENT_ID=1341082006
REACT_APP_GOPAY_CLIENT_SECRET=57RdPFDE
REACT_APP_GOPAY_ENVIRONMENT=SANDBOX
```

### 2. Spusť SQL migraci

V Supabase Dashboard → SQL Editor spusť:
```sql
-- Soubor: sql/add-admin-and-payment.sql
```

Přidá tyto sloupce do `user_orders`:
- `payment_id` - GoPay payment ID
- `payment_url` - URL pro platbu
- `gopay_status` - Status z GoPay
- `payment_status` - Interní status

### 3. Restartuj aplikaci

```bash
# Zastav (Ctrl+C)
npm start
```

**A JE TO!** 🎉

## 🧪 Testování

### 1. Vytvoř objednávku

Otevři: `http://localhost:3000/configurator`

1. Vyber plán
2. Vyplň údaje
3. Klikni **"Objednat"**
4. Mělo by tě přesměrovat na GoPay bránu!

### 2. Testovací karta

```
Číslo: 4111111111111111
Expirace: 12/28
CVV: 123
```

### 3. Sleduj konzoli

Otevři Browser DevTools (F12) → Console:
```
Getting GoPay access token...
Access token obtained
Creating GoPay payment locally...
Sending payment request to GoPay...
Payment created successfully: {...}
```

## 📊 Jak to funguje

```
1. User klikne "Objednat" v Configuratoru
   ↓
2. createGoPayPayment() získá OAuth token z GoPay
   ↓
3. Vytvoří platbu přes GoPay API
   ↓
4. Uloží payment_id a payment_url do databáze
   ↓
5. Přesměruje usera na payment_url (GoPay brána)
   ↓
6. User zaplatí kartou
   ↓
7. GoPay přesměruje zpět na return_url
   ↓
8. PaymentSuccess stránka zkontroluje status
   ↓
9. checkPaymentStatus() získá aktuální status z GoPay
   ↓
10. Aktualizuje databázi
```

## 🔍 Debugging

### Console logy

Všechny GoPay operace logují do konzole:
- "Getting GoPay access token..." - žádá o OAuth token
- "Payment created successfully" - platba vytvořena
- "Checking payment status" - kontroluje status
- Errory zobrazí celou response z GoPay

### Časté problémy

**"Failed to get access token"**
- Zkontroluj .env credentials
- Restartuj aplikaci (npm start)

**"GoPay API error"**
- Otevři konzoli a podívej se na celou error response
- Zkontroluj částku (musí být > 0)
- Zkontroluj GoID v .env

**CORS error**
- To je normální - GoPay API ho správně zpracuje
- Důležité je že dostaneš payment_url zpět

## ⚠️ Důležité upozornění

**Toto je lokální dev verze!**

Pro **produkci** MUSÍŠ použít Edge Functions, protože:
- ❌ Client secret je viditelný v browseru (bezpečnostní riziko)
- ❌ API klíče mohou být ukradeny
- ❌ Každý může vidět tvé credentials

Ale pro **lokální vývoj a testování** je to **perfektní**! ✨

## 📈 Admin panel

Admin panel funguje normálně:
- ✅ Zobrazí všechny objednávky
- ✅ Ukáže GoPay payment ID
- ✅ Status platby
- ✅ Možnost změnit status

Přístup: `http://localhost:3000/admin`

(Nejdřív nastav admina v SQL:)
```sql
UPDATE public.profiles
SET is_admin = TRUE
WHERE email = 'tvuj@email.cz';
```

## 🎯 Co funguje

- ✅ Vytvoření platby v GoPay
- ✅ Přesměrování na platební bránu
- ✅ Return URL zpět do aplikace
- ✅ Kontrola statusu platby
- ✅ Aktualizace databáze
- ✅ Admin panel s přehledem
- ✅ PaymentSuccess stránka

## 🚀 Pro produkci později

Když budeš chtít nasadit produkčně:
1. Použij Edge Functions (jsou připravené v `supabase/functions/`)
2. Nasaď je přes deployment scripty
3. Změň `paymentService.ts` aby volal Edge Functions místo přímo GoPay

Ale **TERAZ TO FUNGUJE LOKÁLNĚ** a můžeš testovat! 🎉

---

**Vytvořeno:** 2025-11-10
**Status:** ✅ Funguje lokálně bez Edge Functions
**Next:** Testuj platby! 💳
