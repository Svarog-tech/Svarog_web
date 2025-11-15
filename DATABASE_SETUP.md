# 🗄️ Návod na nastavení Supabase databáze

## Problém
Aplikace ukazuje chybu "Auth session missing" nebo "Database error" při OAuth přihlášení, protože **databáze nemá vytvořené potřebné tabulky a funkce**.

## Řešení - Vytvoření databáze

### Krok 1: Otevřete Supabase SQL Editor

1. Přejděte na [Supabase Dashboard](https://supabase.com/dashboard)
2. Vyberte váš projekt: `psslabynkkvzslcyhzgy`
3. V levém menu klikněte na **SQL Editor**
4. Klikněte na **+ New query**

### Krok 2: Spusťte SQL migraci

1. Otevřete soubor `supabase-migration.sql` v tomto projektu
2. **Zkopírujte celý obsah souboru**
3. **Vložte ho do SQL Editoru** v Supabase
4. Klikněte na tlačítko **Run** (nebo stiskněte Ctrl+Enter)

### Krok 3: Ověřte, že se tabulky vytvořily

1. V levém menu klikněte na **Table Editor**
2. Měli byste vidět tyto tabulky:
   - ✅ `profiles` - Uživatelské profily
   - ✅ `orders` - Objednávky hostingu
   - ✅ `support_tickets` - Tikety podpory

### Krok 4: Ověřte funkce (RPC)

1. V levém menu klikněte na **Database** → **Functions**
2. Měli byste vidět tyto funkce:
   - ✅ `update_last_login` - Aktualizace posledního přihlášení
   - ✅ `get_user_profile` - Získání profilu uživatele
   - ✅ `update_user_profile` - Aktualizace profilu
   - ✅ `create_hosting_order` - Vytvoření objednávky
   - ✅ `get_user_orders` - Získání objednávek
   - ✅ `create_support_ticket` - Vytvoření tiketu

## Co databáze obsahuje

### Tabulky

1. **profiles** - Ukládá dodatečné informace o uživatelích
   - Jméno, příjmení, telefon, firma
   - Avatar, newsletter preference
   - Datum posledního přihlášení

2. **orders** - Ukládá objednávky hosting služeb
   - Informace o plánu a ceně
   - Stav objednávky a platby
   - Fakturační údaje
   - Doménové jméno

3. **support_tickets** - Ukládá požadavky na podporu
   - Předmět a zpráva
   - Priorita a kategorie
   - Stav tiketu

### Bezpečnost (Row Level Security)

Všechny tabulky mají zapnuté **Row Level Security (RLS)** policies:
- ✅ Uživatelé vidí pouze své vlastní data
- ✅ Nemohou přistupovat k datům jiných uživatelů
- ✅ Automatické vytvoření profilu při registraci

### Automatické triggery

1. **on_auth_user_created** - Automaticky vytvoří profil když se uživatel zaregistruje
2. **update_*_updated_at** - Automaticky aktualizuje timestamp při změně záznamu

## Testování

Po spuštění migrace:

1. **Restartujte aplikaci**: `npm start`
2. **Zkuste se zaregistrovat emailem**:
   - Mělo by fungovat bez chyb
   - Profil se automaticky vytvoří
3. **Zkuste OAuth Google**:
   - Nyní by mělo fungovat správně
   - Po přihlášení vás přesměruje na dashboard

## Časté problémy

### "permission denied for table profiles"
- **Řešení**: Ujistěte se, že jste spustili celý SQL script včetně GRANT permissions na konci

### "function does not exist"
- **Řešení**: Zkontrolujte v Database → Functions, jestli se funkce vytvořily

### OAuth stále nefunguje
1. Zkontrolujte, že máte správně nastavené **OAuth Redirect URLs** (viz `OAUTH_SETUP.md`)
2. Zkontrolujte, že je v Supabase zapnutý **Google Provider**
3. Restartujte aplikaci

## Dodatečné poznámky

- SQL script je **idempotentní** - můžete ho spustit vícekrát bez problémů (používá `IF NOT EXISTS`)
- Všechny funkce používají `SECURITY DEFINER` - bezpečně přistupují k datům s správnými oprávněními
- Triggery automaticky vyplní metadata z OAuth providera (jméno, avatar) do profilu

## Kontakt

Pokud máte problémy s nastavením databáze, zkontrolujte Supabase logs:
- **Database** → **Logs**
- Hledejte chyby během vytváření tabulek nebo funkcí
