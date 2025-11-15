# 🎯 Automatické přiřazení hostingu po zaplacení

## ✅ Co jsem udělal

### 1. **Rozšířené GoPay stavy** (`PaymentSuccess.tsx`)
Aplikace teď rozpozná VŠECHNY GoPay stavy:

- ✅ **PAID** = Zaplaceno (success)
- ❌ **CANCELED** = Zrušeno (failed)
- ❌ **TIMEOUTED** = Vypršel čas (failed)
- ❌ **AUTHORIZATION_DECLINED** = Autorizace zamítnuta (failed)
- ❌ **REFUNDED** = Vráceno (failed)
- ⏳ **CREATED** = Platba vytvořena (pending)
- ⏳ **PAYMENT_METHOD_CHOSEN** = Uživatel vybral metodu platby (pending)
- ⏳ **AUTHORIZED** = Autorizováno (pending)
- ⏳ **PARTIALLY_REFUNDED** = Částečně vráceno (pending)

### 2. **Nová tabulka** `user_hosting_services`
Obsahuje aktivní hosting služby uživatelů.

**Vytvoří se AUTOMATICKY** když je platba zaplacená!

### 3. **SQL Trigger**
Když se objednávka změní na `status = 'active'` a `payment_status = 'paid'`:
- ✅ Automaticky vytvoří záznam v `user_hosting_services`
- ✅ Nastaví `activated_at` = teď
- ✅ Nastaví `expires_at` = za 30 dní
- ✅ Status = `active`

## 🚀 Setup (3 kroky)

### Krok 1: Spusť SQL migraci

V Supabase Dashboard → SQL Editor:

```sql
-- Zkopíruj a spusť celý soubor:
sql/add-hosting-services.sql
```

Toto vytvoří:
- ✅ Tabulku `user_hosting_services`
- ✅ RLS policies (uživatelé vidí jen své služby, admini všechny)
- ✅ Trigger `trigger_create_hosting_service`
- ✅ Funkci `create_hosting_service_on_payment()`
- ✅ Funkci `get_user_active_services()`

### Krok 2: Test že to funguje

```sql
-- Zkontroluj že tabulka existuje
SELECT * FROM user_hosting_services;

-- Mělo by vrátit prázdnou tabulku nebo služby
```

### Krok 3: Restartuj aplikaci

```bash
npm start
```

## 📊 Jak to funguje - FLOW

```
1. User vytvoří objednávku v Configuratoru
   ↓
2. Vytvoří se záznam v user_orders (status=pending)
   ↓
3. Vytvoří se platba v GoPay
   ↓
4. User zaplatí kartou na GoPay bráně
   ↓
5. GoPay vrátí usera na /payment/success?payment_id=XXX
   ↓
6. PaymentSuccess stránka kontroluje status každých 5s
   ↓
7. Když je status = PAID:
   - checkPaymentStatus() aktualizuje user_orders:
     * gopay_status = 'PAID'
     * payment_status = 'paid'
     * status = 'active'
   ↓
8. 🔥 TRIGGER se spustí automaticky!
   ↓
9. Vytvoří se záznam v user_hosting_services:
   * status = 'active'
   * activated_at = NOW()
   * expires_at = NOW() + 30 days
   * Zkopíruje plan_name, price, atd.
   ↓
10. User má aktivní hosting! ✅
```

## 🎯 Dashboard zobrazí aktivní hostingy

Dashboard teď může zobrazovat:

```typescript
import { getUserHostingServices } from '../lib/supabase';

const services = await getUserHostingServices();
// Vrátí jen aktivní a pending služby
```

## 🧪 Testování

### 1. Vytvoř testovací objednávku

```
http://localhost:3000/configurator
```

### 2. Zadej testovací kartu

```
4111111111111111 / 12/28 / 123
```

### 3. Zkontroluj databázi

Po zaplacení spusť v Supabase SQL:

```sql
-- Objednávka by měla být active
SELECT id, status, payment_status, gopay_status
FROM user_orders
ORDER BY created_at DESC
LIMIT 1;

-- Měla by existovat hosting služba!
SELECT * FROM user_hosting_services
ORDER BY created_at DESC
LIMIT 1;
```

### 4. Co bys měl vidět:

#### user_orders:
```
id: 14
status: active
payment_status: paid
gopay_status: PAID
```

#### user_hosting_services:
```
id: 1
user_id: [tvoje UUID]
order_id: 14
plan_name: "Hosting Basic"
status: active
activated_at: 2025-11-10 13:30:00
expires_at: 2025-12-10 13:30:00
```

## 📊 Přehled stavů platby

### GoPay vrací tyto stavy:

| Status | Význam | Co dělat |
|--------|---------|----------|
| `CREATED` | Platba vytvořena | ⏳ Čekat |
| `PAYMENT_METHOD_CHOSEN` | Vybral platební metodu | ⏳ Čekat |
| `PAID` | Zaplaceno | ✅ Vytvořit službu |
| `AUTHORIZED` | Autorizováno | ⏳ Čekat |
| `CANCELED` | Zrušeno | ❌ Neúspěch |
| `TIMEOUTED` | Vypršel čas | ❌ Neúspěch |
| `REFUNDED` | Vráceno | ❌ Zrušit službu |
| `PARTIALLY_REFUNDED` | Částečně vráceno | ⚠️ Řešit manuálně |

## 🔍 Debugging

### Problém: Služba se nevytvoří

```sql
-- Zkontroluj jestli trigger existuje
SELECT * FROM pg_trigger
WHERE tgname = 'trigger_create_hosting_service';

-- Zkontroluj jestli funkce existuje
SELECT * FROM pg_proc
WHERE proname = 'create_hosting_service_on_payment';

-- Zkontroluj logy
SELECT * FROM user_orders WHERE id = [order_id];
```

### Problém: Status je PAID ale služba neexistuje

1. Zkontroluj že máš spuštěnou SQL migraci
2. Trigger se spouští jen při UPDATE (ne INSERT)
3. Status musí přejít z 'pending' na 'active'
4. Payment_status musí být 'paid'

### Manuální vytvoření služby

Pokud trigger selže, můžeš vytvořit službu manuálně:

```sql
INSERT INTO user_hosting_services (
  user_id,
  order_id,
  plan_name,
  plan_id,
  status,
  price,
  billing_period,
  activated_at,
  expires_at
) VALUES (
  '[user_uuid]',
  [order_id],
  'Hosting Basic',
  'basic',
  'active',
  25.00,
  'monthly',
  NOW(),
  NOW() + INTERVAL '30 days'
);
```

## 🎨 Další možnosti

### Automatické prodloužení

Můžeš přidat cron job který kontroluje `expires_at` a pošle upozornění.

### Automatická deaktivace

Můžeš přidat cron který nastaví `status = 'expired'` když `expires_at < NOW()`.

### FTP/DB přístupy

Po vytvoření služby můžeš:
1. Automaticky vytvořit FTP účet
2. Vytvořit databázi
3. Odeslat email s přístupovými údaji

## ✅ Shrnutí

- ✅ Všechny GoPay stavy jsou rozpoznané
- ✅ Hosting se přiřadí AŽ po zaplacení
- ✅ Automatický trigger v databázi
- ✅ Dashboard může zobrazit aktivní služby
- ✅ Admini můžou spravovat služby

**Hosting se přiřadí automaticky 🎉**

---

**Vytvořeno:** 2025-11-10
**Status:** ✅ Ready to use
**Next:** Spusť SQL migraci a testuj! 🚀
