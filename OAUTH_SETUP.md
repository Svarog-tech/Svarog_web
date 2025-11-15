# OAuth Google Setup - Návod

## Problém
Při registraci přes Google OAuth dostáváte chybu "Problém s databází" nebo "Auth session missing".

## Řešení

### 1. Supabase Dashboard - Nastavení OAuth Redirect URL

1. Přejděte na [Supabase Dashboard](https://supabase.com/dashboard)
2. Vyberte váš projekt
3. V levém menu klikněte na **Authentication** → **URL Configuration**
4. Do pole **Redirect URLs** přidejte:
   ```
   http://localhost:3000/auth/callback
   ```

   Pro produkci přidejte také:
   ```
   https://vase-domena.cz/auth/callback
   ```

5. Klikněte na **Save**

### 2. Google Cloud Console - Nastavení OAuth

1. Přejděte na [Google Cloud Console](https://console.cloud.google.com/)
2. Vyberte váš projekt nebo vytvořte nový
3. V levém menu: **APIs & Services** → **Credentials**
4. Klikněte na váš OAuth 2.0 Client ID (nebo vytvořte nový)
5. Do sekce **Authorized redirect URIs** přidejte:
   ```
   https://[VÁŠ-SUPABASE-PROJECT-REF].supabase.co/auth/v1/callback
   ```

   Například:
   ```
   https://psslabynkkvzslcyhzgy.supabase.co/auth/v1/callback
   ```

6. Pro local development přidejte také:
   ```
   http://localhost:3000/auth/callback
   ```

7. Klikněte na **Save**

### 3. Supabase - Google OAuth Provider

1. V Supabase Dashboard: **Authentication** → **Providers**
2. Najděte **Google** v seznamu
3. Zapněte **Enable Sign in with Google**
4. Zadejte:
   - **Client ID** z Google Cloud Console
   - **Client Secret** z Google Cloud Console
5. Klikněte na **Save**

### 4. Test OAuth Flow

1. Restartujte aplikaci: `npm start`
2. Zkuste se zaregistrovat přes Google
3. Po úspěšném přihlášení by vás mělo přesměrovat na `/auth/callback` a pak na `/dashboard`

## Časté problémy

### "Auth session missing"
- **Příčina**: Redirect URL není správně nakonfigurovaná nebo session se nestihla vytvořit
- **Řešení**: Zkontrolujte, že máte správně nastavené redirect URLs v obou místech (Supabase + Google Cloud Console)

### "Database error"
- **Příčina**: Profily tabulka neexistuje nebo nemáte správná oprávnění
- **Řešení**: Spusťte SQL migraci pro vytvoření `profiles` tabulky v Supabase

### "Access denied"
- **Příčina**: Uživatel odmítl přístup k Google účtu
- **Řešení**: Zkuste to znovu a povolte přístup

## Poznámky

- Callback komponenta teď má retry logiku (5 pokusů po 1 sekundě)
- Pokud OAuth stále nefunguje, použijte registraci emailem
- Pro produkci nezapomeňte aktualizovat všechny URL z `localhost` na vaši produkční doménu
