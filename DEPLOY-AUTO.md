# 🚀 Automatický Deployment přes HestiaCP API

Tento návod ti ukáže jak nasadit celý web automaticky jedním příkazem pomocí HestiaCP API.

## Příprava (jednorázově)

### 1. Ujisti se že máš SSH přístup na server

```bash
# Otestuj SSH připojení
ssh epgmooky@your-server-ip

# Pokud nemáš SSH klíč, vygeneruj ho:
ssh-keygen -t rsa -b 4096
ssh-copy-id epgmooky@your-server-ip
```

### 2. Vytvoř `.env.deploy` soubor

```bash
# Zkopíruj example
cp .env.deploy.example .env.deploy

# Edituj a vyplň správné hodnoty
nano .env.deploy
```

Vyplň tyto hodnoty:
```env
# Tvůj server
HESTIA_URL=https://123.45.67.89:8083
SERVER_IP=123.45.67.89

# API credentials (už máš)
HESTIA_USER=epgmooky
HESTIA_ACCESS_KEY_ID=o2z6TO8bZ7M89w1SrfUr
HESTIA_SECRET_ACCESS_KEY=x62zVT1n=tS6gqZXiDfjApFJd9ppdXLU_VW6lIp-

# Tvoje doména
DOMAIN=vemice-hosting.cz

# GoPay PRODUKČNÍ credentials
GOPAY_GO_ID=tvůj-production-go-id
GOPAY_CLIENT_ID=tvůj-production-client-id
GOPAY_CLIENT_SECRET=tvůj-production-client-secret
```

### 3. Dej skriptu práva na spuštění

```bash
chmod +x deploy-hestia.sh
```

---

## Nasazení (když máš hotové změny)

### Jednoduchý deployment:

```bash
./deploy-hestia.sh
```

To je vše! Skript automaticky:

