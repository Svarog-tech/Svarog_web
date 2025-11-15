# TODO - Úkoly k dokončení

## ✅ Hotovo

- [x] Přidat pole admin do databáze (profiles table)
- [x] Vytvořit admin panel pro správu objednávek
- [x] Přidat Admin badge v hlavičce
- [x] Připravit databázi pro GoPay platby
- [x] Vytvořit dokumentaci pro GoPay integraci

---

## Email systém pro objednávky (později)

- [ ] Registrovat se na Resend.com a získat API klíč
- [ ] Nasadit Edge Function `send-order-email` do Supabase
- [ ] Nastavit RESEND_API_KEY jako secret v Supabase
- [ ] Ověřit doménu alatyr.cz v Resend pro odesílání z orders@alatyr.cz
- [ ] Přidat DNS záznamy (SPF, DKIM) do DNS správy domény
- [ ] Otestovat odesílání emailů s reálnou objednávkou
- [ ] Zkontrolovat že emaily nejdou do spamu

**Návod:** Viz `EMAIL_SETUP.md`

---

## GoPay platební brána (později)

- [ ] Registrovat se na GoPay.com a získat přístupy (GoID, Client ID, Client Secret)
- [ ] Nainstalovat GoPay SDK: `npm install gopay-sdk-js`
- [ ] Vytvořit `src/services/paymentService.ts`
- [ ] Vytvořit Edge Function `create-gopay-payment`
- [ ] Vytvořit Edge Function `check-gopay-payment`
- [ ] Nasadit Edge Functions a nastavit secrets
- [ ] Integrovat platby do Configuratoru
- [ ] Vytvořit stránku pro návrat z platby
- [ ] Vytvořit webhook handler pro notifikace z GoPay
- [ ] Otestovat platby v SANDBOX módu
- [ ] Nasadit do produkce

**Návod:** Viz `GOPAY_SETUP.md`

---

## Další úkoly

- [ ] Přidat real-time notifikace pro nové objednávky (admin dashboard)
- [ ] Vytvořit detail objednávky v admin panelu
- [ ] Přidat možnost změny statusu objednávky
- [ ] Implementovat refund funkci
- [ ] Přidat statistiky do admin dashboardu (grafy, trendy)
- [ ] Přidat automatické zálohování databáze

---

## Potřebné SQL migrace

**Spusť v Supabase SQL Editor:**

```sql
-- Viz soubor: sql/add-admin-and-payment.sql
```

**Nastavení prvního admina:**

```sql
UPDATE public.profiles
SET is_admin = TRUE
WHERE email = 'tvuj-admin@email.cz';
```
