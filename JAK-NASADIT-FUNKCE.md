# 🚀 JAK NASADIT EDGE FUNCTIONS - RYCHLÝ NÁVOD

## ❗ DŮLEŽITÉ
Edge Functions jsou **POUZE V LOKÁLNÍCH SOUBORECH**. Aby fungovaly, musíš je **nasadit na Supabase server**!

## 📋 Co musíš udělat (2 minuty)

### Varianta A: Automaticky (doporučeno)

**Spusť prostě tento soubor:**
```
DEPLOY-VSETKO.bat
```

Otevře se prohlížeč pro přihlášení k Supabase. Potvrď přihlášení a hotovo! ✨

---

### Varianta B: Krok po kroku (pokud A nefunguje)

Spusť tyto soubory **v tomto pořadí**:

```
1. 1-login-supabase.bat      → Přihlásí tě do Supabase
2. 2-link-project.bat        → Propojí s projektem
3. 3-set-secrets.bat         → Nastaví GoPay credentials
4. 4-deploy-functions.bat    → Nasadí Edge Functions
```

---

## ✅ Po dokončení

1. **Restartuj aplikaci:**
   ```bash
   # Zastav (Ctrl+C)
   npm start
   ```

2. **Otevři Configurator:**
   ```
   http://localhost:3000/configurator
   ```

3. **Vytvoř testovací objednávku**
   - Vyber plán
   - Vyplň údaje
   - Klikni "Objednat"
   - Mělo by tě přesměrovat na GoPay platební bránu! 💳

---

## 🧪 Testovací platební karta

Pro testování platby použij:
```
Číslo: 4111111111111111
Expirace: 12/28
CVV: 123
```

---

## 🐛 Troubleshooting

### "supabase: command not found"
✅ **Je v pořádku!** Používáme `npx supabase`, které funguje automaticky.

### "Cannot use automatic login flow"
Řešení:
1. Otevři: https://supabase.com/dashboard/account/tokens
2. Vytvoř nový Access Token
3. Spusť v příkazové řádce:
   ```
   set SUPABASE_ACCESS_TOKEN=your_token_here
   ```
4. Zkus znovu spustit deployment

### "Project not linked"
Spusť: `2-link-project.bat`

### CORS error stále přetrvává
- Ujisti se, že jsi spustil `4-deploy-functions.bat`
- Edge Functions musí být **nasazené na serveru**, ne jen lokálně
- Zkontroluj v Supabase Dashboard → Edge Functions, jestli vidíš 3 funkce

### Platba se nevytváří
1. Otevři browser console (F12)
2. Zkopíruj celou error message
3. Zkontroluj Edge Function logs:
   ```
   npx supabase functions logs create-gopay-payment --tail
   ```

---

## 🎯 Co nasazujeme

Tyto 3 Edge Functions (s CORS headers):

1. **create-gopay-payment**
   - Vytvoří platbu v GoPay
   - Vrátí payment URL pro redirect

2. **check-gopay-payment**
   - Zkontroluje status platby
   - Používá PaymentSuccess stránka

3. **gopay-webhook**
   - Přijímá notifikace z GoPay
   - Automaticky aktualizuje status objednávky

---

## 📞 Potřebuješ pomoc?

Pokud deployment nefunguje:
1. Zkontroluj, jestli jsi přihlášen do Supabase Dashboard
2. Zkontroluj konzoli prohlížeče (F12)
3. Zkontroluj Edge Function logs v Supabase Dashboard
4. Napiš mi přesnou error message

---

**Po nasazení funkcí by CORS error měl zmizet a platby by měly fungovat!** 🎉
