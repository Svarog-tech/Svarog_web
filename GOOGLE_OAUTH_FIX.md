# 🔧 Fix Google OAuth - redirect_uri_mismatch

## Problém
```
Přístup zablokován: požadavek aplikace Alatyr Hosting není platný
Chyba 400: redirect_uri_mismatch
```

Tento error znamená, že redirect URL v Google Cloud Console **NEODPOVÍDÁ** URL, kterou Supabase používá.

## ✅ Řešení - Krok za krokem

### 1. Zjisti si svou Supabase redirect URL

Tvá Supabase URL je: `https://ccgxtldxeerwacyekzyk.supabase.co`

Supabase používá tento formát pro OAuth callback:
```
https://ccgxtldxeerwacyekzyk.supabase.co/auth/v1/callback
```

### 2. Přidej redirect URL do Google Cloud Console

1. **Otevři** [Google Cloud Console](https://console.cloud.google.com/)

2. **Vyber** svůj projekt (nebo vytvoř nový)

3. **Navigace**:
   - V levém menu: **APIs & Services** → **Credentials**

4. **OAuth 2.0 Client ID**:
   - Najdi svůj OAuth 2.0 Client ID
   - Nebo vytvoř nový: **+ CREATE CREDENTIALS** → **OAuth client ID**
   - Type: **Web application**

5. **Authorized redirect URIs** - přidej tyto 2 URL:
   ```
   https://ccgxtldxeerwacyekzyk.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback
   ```

6. **SAVE** (důležité!)

7. **Zkopíruj si**:
   - Client ID
   - Client Secret

### 3. Nastav OAuth v Supabase

1. **Otevři** [Supabase Dashboard](https://supabase.com/dashboard)

2. **Vyber projekt**: `ccgxtldxeerwacyekzyk`

3. **Authentication** → **Providers**

4. **Google Provider**:
   - ✅ Enable **"Enable Sign in with Google"**
   - Zadej **Client ID** (z Google Cloud Console)
   - Zadej **Client Secret** (z Google Cloud Console)
   - Zkontroluj **Redirect URL**: mělo by tam být `https://ccgxtldxeerwacyekzyk.supabase.co/auth/v1/callback`
   - **SAVE**

5. **Authentication** → **URL Configuration**:
   - **Site URL**: `http://localhost:3000` (pro development)
   - **Redirect URLs** - přidej:
     ```
     http://localhost:3000/**
     http://localhost:3000/auth/callback
     https://ccgxtldxeerwacyekzyk.supabase.co/auth/v1/callback
     ```
   - **SAVE**

### 4. Ověř nastavení

#### V Supabase:
- [ ] Google Provider je zapnutý
- [ ] Client ID a Secret jsou vyplněné
- [ ] Redirect URLs obsahují localhost callback

#### V Google Cloud Console:
- [ ] Authorized redirect URIs obsahuje Supabase callback URL
- [ ] OAuth consent screen je nakonfigurovaný
- [ ] Status je: Testing nebo Published

### 5. Restartuj aplikaci

```bash
# Zastav aplikaci (Ctrl+C)
npm start
```

### 6. Testuj OAuth

1. Otevři: `http://localhost:3000/register`
2. Klikni: **"Pokračovat s Google"**
3. Mělo by fungovat! ✅

## 📋 Checklist - Co zkontrolovat

### Google Cloud Console:
```
✓ Projekt vytvořený
✓ APIs & Services → Credentials
✓ OAuth 2.0 Client ID existuje
✓ Authorized redirect URIs obsahuje:
  - https://ccgxtldxeerwacyekzyk.supabase.co/auth/v1/callback
  - http://localhost:3000/auth/callback
✓ OAuth consent screen nakonfigurován
```

### Supabase Dashboard:
```
✓ Authentication → Providers → Google
✓ Enable Sign in with Google ✅
✓ Client ID vyplněn
✓ Client Secret vyplněn
✓ Authentication → URL Configuration
✓ Redirect URLs obsahuje localhost/auth/callback
```

### V kódu (už hotovo):
```
✓ src/lib/auth.ts používá čistě Supabase Auth
✓ OAuth redirect: ${window.location.origin}/auth/callback
✓ PKCE flow enabled
✓ Session persistence zapnutá
```

## 🐛 Troubleshooting

### Stále "redirect_uri_mismatch"?

1. **Zkontroluj URL** - musí být PŘESNĚ stejná:
   - V Supabase: `https://ccgxtldxeerwacyekzyk.supabase.co/auth/v1/callback`
   - V Google Console: `https://ccgxtldxeerwacyekzyk.supabase.co/auth/v1/callback`
   - **POZOR**: žádné mezery, žádné extra znaky!

2. **Počkej 5-10 minut** - Google někdy trvá chvíli než propaguje změny

3. **Vyzkoušej v Incognito/Private okně** - vyčistí cache

4. **Zkontroluj konzoli** prohlížeče - může tam být více detailů

### "Access blocked: This app's request is invalid"

- OAuth consent screen není nakonfigurován
- Přidej test users v Google Console
- Nebo publikuj aplikaci

### Jiné chyby?

- Zkontroluj Supabase logs: **Project Settings** → **API**
- Zkontroluj browser console (F12)
- Zkontroluj že máš spuštěný `npm start`

## 🎉 Po úspěšném nastavení

Mělo by fungovat:
- ✅ Registrace emailem
- ✅ Přihlášení emailem
- ✅ OAuth Google
- ✅ OAuth GitHub (pokud nakonfigurovaný)
- ✅ Automatické vytvoření profilu v databázi

## Produkce

Pro produkci (když budeš deployovat):

1. **Změň redirect URLs** na svou doménu:
   ```
   https://vasedomena.cz/auth/callback
   ```

2. **Aktualizuj v obou místech**:
   - Google Cloud Console → Authorized redirect URIs
   - Supabase → URL Configuration
