# 🚀 FINÁLNÍ SETUP - Všechno, co musíš udělat

Předělal jsem celý auth systém na **čistě Supabase autentifikaci** - žádná custom logika, jen čistý Supabase Auth API.

## ✅ Co jsem udělal

### 1. Zjednodušil auth.ts
- ✅ Používá čistě Supabase Auth API
- ✅ Přidán PKCE flow pro lepší bezpečnost
- ✅ Zjednodušené error handling
- ✅ Automatické vytvoření profilu přes SQL trigger

### 2. Aktualizoval AuthCallback.tsx
- ✅ Jednoduší logika - spoléhá se na AuthContext
- ✅ Lepší error messages pro OAuth problémy
- ✅ Speciální handling pro redirect_uri_mismatch

### 3. Opravil kód
- ✅ Všechny importy aktualizované
- ✅ TypeScript errors opravené
- ✅ Kompatibilita se SQL schématem

## 📋 Co MUSÍŠ udělat TERAZ

### Krok 1: Spusť SQL setup v Supabase ⚠️ DŮLEŽITÉ

```sql
-- Otevři Supabase Dashboard → SQL Editor
-- Zkopíruj CELÝ obsah z sql/setup.sql
-- Spusť ho (Run / Ctrl+Enter)
```

**Ověř že se vytvořily tabulky:**
- ✅ `profiles`
- ✅ `user_orders`
- ✅ `support_tickets`

### Krok 2: Oprav Google OAuth redirect URI ⚠️ KRITICKÉ

Vidím že máš error: **"redirect_uri_mismatch"**

#### V Google Cloud Console:

1. Otevři [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** → **Credentials**
3. Najdi/vytvoř **OAuth 2.0 Client ID**
4. **Authorized redirect URIs** - přidej PŘESNĚ tyto URL:

```
https://ccgxtldxeerwacyekzyk.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
```

5. **SAVE**
6. Zkopíruj si **Client ID** a **Client Secret**

#### V Supabase Dashboard:

1. Otevři [Supabase Dashboard](https://supabase.com/dashboard)
2. Vyber projekt: `ccgxtldxeerwacyekzyk`
3. **Authentication** → **Providers** → **Google**:
   - ✅ Enable "Sign in with Google"
   - Zadej **Client ID** (z Google Console)
   - Zadej **Client Secret** (z Google Console)
   - **SAVE**

4. **Authentication** → **URL Configuration**:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs** přidej:
     ```
     http://localhost:3000/**
     http://localhost:3000/auth/callback
     ```
   - **SAVE**

### Krok 3: Restartuj aplikaci

```bash
# Zastav (Ctrl+C)
npm start
```

### Krok 4: Testuj

1. **Email registrace**:
   - Otevři: `http://localhost:3000/register`
   - Vyplň formulář
   - Mělo by fungovat ✅

2. **OAuth Google**:
   - Klikni "Pokračovat s Google"
   - Mělo by přesměrovat na Google
   - Po přihlášení přesměruje zpět
   - Mělo by fungovat ✅

## 📚 Důležité soubory

### Vytvořené návody:
- **`GOOGLE_OAUTH_FIX.md`** - Detailní návod jak opravit OAuth redirect error
- **`FINAL_SETUP.md`** - Tento soubor
- **`SETUP_INSTRUCTIONS.md`** - Kompletní setup instrukce

### Upravené soubory:
- ✅ `src/lib/auth.ts` - Nový, zjednodušený
- ✅ `src/pages/AuthCallback.tsx` - Jednodušší
- ✅ `src/contexts/AuthContext.tsx` - Aktualizované importy
- ✅ `.env` - Nové Supabase credentials

### SQL:
- ✅ `sql/setup.sql` - Tvůj existující SQL (použij tento!)

## 🎯 Co očekávat po správném nastavení

### Email registrace:
1. Vyplníš formulář → **Odešle se**
2. Supabase Auth vytvoří uživatele
3. SQL trigger automaticky vytvoří profil v `profiles` tabulce
4. Přesměruje na `/dashboard`

### OAuth Google:
1. Klikneš "Pokračovat s Google" → **Přesměruje na Google**
2. Vybereš účet a potvrdíš
3. Google přesměruje na: `https://ccgxtldxeerwacyekzyk.supabase.co/auth/v1/callback`
4. Supabase zpracuje OAuth a přesměruje na: `http://localhost:3000/auth/callback`
5. Aplikace detekuje session
6. SQL trigger vytvoří profil
7. Přesměruje na `/dashboard`

## 🐛 Troubleshooting

### "redirect_uri_mismatch" stále přetrvává

1. **Zkontroluj URL** - musí být PŘESNĚ:
   ```
   https://ccgxtldxeerwacyekzyk.supabase.co/auth/v1/callback
   ```
   - Žádné mezery
   - Žádné extra znaky
   - HTTPS (ne HTTP)
   - `/auth/v1/callback` (ne `/auth/callback`)

2. **Počkej 5-10 minut** - Google propaguje změny s zpožděním

3. **Zkus Incognito mode** - vyčistí cache

### "Auth session missing"

- SQL trigger se nespustil → profil se nevytvořil
- Zkontroluj že jsi spustil `sql/setup.sql`
- Zkontroluj v Table Editor jestli existuje tabulka `profiles`

### "Database error"

- Tabulky neexistují
- Spusť `sql/setup.sql` v Supabase SQL Editoru

### OAuth funguje ale profil se nevytváří

- Zkontroluj SQL trigger:
  ```sql
  -- V Supabase SQL Editor
  SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
  ```
- Pokud neexistuje, spusť znovu `sql/setup.sql`

## 📖 Detailní návody

Pokud máš problémy, podívej se na tyto soubory:

1. **OAuth problémy**: `GOOGLE_OAUTH_FIX.md`
2. **Database setup**: `DATABASE_SETUP.md` (pokud existuje)
3. **Kompletní setup**: `SETUP_INSTRUCTIONS.md`

## ✨ Co je nové

### Zjednodušený auth systém:
- ❌ Žádná custom auth logika
- ✅ Čistě Supabase Auth API
- ✅ PKCE flow pro lepší bezpečnost
- ✅ Automatická session persistence
- ✅ Jednodušší error handling

### Automatické vytvoření profilu:
- SQL trigger `handle_new_user()` se spustí po registraci
- Automaticky vytvoří záznam v `profiles` tabulce
- Vyplní data z OAuth providera (jméno, avatar)

## 🎉 Po úspěšném nastavení

Mělo by fungovat:
- ✅ Registrace emailem
- ✅ Přihlášení emailem
- ✅ OAuth Google
- ✅ OAuth GitHub (pokud nakonfigurovaný)
- ✅ Dashboard s profilem
- ✅ Všechny featury aplikace

Hodně štěstí! Pokud to nefunguje, napiš mi co přesně se děje a pošli screenshot error message. 🚀
