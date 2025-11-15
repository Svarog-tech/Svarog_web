# 🚀 Deployment Guide - HostingVemice

## Před nasazením

### 1. Příprava .env souboru pro produkci

Uprav `.env` soubor a nastav produkční hodnoty:

```env
# API Configuration
REACT_APP_API_URL=https://your-backend-domain.com

# Server Configuration
SERVER_ALLOWED_ORIGINS=https://your-frontend-domain.com

# GoPay Configuration
REACT_APP_GOPAY_ENVIRONMENT=PRODUCTION
```

**Důležité:**
- `REACT_APP_API_URL` - URL kde poběží tvůj backend server (Node.js server.js)
- `SERVER_ALLOWED_ORIGINS` - URL kde poběží tvůj frontend (React aplikace)
- Pro GoPay produkční prostředí změň na `PRODUCTION` a použij produkční credentials

---

## Deployment Options

### Option 1: Vercel (Frontend) + Railway/Render (Backend)

#### Frontend (Vercel)
1. Pushni kód na GitHub
2. Jdi na [vercel.com](https://vercel.com) a import projekt
3. Nastav Environment Variables:
   ```
   REACT_APP_SUPABASE_URL=...
   REACT_APP_SUPABASE_ANON_KEY=...
   REACT_APP_API_URL=https://your-backend-url.railway.app
   REACT_APP_GOPAY_GO_ID=...
   REACT_APP_GOPAY_CLIENT_ID=...
   REACT_APP_GOPAY_CLIENT_SECRET=...
   REACT_APP_GOPAY_ENVIRONMENT=PRODUCTION
   ```
4. Build command: `npm run build`
5. Output directory: `build`
6. Deploy!

#### Backend (Railway/Render)
1. Vytvoř nový projekt na [Railway.app](https://railway.app) nebo [Render.com](https://render.com)
2. Propoj s GitHub repository
3. Nastav Environment Variables:
   ```
   SERVER_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
   REACT_APP_GOPAY_GO_ID=...
   REACT_APP_GOPAY_CLIENT_ID=...
   REACT_APP_GOPAY_CLIENT_SECRET=...
   REACT_APP_GOPAY_ENVIRONMENT=PRODUCTION
   PORT=3001
   ```
4. Start command: `node server.js`
5. Deploy!

---

### Option 2: Netlify (Frontend) + Heroku (Backend)

#### Frontend (Netlify)
1. Jdi na [netlify.com](https://netlify.com)
2. "Add new site" → Import from Git
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `build`
4. Environment variables - přidej stejné jako pro Vercel (viz výše)
5. Deploy!

#### Backend (Heroku)
```bash
# Inicializuj Heroku
heroku create your-app-name

# Nastav environment variables
heroku config:set SERVER_ALLOWED_ORIGINS=https://your-netlify-app.netlify.app
heroku config:set REACT_APP_GOPAY_GO_ID=...
heroku config:set REACT_APP_GOPAY_CLIENT_ID=...
heroku config:set REACT_APP_GOPAY_CLIENT_SECRET=...
heroku config:set REACT_APP_GOPAY_ENVIRONMENT=PRODUCTION

# Deploy
git push heroku main
```

---

### Option 3: VPS (Linux Server)

#### 1. Nainstaluj dependencies
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Nginx
sudo apt-get install nginx

# PM2 (pro běh backend serveru)
sudo npm install -g pm2
```

#### 2. Nahraj kód na server
```bash
# Clone repository nebo nahraj přes FTP
git clone https://github.com/your-username/your-repo.git
cd your-repo
npm install
```

#### 3. Build frontend
```bash
npm run build
```

#### 4. Nastav Nginx pro frontend
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/your-repo/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 5. Spusť backend s PM2
```bash
pm2 start server.js --name "gopay-backend"
pm2 startup
pm2 save
```

---

## Kontrola po nasazení

### 1. Testuj CORS
```bash
curl -I https://your-backend-url.com/health
```

### 2. Testuj platební flow
- Vytvoř testovací objednávku
- Zkontroluj že redirect na GoPay funguje
- Ověř že callback URL funguje správně

### 3. Zkontroluj logy
- Frontend: Developer Console v prohlížeči
- Backend: Railway/Render logs nebo PM2 logs

---

## Časté problémy

### CORS Error
✅ **Fix:** Zkontroluj `SERVER_ALLOWED_ORIGINS` v .env backendu

### Cannot connect to backend
✅ **Fix:** Zkontroluj `REACT_APP_API_URL` v .env frontendu

### GoPay chyby
✅ **Fix:** Zkontroluj že používáš správné credentials pro PRODUCTION environment

---

## Poznámky

- **HTTPS je povinné** pro produkční prostředí (hlavně kvůli GoPay platbám)
- **Callback URL** pro GoPay musí být veřejně dostupná (ne localhost)
- Po změně .env **VŽDY restartuj** backend i frontend
