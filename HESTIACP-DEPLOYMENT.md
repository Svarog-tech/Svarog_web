# 🚀 HestiaCP Deployment Guide

## Příprava

### 1. Nahraj soubory na server
```bash
# SSH do serveru
ssh epgmooky@your-server-ip

# Naviguj do web directory
cd /home/epgmooky/web/your-domain.com/public_html

# Clone nebo nahraj repository
git clone https://github.com/your-username/your-repo.git .
# NEBO nahraj přes FTP/SFTP
```

### 2. Nainstaluj Node.js (pokud není)
```bash
# Přidej NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Nainstaluj Node.js
sudo apt-get install -y nodejs

# Ověř instalaci
node --version
npm --version
```

### 3. Nainstaluj dependencies
```bash
cd /home/epgmooky/web/your-domain.com/public_html
npm install
```

### 4. Uprav .env pro produkci
```bash
nano .env
```

Nastav tyto hodnoty:
```env
# Frontend doména
REACT_APP_API_URL=https://your-domain.com

# Backend povolené origins
SERVER_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Port (používej vysoký port, ne 80/443)
PORT=3001

# GoPay PRODUCTION credentials
REACT_APP_GOPAY_ENVIRONMENT=PRODUCTION
REACT_APP_GOPAY_GO_ID=your-production-go-id
REACT_APP_GOPAY_CLIENT_ID=your-production-client-id
REACT_APP_GOPAY_CLIENT_SECRET=your-production-client-secret
```

### 5. Build frontend
```bash
npm run build
```

---

## Nastavení Node.js backend s PM2

### 1. Nainstaluj PM2
```bash
sudo npm install -g pm2
```

### 2. Spusť backend
```bash
cd /home/epgmooky/web/your-domain.com/public_html
pm2 start server.js --name "gopay-backend"

# Nastav PM2 aby se spustil po restartu serveru
pm2 startup
pm2 save
```

### 3. Zkontroluj status
```bash
pm2 status
pm2 logs gopay-backend
```

---

## Konfigurace Nginx (HestiaCP)

### Možnost 1: Přes HestiaCP Web UI

1. Přihlaš se do HestiaCP (https://your-server-ip:8083)
2. Jdi na **WEB** → tvá doména → **Edit Web Domain**
3. Najdi sekci **Proxy Template** nebo **Additional Nginx directives**

### Možnost 2: Ručně editovat Nginx config

```bash
# Edituj Nginx config pro tvou doménu
sudo nano /etc/nginx/conf.d/domains/your-domain.com.conf
```

Přidej tyto location bloky do `server` sekce:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Root pro React build
    root /home/epgmooky/web/your-domain.com/public_html/build;
    index index.html;

    # Hlavní React SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. Test a reload Nginx
```bash
# Test konfigurace
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## SSL/HTTPS (POVINNÉ pro GoPay!)

### Přes HestiaCP Let's Encrypt:

1. HestiaCP panel → **WEB** → tvá doména
2. Klikni na **SSL Support**
3. Vyber **Let's Encrypt**
4. Klikni **Save**

NEBO příkazová řádka:
```bash
sudo v-add-letsencrypt-domain epgmooky your-domain.com www.your-domain.com
```

---

## Firewall nastavení

### HestiaCP má vestavěný firewall - zkontroluj:

```bash
# Zkontroluj firewall status
sudo v-list-firewall

# Ujisti se že jsou otevřené tyto porty:
# - 80 (HTTP)
# - 443 (HTTPS)
# - 22 (SSH)
# - 8083 (HestiaCP)

# Port 3001 (Node.js backend) NEMUSÍ být otevřený externě
# Nginx bude proxovat requesty interně
```

**DŮLEŽITÉ:** Port 3001 (nebo jiný port na kterém běží Node.js) by **NEMĚL** být otevřený navenek! Veškerá komunikace by měla jít přes Nginx reverse proxy.

---

## IP Whitelist (POKUD CHCEŠ EXTRA ZABEZPEČENÍ)

Pokud chceš omezit přístup k admin API jen z určitých IP:

### V Nginx config:
```nginx
# Příklad: Omezit /api/admin/* jen na tvou IP
location /api/admin {
    allow 123.45.67.89;  # Tvoje IP
    deny all;

    proxy_pass http://localhost:3001;
    # ... zbytek proxy nastavení
}
```

### V server.js můžeš přidat IP whitelist:
```javascript
// Middleware pro IP whitelist (pokud chceš)
const allowedIPs = ['123.45.67.89', '::1', '127.0.0.1'];

app.use((req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;

  // Pokud je to admin endpoint, zkontroluj IP
  if (req.path.startsWith('/api/admin')) {
    if (!allowedIPs.includes(clientIP)) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  next();
});
```

---

## Ověření že vše funguje

### 1. Zkontroluj backend:
```bash
curl http://localhost:3001/health
```

### 2. Zkontroluj frontend:
```bash
curl https://your-domain.com
```

### 3. Zkontroluj API přes Nginx:
```bash
curl https://your-domain.com/health
```

### 4. Zkontroluj PM2:
```bash
pm2 status
pm2 logs gopay-backend --lines 100
```

---

## Troubleshooting

### Backend nefunguje:
```bash
# Zkontroluj PM2 logy
pm2 logs gopay-backend

# Restartuj backend
pm2 restart gopay-backend

# Zkontroluj jestli běží na správném portu
netstat -tlnp | grep 3001
```

### Frontend nefunguje:
```bash
# Zkontroluj Nginx logy
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Zkontroluj že build soubory existují
ls -la /home/epgmooky/web/your-domain.com/public_html/build
```

### CORS chyby:
```bash
# Zkontroluj .env
cat .env | grep ORIGINS

# Ujisti se že SERVER_ALLOWED_ORIGINS obsahuje tvou doménu
# Restartuj backend po změně .env
pm2 restart gopay-backend
```

---

## Bezpečnostní Checklist

✅ HTTPS je povinné (Let's Encrypt)
✅ CORS je nastavený v server.js
✅ Backend port (3001) není otevřený externě
✅ Veškerý traffic jde přes Nginx reverse proxy
✅ GoPay používá PRODUCTION credentials
✅ .env obsahuje produkční hodnoty
✅ PM2 automaticky restartuje backend při pádu
✅ Firewall propustí jen porty 80, 443, 22, 8083

---

## Poznámky k API bezpečnosti

**Nemusíš whitelistovat IP adresu Claude nebo kohokoliv jiného!**

Zabezpečení funguje takto:
1. **CORS** - Prohlížeč pouští jen requesty z domén v `SERVER_ALLOWED_ORIGINS`
2. **Reverse Proxy** - Nginx filtruje veškerý traffic
3. **Internal Port** - Node.js běží jen na localhost:3001, není dostupný zvenčí

**API je bezpečné bez IP whitelistu**, protože:
- CORS blokuje browser-based útoky
- Backend není přímo vystavený internetu
- Jen tvá doména může volat API

IP whitelist by byl užitečný jen pokud máš **admin endpoints** nebo **webhook callbacks**, které nechceš aby volal kdokoliv.
