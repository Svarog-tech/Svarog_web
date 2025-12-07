# ✅ Bezpečnostní opravy - Souhrn

## 🔒 Opravené bezpečnostní problémy

### 1. ✅ Backend API autentizace (`server.js`)
**Před:** Všechny endpointy byly volně přístupné bez autentizace  
**Po:** 
- Přidán `authenticateUser` middleware pro JWT autentizaci
- Přidán `requireAdmin` middleware pro admin akce
- Všechny endpointy nyní vyžadují autentizaci:
  - `/api/gopay/create-payment` - vyžaduje autentizaci
  - `/api/gopay/check-payment` - vyžaduje autentizaci
  - `/api/hestiacp/create-account` - vyžaduje autentizaci
  - `/api/hestiacp/suspend-account` - vyžaduje admin práva
  - `/api/hestiacp/unsuspend-account` - vyžaduje admin práva
  - `/api/hestiacp/delete-account` - vyžaduje admin práva

### 2. ✅ Frontend autentizace (`paymentService.ts`, `hestiacpService.ts`)
**Před:** Frontend neposílal JWT tokeny v requestech  
**Po:** 
- Všechny API volání nyní posílají JWT token v `Authorization` headeru
- Token se získává z Supabase session
- Pokud není session, request se zamítne

### 3. ✅ Error handling (`server.js`)
**Před:** Chybové zprávy vyzrazovaly interní detaily  
**Po:** 
- V produkci se vracejí generické chybové zprávy
- Detaily se logují pouze na serveru
- Development mode stále zobrazuje detaily pro debugging

### 4. ✅ GoPay credentials (`3-set-secrets.bat`, `setup-gopay-secrets.bat`)
**Před:** Credentials byly hardcoded v batch souborech  
**Po:** 
- Batch soubory nyní čtou credentials z `.env` souboru
- Fallback hodnoty pouze pro development
- Přidány komentáře o bezpečnosti

### 5. ✅ HestiaCP credentials (`API-INFO.md`)
**Před:** API klíče byly v dokumentaci  
**Po:** 
- Odstraněny skutečné credentials
- Použity placeholder hodnoty
- Přidána varování o bezpečnosti

### 6. ✅ Hardcoded API klíče (`src/lib/auth.ts`)
**Před:** Supabase URL a anon key byly hardcoded jako fallback  
**Po:** 
- Odstraněny fallback hodnoty
- API klíče jsou nyní povinné z environment variables
- Přidána chybová zpráva pokud chybí

### 7. ✅ XSS ochrana (`src/components/TicketDetailModal.tsx`)
**Před:** `dangerouslySetInnerHTML` bez sanitizace  
**Po:** 
- Přidána HTML escape funkce
- URL validace pro obrázky
- Přidán komentář o DOMPurify pro produkci

### 8. ✅ Hesla v plain textu (`src/services/hestiacpService.ts`)
**Před:** Hesla byla ukládána do databáze  
**Po:** 
- Hesla se neukládají do databáze
- Pouze username a URL jsou uloženy
- Přidán komentář že heslo by mělo být posláno emailem

### 9. ✅ CORS bezpečnost (`server.js`)
**Před:** Requesty bez origin byly povolené vždy  
**Po:** 
- V produkci jsou requesty bez origin zamítnuty
- Development mode stále povoluje pro testování

---

## 📋 Jak používat novou autentizaci

### Frontend
Všechny API volání automaticky přidávají JWT token. Není potřeba nic měnit v komponentách.

### Backend
Server automaticky ověřuje JWT tokeny. Pro testování můžeš použít:

```bash
# Získej token z Supabase
curl -X POST 'https://your-project.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"email":"user@example.com","password":"password"}'

# Použij token v requestu
curl -X POST 'http://localhost:3001/api/gopay/create-payment' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderId":1,"amount":100,...}'
```

---

## ⚠️ Důležité poznámky

1. **Environment variables:** Ujisti se, že máš nastavené:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (pro backend, volitelné)

2. **Webhook endpointy:** GoPay webhook (`/api/gopay/webhook`) nevyžaduje autentizaci, protože má vlastní validaci podpisu.

3. **Admin práva:** Pro suspend/unsuspend/delete HestiaCP účtů musí mít uživatel `is_admin = TRUE` v databázi.

4. **Error handling:** V produkci nastav `NODE_ENV=production` pro generické chybové zprávy.

---

## 🔄 Co ještě potřebuje opravu (nízká priorita)

- [ ] Rate limiting na API endpointy
- [ ] DOMPurify pro lepší XSS ochranu
- [ ] Content Security Policy (CSP) headers
- [ ] Audit logging pro admin akce

---

**Status:** ✅ Všechny kritické bezpečnostní problémy byly opraveny!

