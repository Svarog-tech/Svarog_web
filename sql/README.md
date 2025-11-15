# Alatyr Hosting - Databázová instalace

Tento adresář obsahuje SQL skripty pro nastavení kompletního authentication systému pro Alatyr Hosting.

## Soubory

1. **setup.sql** - Hlavní schéma databáze (tabulky, policies, triggery)
2. **auth_functions.sql** - Funkce pro registraci, login a management uživatelů

## Jak nainstalovat

### 1. Připojení k Supabase

1. Přihlaste se do [Supabase Dashboard](https://app.supabase.com)
2. Otevřete váš projekt
3. Jděte na **SQL Editor**

### 2. Spuštění skriptů

**POŘADÍ JE DŮLEŽITÉ! Musíte spustit skripty v tomto pořadí:**

1. Nejdříve spusťte **setup.sql**
   - Zkopírujte celý obsah souboru `setup.sql`
   - Vložte do SQL Editoru
   - Klikněte na RUN

2. Poté spusťte **auth_functions.sql**
   - Zkopírujte celý obsah souboru `auth_functions.sql`
   - Vložte do SQL Editoru
   - Klikněte na RUN

### 3. Nastavení Authentication v Supabase

1. Jděte na **Authentication > Settings**
2. Povolte **Email confirmations** (doporučeno)
3. Nastavte **Site URL** na `http://localhost:3000` (pro development)
4. Pro production nastavte správnou URL

### 4. OAuth poskytovatelé

Pro Google a GitHub OAuth:

1. Jděte na **Authentication > Providers**
2. Povolte **Google** a **GitHub**
3. Vyplňte Client ID a Client Secret (získané z Google Cloud Console a GitHub)

**Google Setup:**
- [Google Cloud Console](https://console.cloud.google.com)
- Vytvořte OAuth 2.0 Client ID
- Authorized redirect URIs: `https://[your-project].supabase.co/auth/v1/callback`

**GitHub Setup:**
- [GitHub Developer Settings](https://github.com/settings/developers)
- Vytvořte OAuth App
- Authorization callback URL: `https://[your-project].supabase.co/auth/v1/callback`

### 5. Storage (volitelné - pro avatary)

1. Jděte na **Storage**
2. Vytvořte bucket s názvem `avatars`
3. Nastavte bucket jako public
4. Spusťte tyto policies (v SQL Editoru):

```sql
-- Povolit veřejný přístup k avatarům
CREATE POLICY "Avatar uploads are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Povolit upload avatarů
CREATE POLICY "Anyone can upload an avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars');

-- Povolit aktualizaci vlastního avatara
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (auth.uid()::text = (storage.foldername(name))[1]);
```

## Struktura databáze

### Tabulky

- **profiles** - Rozšířené user profily (propojené s auth.users)
- **user_orders** - Hosting objednávky uživatelů
- **support_tickets** - Support tikety

### Funkce

- **register_user()** - Registrace s emailem a heslem
- **complete_registration()** - Dokončení registrace s dodatečnými údaji
- **update_user_profile()** - Aktualizace profilu
- **create_hosting_order()** - Vytvoření objednávky
- **get_user_orders()** - Získání objednávek uživatele
- **create_support_ticket()** - Vytvoření support tiketu

### Security

- Všechny tabulky mají povolený Row Level Security (RLS)
- Uživatelé můžou přistupovat pouze ke svým datům
- Admins (s emailem @alatyr.cz) mají přístup ke všem objednávkám

## Testing

Po instalaci můžete otestovat registraci:

1. Spusťte React aplikaci (`npm start`)
2. Jděte na `/register`
3. Vyplňte formulář a registrujte se
4. Zkontrolujte váš email pro potvrzení
5. Zkontrolujte v Supabase Dashboard > Authentication > Users

## Troubleshooting

### Časté problémy

1. **ERROR: relation "profiles" already exists**
   - Tabulka už existuje, můžete ignorovat nebo smazat tabulku před spuštěním

2. **ERROR: function "handle_new_user" already exists**
   - Funkce už existuje, script použije OR REPLACE

3. **OAuth nefunguje**
   - Zkontrolujte nastavení OAuth providerů
   - Ověřte redirect URLs
   - Zkontrolujte environment variables

4. **RLS blokuje přístup**
   - Ujistěte se, že jste přihlášeni
   - Zkontrolujte policies v SQL

### Logy a debugging

- Supabase Dashboard > Logs > Authentication
- Browser Network tab pro API chyby
- Console log v aplikaci

## Produkční nasazení

Pro produkci:

1. Aktualizujte Site URL v Authentication Settings
2. Nastavte správné OAuth redirect URLs
3. Aktualizujte environment variables
4. Spusťte migrace znovu na produkční databázi
5. Otestujte všechny funkce

---

Máte-li jakékoli problémy s instalací, zkontrolujte dokumentaci nebo se obraťte na podporu.