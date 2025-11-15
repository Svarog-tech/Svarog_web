# 🚀 Finální návod na spuštění aplikace

## ✅ Co jsem udělal

1. **Aktualizoval .env** s novými Supabase credentials
2. **Aktualizoval kód** aby odpovídal tvému SQL schématu (`user_orders` místo `orders`)
3. **Opravil OAuth callback** s retry logikou

## 📝 Co musíš teď udělat

### Krok 1: Spusť SQL setup v Supabase

1. Otevři [Supabase Dashboard](https://supabase.com/dashboard)
2. Vyber projekt: `ccgxtldxeerwacyekzyk`
3. V levém menu: **SQL Editor**
4. Klikni **+ New query**
5. **Zkopíruj celý obsah** z `sql/setup.sql`
6. **Vlož do editoru** a klikni **Run** (Ctrl+Enter)

### Krok 2: Ověř tabulky

V **Table Editor** by měly být tyto tabulky:
- ✅ `profiles` - Uživatelské profily
- ✅ `user_orders` - Hosting objednávky
- ✅ `support_tickets` - Support tikety

### Krok 3: Nastav OAuth Google

#### V Supabase Dashboard:

1. **Authentication** → **URL Configuration**
   - Přidej do **Redirect URLs**: `http://localhost:3000/auth/callback`

2. **Authentication** → **Providers** → **Google**
   - Zapni **Enable Sign in with Google**
   - Zadej **Client ID** a **Client Secret** z Google Cloud Console

#### V Google Cloud Console:

1. Přejdi na [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** → **Credentials**
3. Klikni na OAuth 2.0 Client ID
4. Do **Authorized redirect URIs** přidej:
   ```
   https://ccgxtldxeerwacyekzyk.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback
   ```
5. Klikni **Save**

### Krok 4: Restartuj aplikaci

```bash
# Zastav aplikaci (Ctrl+C)
# Spusť znovu
npm start
```

### Krok 5: Testuj

1. **Zkus registraci emailem** - mělo by fungovat
2. **Zkus OAuth Google** - mělo by fungovat s retry logikou
3. **Zkontroluj dashboard** - měl by se zobrazit profil

## 🎯 Co očekávat

### Po úspěšné registraci/přihlášení:

1. **Automaticky se vytvoří profil** v tabulce `profiles`
2. **Přesměrování na `/auth/callback`** (pokud OAuth)
3. **Retry logika** - zkusí získat session až 5x
4. **Přesměrování na `/dashboard`**

### V dashboardu uvidíš:

- ✅ Tvoje jméno z profilu
- ✅ Statistiky (0 objednávek, 0 aktivních služeb)
- ✅ Karty pro rychlé akce

## 🐛 Troubleshooting

### "Auth session missing" stále přetrvává
- Zkontroluj OAuth redirect URLs v obou místech (Supabase + Google)
- Zkus registraci emailem místo OAuth
- Zkontroluj konzoli prohlížeče pro detailní error

### "function does not exist"
- Ujisti se, že jsi spustil celý `sql/setup.sql`
- Zkontroluj v **Database** → **Functions**, jestli existuje `get_user_profile`

### Tabulky se nevytvořily
- Zkontroluj **SQL Editor** výstup - může tam být error
- Zkus spustit SQL znovu
- Zkontroluj oprávnění

## 📚 Důležité soubory

- `sql/setup.sql` - Tvůj původní SQL setup (použij tento!)
- `.env` - Nové Supabase credentials (✅ už aktualizované)
- `src/lib/auth.ts` - Auth logika (✅ už aktualizované)
- `src/lib/supabase.ts` - Database funkce (✅ už aktualizované na `user_orders`)
- `src/pages/AuthCallback.tsx` - OAuth callback s retry logikou (✅ už opravené)

## ✨ Co se změnilo

### V kódu:
- ✅ Použití `user_orders` místo `orders`
- ✅ OAuth callback s 5 retry pokusy
- ✅ Lepší error handling
- ✅ Fallback na přímý přístup k tabulkám když RPC funkce nejsou dostupné

### Co zůstalo:
- ❌ **Neměnil jsem strukturu SQL** - používáš svůj původní `sql/setup.sql`
- ✅ Kód odpovídá tvému SQL schématu

## 🎉 Po dokončení

Když vše funguje:
1. Smaž testovací účty v Supabase (pokud chceš)
2. Pro produkci aktualizuj redirect URLs na tvou doménu
3. Nastav environment variables na serveru

Hodně štěstí! 🚀
