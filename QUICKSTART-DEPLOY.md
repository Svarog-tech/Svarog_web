# ⚡ Quick Start - Nasazení na HestiaCP

## 🚀 3 kroky k produkci

### 1️⃣ Vytvoř `.env.deploy`

```bash
cp .env.deploy.example .env.deploy
nano .env.deploy
```

Vyplň:
```env
HESTIA_URL=https://123.45.67.89:8083
SERVER_IP=123.45.67.89
DOMAIN=tva-domena.cz

# Už máš tyto credentials:
HESTIA_USER=epgmooky
HESTIA_ACCESS_KEY_ID=o2z6TO8bZ7M89w1SrfUr
HESTIA_SECRET_ACCESS_KEY=x62zVT1n=tS6gqZXiDfjApFJd9ppdXLU_VW6lIp-

# GoPay PRODUCTION (ne sandbox!)
GOPAY_GO_ID=tvůj-production-go-id
GOPAY_CLIENT_ID=tvůj-production-client-id
GOPAY_CLIENT_SECRET=tvůj-production-secret
```

### 2️⃣ Nastav SSH klíč (jednorázově)

```bash
# Vygeneruj SSH klíč pokud nemáš
ssh-keygen -t rsa -b 4096

# Nahraj na server
ssh-copy-id epgmooky@tvůj-server-ip

# Test
ssh epgmooky@tvůj-server-ip
```

### 3️⃣ Deploy!

```bash
chmod +x deploy-hestia.sh
./deploy-hestia.sh
```

**That's it!** 🎉

---

## Co to udělá automaticky:

✅ Vytvoří doménu v HestiaCP
✅ Buildne React app
✅ Nahraje všechno na server
✅ Nakonfiguruje Nginx
✅ Nastaví SSL (Let's Encrypt)
✅ Spustí Node.js backend s PM2
✅ Updatne produkční .env

**Trvá:** 5-10 minut (první deploy) nebo 2-3 minuty (update)

---

## Ověření

### Frontend:
```bash
curl https://tva-domena.cz
```

### Backend health:
```bash
curl https://tva-domena.cz/health
```

Měl bys dostat:
```json
{"status":"ok","gopay_environment":"PRODUCTION","gopay_go_id":"..."}
```

### PM2 status:
```bash
ssh epgmooky@server "pm2 status"
```

---

## Update existujícího webu

Prostě znovu spusť:
```bash
./deploy-hestia.sh
```

Přepíše staré soubory novými.

---

## Troubleshooting

### Deployment fails?
```bash
# Zkontroluj .env.deploy
cat .env.deploy

# Zkontroluj SSH
ssh epgmooky@tvůj-server

# Zkontroluj logy na serveru
ssh epgmooky@server "pm2 logs gopay-backend"
```

### Backend nefunguje?
```bash
ssh epgmooky@server
pm2 restart gopay-backend
pm2 logs gopay-backend
```

### Nginx chyby?
```bash
ssh epgmooky@server
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

---

## Detailní dokumentace

- **DEPLOY-AUTO.md** - Kompletní deployment guide
- **HESTIACP-DEPLOYMENT.md** - Manuální HestiaCP setup
- **DEPLOYMENT.md** - Obecný deployment guide (Vercel, Netlify, atd.)

---

## Důležité!

🔒 **Bezpečnost:**
- `.env.deploy` obsahuje citlivé údaje - **NECOMMITUJ HO!**
- Už je v `.gitignore` takže by se neměl commitnout
- Pro PRODUCTION používej **PRODUKČNÍ GoPay credentials**, ne sandbox!

📝 **GoPay:**
- V sandboxu můžeš testovat s fake kartami
- V production potřebuješ **skutečné GoPay produkční credentials**
- Callback URL musí být **veřejně dostupná HTTPS URL**

🌐 **Doména:**
- Musí být namířená na tvůj server (A záznam)
- SSL se nastaví automaticky (Let's Encrypt)
- HTTPS je **POVINNÉ** pro GoPay platby

---

## Podpora

Něco nefunguje?

1. Přečti si `DEPLOY-AUTO.md` - tam je detailní troubleshooting
2. Zkontroluj logy: `ssh epgmooky@server "pm2 logs gopay-backend"`
3. Zkontroluj Nginx: `ssh epgmooky@server "sudo nginx -t"`
4. Restartuj vše: `ssh epgmooky@server "pm2 restart all && sudo systemctl restart nginx"`

**Často pomůže prostě restartovat backend:**
```bash
ssh epgmooky@server "pm2 restart gopay-backend"
```