1. ✅ Zkontroluje/vytvoří doménu v HestiaCP
2. ✅ Buildne React aplikaci
3. ✅ Nahraje všechny soubory na server
4. ✅ Nakonfiguruje Nginx (reverse proxy pro backend)
5. ✅ Nastaví SSL certifikát (Let's Encrypt)
6. ✅ Spustí Node.js backend s PM2
7. ✅ Updatne produkční .env na serveru

---

## Co skript dělá krok po kroku

### Krok 1: Check/Create Domain
```bash
# Přes HestiaCP API vytvoří web domain
v-add-web-domain
```

### Krok 2: Build & Upload
```bash
# Lokálně buildne React app
npm run build

# Zabalí vše do tar.gz
tar -czf deploy.tar.gz build/ server.js package.json .env

# Nahraje přes SCP
scp deploy.tar.gz epgmooky@server:/home/epgmooky/web/domain.com/

# Rozbalí na serveru
ssh epgmooky@server "cd /home/epgmooky/web/domain.com/public_html && tar -xzf ../deploy.tar.gz"
```

### Krok 3: Configure Nginx
```bash
# Vytvoří nginx.conf_override s:
# - React SPA routing (try_files)
# - Backend API proxy na localhost:3001
# - Static file caching
# - Health check endpoint

# Rebuilds Nginx config přes API
v-rebuild-web-domain
```

### Krok 4: SSL Setup
```bash
# Automaticky nastaví Let's Encrypt přes API
v-add-letsencrypt-domain domain.com www.domain.com
```

### Krok 5: Start Backend
```bash
# Přes SSH spustí PM2
pm2 start server.js --name "gopay-backend"
pm2 save
pm2 startup
```

### Krok 6: Update Production .env
```bash
# Updatne .env na serveru s produkčními hodnotami:
REACT_APP_API_URL=https://domain.com
SERVER_ALLOWED_ORIGINS=https://domain.com,https://www.domain.com
REACT_APP_GOPAY_ENVIRONMENT=PRODUCTION
```

---

## Verifikace po nasazení

### 1. Zkontroluj že web běží:
```bash
curl https://your-domain.com
```

### 2. Zkontroluj backend health:
```bash
curl https://your-domain.com/health
```

Měl bys dostat:
```json
{
  "status": "ok",
  "gopay_environment": "PRODUCTION",
  "gopay_go_id": "..."
}
```

### 3. Zkontroluj PM2 status:
```bash
ssh epgmooky@your-server "pm2 status"
```

### 4. Zkontroluj logy:
```bash
ssh epgmooky@your-server "pm2 logs gopay-backend --lines 50"
```

---

## Troubleshooting

### Deployment selhal na kroku X

**Check logs:**
```bash
# Skript vytiskne chyby přímo
# Nebo zkontroluj manuálně:
ssh epgmooky@your-server
cd /home/epgmooky/web/your-domain.com/public_html
pm2 logs gopay-backend
```

### Backend nefunguje po deployu

```bash
ssh epgmooky@your-server

# Zkontroluj PM2
pm2 status
pm2 logs gopay-backend

# Restartuj backend
pm2 restart gopay-backend

# Zkontroluj že .env je správně
cat /home/epgmooky/web/domain.com/public_html/.env
```

### Nginx chyby

```bash
ssh epgmooky@your-server

# Check nginx error log
sudo tail -f /var/log/nginx/error.log

# Test nginx config
sudo nginx -t

# Rebuild domain config
v-rebuild-web-domain epgmooky domain.com
```

### SSL nefunguje

```bash
# Zkontroluj certifikát
ssh epgmooky@your-server "v-list-letsencrypt-domain epgmooky domain.com"

# Znovu vytvoř certifikát
v-add-letsencrypt-domain epgmooky domain.com www.domain.com
```

### CORS chyby

```bash
# Zkontroluj že SERVER_ALLOWED_ORIGINS je správně nastavená
ssh epgmooky@your-server "cat /home/epgmooky/web/domain.com/public_html/.env | grep ORIGINS"

# Mělo by být:
# SERVER_ALLOWED_ORIGINS=https://domain.com,https://www.domain.com

# Restartuj backend
ssh epgmooky@your-server "pm2 restart gopay-backend"
```

---

## Update existujícího deploymentu

Když děláš změny v kódu a chceš aktualizovat produkci:

```bash
# Stejný příkaz - skript detekuje že už existuje deployment
./deploy-hestia.sh

# Skript se zeptá jestli chceš přepsat soubory
# Nebo můžeš použít force flag (až bude implementovaný)
```

---

## Ruční kontrola po deploymentu

### 1. Check file structure:
```bash
ssh epgmooky@your-server
cd /home/epgmooky/web/domain.com/public_html
ls -la

# Mělo by obsahovat:
# - build/           (React build)
# - server.js        (Backend)
# - package.json
# - .env
# - node_modules/
```

### 2. Check Nginx config:
```bash
cat /home/epgmooky/web/domain.com/nginx.conf_override

# Mělo by obsahovat location bloky pro /, /api, /health
```

### 3. Check permissions:
```bash
ls -la /home/epgmooky/web/domain.com/public_html/

# build/ by mělo mít 755
# .env by mělo mít 644
```

---

## Poznámky

- **První deployment může trvat 5-10 minut** (kvůli Let's Encrypt a instalaci dependencies)
- **Update deployment je rychlejší** (2-3 minuty)
- **SSL certifikát se automaticky obnovuje** každých 90 dní
- **PM2 automaticky restartuje backend** pokud spadne
- **.env.deploy obsahuje citlivé údaje** - nepřidávej ho do gitu!

---

## Bezpečnost

✅ `.env.deploy` je v `.gitignore` - necommitne se
✅ SSH používá klíče místo hesel
✅ HestiaCP API používá access keys s omezenými právy
✅ Backend běží jen na localhost (není dostupný přímo z internetu)
✅ CORS filtruje requesty jen z tvé domény
✅ HTTPS je povinné (automatický Let's Encrypt)

---

## Support

Pokud něco nefunguje:

1. **Zkontroluj `.env.deploy`** - jsou správně všechny hodnoty?
2. **Zkontroluj SSH přístup** - `ssh epgmooky@server` funguje?
3. **Zkontroluj HestiaCP API** - jsou správné credentials?
4. **Zkontroluj logy** - `pm2 logs gopay-backend`
5. **Zkontroluj Nginx** - `sudo nginx -t`

Často pomůže:
```bash
# Restartuj vše
ssh epgmooky@server
pm2 restart all
sudo systemctl restart nginx
```
