# Nastavení odesílání emailů pro objednávky

## 1. Registrace na Resend.com

1. Jdi na https://resend.com
2. Klikni na **Sign Up** a vytvoř účet
3. Po registraci jdi na **API Keys**
4. Klikni na **Create API Key**
5. Zkopíruj si vygenerovaný klíč (začíná `re_...`)

## 2. Ověření domény (důležité!)

Pro odesílání emailů z vlastní domény (např. `orders@alatyr.cz`):

1. V Resend Dashboard jdi na **Domains**
2. Klikni na **Add Domain**
3. Zadej svou doménu (např. `alatyr.cz`)
4. Resend ti ukáže DNS záznamy, které musíš přidat:
   - **TXT záznam** (SPF) - pro ověření
   - **CNAME záznamy** (DKIM) - pro podpis emailů
   - **MX záznam** (volitelný) - pro příjem emailů

5. Přidej tyto záznamy do DNS správy své domény
6. Počkej pár minut až se DNS propaguje
7. V Resend klikni na **Verify**

**Poznámka:** Dokud není doména ověřena, můžeš používat pouze `onboarding@resend.dev` jako odesílatele (limit 100 emailů).

## 3. Nasazení Edge Function do Supabase

### Instalace Supabase CLI

```bash
# Windows (PowerShell)
scoop install supabase

# Mac/Linux
brew install supabase/tap/supabase

# Nebo NPM
npm install -g supabase
```

### Přihlášení a nasazení

```bash
# Přihlášení do Supabase
supabase login

# Link projektu
supabase link --project-ref ccgxtldxeerwacyekzyk

# Nasazení Edge Function
supabase functions deploy send-order-email --no-verify-jwt

# Nastavení RESEND API KEY jako secret
supabase secrets set RESEND_API_KEY=re_tvuj_api_klic_zde
```

## 4. Testování

Po nasazení Edge Function zkus vytvořit testovací objednávku:

1. Jdi na `/configurator`
2. Vyber plán a vyplň kontaktní údaje
3. Odešli objednávku
4. Zkontroluj email (i spam složku)

## 5. Alternativa - Ruční nasazení přes Dashboard

Pokud nechceš používat CLI:

1. Otevři **Supabase Dashboard**
2. Jdi na **Edge Functions**
3. Klikni na **Create a new function**
4. Pojmenuj ji `send-order-email`
5. Zkopíruj obsah souboru `supabase/functions/send-order-email/index.ts`
6. Klikni na **Deploy**
7. Jdi do **Project Settings** → **Edge Function Secrets**
8. Přidej secret: `RESEND_API_KEY` s hodnotou tvého API klíče

## 6. Úprava emailu v Edge Function

Po ověření domény uprav email "from" v souboru `supabase/functions/send-order-email/index.ts`:

```typescript
from: 'Alatyr Hosting <orders@alatyr.cz>',  // Změň na svou doménu
```

A znovu nasaď funkci:

```bash
supabase functions deploy send-order-email --no-verify-jwt
```

## Řešení problémů

### Email se neodešle

1. Zkontroluj konzoli v prohlížeči - měla by tam být chyba
2. Zkontroluj Supabase logs: Dashboard → Edge Functions → send-order-email → Logs
3. Ověř že máš správně nastavený RESEND_API_KEY
4. Zkontroluj že je doména ověřená v Resend

### Email jde do spamu

1. Ověř že máš správně nastavené DNS záznamy (SPF, DKIM)
2. Počkej 24-48 hodin než se DNS propaguje
3. Použij nástroj https://www.mail-tester.com pro testování

### Limit 100 emailů

Pokud používáš `onboarding@resend.dev`, máš limit 100 emailů. Musíš ověřit vlastní doménu pro neomezené odesílání (3000 emailů/měsíc zdarma).

## Cena

- **Resend Free tier**: 3,000 emailů/měsíc zdarma
- **Supabase Edge Functions**: zdarma (2 miliony invocations/měsíc)

Celkově je to **ZDARMA** pro malé až střední projekty! 🎉
