# 🔧 Oprava Admin Role - Instrukce

## Problém
Admin role (`is_admin = TRUE`) je v databázi, ale nezobrazuje se v UI (žádný žlutý admin badge, žádný link na administraci v menu).

## Řešení

### Krok 1: Spusť diagnostiku (volitelné)
Pokud chceš nejdříve vidět, co je v databázi:

1. Otevři Supabase Dashboard → SQL Editor
2. Otevři soubor: `sql/diagnose-admin-issue.sql`
3. Zkopíruj obsah a spusť v SQL Editoru
4. Prohlédni si výsledky - mělo by to ukázat aktuální stav

### Krok 2: Spusť komplexní opravu ✅

1. Otevři Supabase Dashboard → SQL Editor
2. Otevři soubor: **`sql/fix-admin-comprehensive.sql`**
3. Zkopíruj CELÝ obsah souboru
4. Vlož do SQL Editoru a klikni na "Run"
5. Měly by se zobrazit výsledky potvrzující, že:
   - ✅ Admin role je nastavena
   - ✅ RLS policies jsou vytvořeny
   - ✅ Permissions jsou nastaveny

### Krok 3: Odhlaš se a znovu se přihlaš

1. V aplikaci klikni na svůj profil → Odhlásit se
2. Přihlaš se znovu pomocí `adam.broz.cz@gmail.com`

### Krok 4: Zkontroluj konzoli prohlížeče

Po přihlášení otevři Developer Console (F12) a měl bys vidět:

```
🚀 Starting profile load for user: [tvoje-id]
🔍 Fetching profile for user: [tvoje-id]
✅ Profile successfully loaded from database
📥 Full profile data: { ... is_admin: true ... }
🔐 is_admin value: true
🔐 is_admin type: boolean
✅ Profile loaded successfully!
🔐 Is admin? true
```

### Krok 5: Zkontroluj UI

Po úspěšné opravě by se mělo zobrazit:

1. **V navigačním menu** - žlutý badge "ADMIN" vedle tvého jména
2. **V dropdown menu** - odkaz "⚙️ Administrace"
3. Admin panel by měl být přístupný na `/admin`

## Co dělat, když to nefunguje?

Pokud po těchto krocích stále vidíš v konzoli:
- `❌ Get profile error:` - problém s RLS policies
- `⚠️ Profile not found` - profil neexistuje v databázi
- `⚠️ Using fallback profile` - používá se záložní profil (bez admin práv)
- `🔐 Is admin? false` nebo `undefined` - admin pole se nenačítá správně

Pošli mi screenshot konzole prohlížeče a výsledky z SQL diagnostiky.

## Technické detaily opravy

SQL script `fix-admin-comprehensive.sql` provádí:

1. ✅ Dočasně vypne RLS pro úpravu struktury
2. ✅ Ujistí se, že sloupec `is_admin` existuje
3. ✅ Nastaví `is_admin = TRUE` pro tvůj email
4. ✅ Smaže všechny staré RLS policies (odstraní rekurzi)
5. ✅ Vytvoří nové jednoduché policies bez rekurze
6. ✅ Explicitně povolí čtení sloupce `is_admin`
7. ✅ Zapne RLS zpět
8. ✅ Ověří, že vše funguje

## Frontend změny

Upravil jsem také kód aplikace pro lepší debugging:
- `src/lib/auth.ts` - přidány detailní logy při načítání profilu
- `src/contexts/AuthContext.tsx` - přidány logy pro sledování stavu admin role

Po spuštění SQL scriptu a reloadnutí stránky by mělo vše fungovat! 🎉
