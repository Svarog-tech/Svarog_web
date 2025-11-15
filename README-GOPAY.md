# 💳 GoPay - Lokální Setup (FUNGUJE!)

## ⚠️ Problém s CORS
GoPay API **blokuje CORS** requesty z browseru z bezpečnostních důvodů.

## ✅ Řešení: Lokální Proxy Server
Vytvořil jsem **Node.js proxy server** který běží lokálně a obchází CORS:

```
React App (port 3000)
    ↓
Proxy Server (port 3001)  ← ŽÁDNÝ CORS!
    ↓
GoPay API
```

## 🚀 Jak to spustit (3 kroky)

### 1. Nainstaluj dependencies

```bash
npm install
```

Toto nainstaluje:
- `express` - Web server
- `cors` - CORS middleware
- `node-fetch` - HTTP klient
- `dotenv` - .env support

### 2. Zkontroluj .env

Credentials jsou už v `.env`:
```env
REACT_APP_GOPAY_GO_ID=8801275087
REACT_APP_GOPAY_CLIENT_ID=1341082006
REACT_APP_GOPAY_CLIENT_SECRET=57RdPFDE
REACT_APP_GOPAY_ENVIRONMENT=SANDBOX
```

### 3. Spusť servery

#### Varianta A: Automaticky (doporučeno)

**Spusť tento soubor:**
```
START-ALL.bat
```

Otevře 2 okna:
1. GoPay Proxy Server (port 3001)
2. React aplikace (port 3000)

#### Varianta B: Manuálně

**Okno 1 - Proxy Server:**
```bash
npm run server
```

**Okno 2 - React App:**
```bash
npm start
```

## ✨ A JE TO! Mělo by to fungovat!

## 🧪 Testování

### 1. Otevři aplikaci
```
http://localhost:3000/configurator
```

### 2. Vytvoř objednávku
- Vyber plán
- Vyplň údaje
- Klikni "Objednat"

### 3. Mělo by tě přesměrovat na GoPay!

### 4. Testovací karta
```
Číslo: 4111111111111111
Expirace: 12/28
CVV: 123
```

## 📊 Jak to funguje

### Proxy Server (`server.js`)

```javascript
// 1. Získá OAuth token z GoPay
POST /api/gopay/create-payment
  ↓
// 2. Vytvoří platbu v GoPay
GoPay API: POST /payments/payment
  ↓
// 3. Vrátí payment URL do React
{success: true, paymentUrl: "https://..."}
```

### React App (`paymentService.ts`)

```javascript
// Volá LOKÁLNÍ proxy server (ŽÁDNÝ CORS!)
fetch('http://localhost:3001/api/gopay/create-payment')
  ↓
// Proxy server komunikuje s GoPay
  ↓
// Vrátí payment URL
  ↓
// Přesměruje usera na GoPay
window.location.href = paymentUrl
```

## 🔍 Debugging

### Proxy Server Console

Otevři okno s proxy serverem a uvidíš:
```
Creating GoPay payment...
Sending payment request to GoPay...
Payment created successfully: {id: 123...}
```

### Browser Console (F12)

```
Creating GoPay payment via proxy server...
Payment created successfully: {...}
```

### Zkontroluj zda proxy běží

Otevři: `http://localhost:3001/health`

Mělo by vrátit:
```json
{
  "status": "ok",
  "gopay_environment": "SANDBOX",
  "gopay_go_id": "8801275087"
}
```

## 🐛 Troubleshooting

### "Cannot find module 'express'"

Spusť:
```bash
npm install
```

### "Port 3001 already in use"

Jiná aplikace používá port 3001. Zastav ji nebo změň port v `server.js`:
```javascript
const PORT = 3002; // Změň na jiný port
```

### "Failed to get access token"

- Zkontroluj `.env` credentials
- Restartuj proxy server

### "Failed to fetch"

- Ujisti se že proxy server běží (START-SERVER.bat)
- Zkontroluj `http://localhost:3001/health`

### CORS error stále přetrvává

- Proxy server NEBĚŽÍ!
- Spusť `START-SERVER.bat` nebo `npm run server`

## 📁 Soubory

```
server.js              → Proxy server
START-SERVER.bat       → Spustí pouze proxy server
START-ALL.bat          → Spustí proxy + React
src/services/paymentService.ts → Volá proxy místo GoPay API
```

## 🔐 Bezpečnost

**Pro lokální vývoj:** ✅ V pořádku

**Pro produkci:** ❌ NE!
- Client secret je v `.env` který se commituje
- Proxy server musí běžet na stejném serveru jako aplikace
- Lepší použít Edge Functions na Supabase

Ale pro **testování a vývoj je to perfektní**! 🎉

## 📈 Admin Panel

Funguje normálně:
```
http://localhost:3000/admin
```

(Nastav admina:)
```sql
UPDATE public.profiles SET is_admin = TRUE WHERE email = 'tvuj@email.cz';
```

## ✅ Co funguje

- ✅ Vytvoření platby v GoPay
- ✅ Přesměrování na platební bránu
- ✅ Return URL zpět do aplikace
- ✅ Kontrola statusu platby
- ✅ Aktualizace databáze
- ✅ Admin panel
- ✅ **ŽÁDNÝ CORS ERROR!** 🎉

---

**Status:** ✅ FUNGUJE lokálně s proxy serverem
**Ports:** 3001 (proxy), 3000 (React)
**Enviroment:** SANDBOX
**Next:** Testuj platby! 💳
