# 🔌 HestiaCP REST API Integration

Tento projekt používá **HestiaCP REST API** pro automatické nasazení webu na server.

## Jak to funguje

### 1. **API Authentication**
```bash
curl -k -X POST "https://server:8083/api/" \
  -d "hash=ACCESS_KEY:SECRET_KEY" \
  -d "returncode=yes" \
  -d "cmd=v-list-users"
```

**Formát:**
- `hash` = `ACCESS_KEY_ID:SECRET_ACCESS_KEY` (z Discord zprávy)
- `returncode=yes` = vrátí error codes
- `cmd` = HestiaCP příkaz (např. `v-add-web-domain`)
- `arg1`, `arg2`, ... = argumenty příkazu

### 2. **Používané API příkazy**

#### `v-list-web-domain`
Zkontroluje jestli doména existuje
```bash
curl -k -X POST "${HESTIA_URL}/api/" \
  -d "hash=${ACCESS_KEY}:${SECRET_KEY}" \
  -d "returncode=yes" \
  -d "cmd=v-list-web-domain" \
  -d "arg1=epgmooky" \
  -d "arg2=domain.com"
```

#### `v-add-web-domain`
Vytvoří novou web doménu
```bash
curl -k -X POST "${HESTIA_URL}/api/" \
  -d "hash=${ACCESS_KEY}:${SECRET_KEY}" \
  -d "returncode=yes" \
  -d "cmd=v-add-web-domain" \
  -d "arg1=epgmooky" \         # user
  -d "arg2=domain.com" \        # domain
  -d "arg3=123.45.67.89" \      # ip (optional)
  -d "arg4=yes"                 # restart nginx
```

#### `v-delete-web-domain`
Smaže existující doménu
```bash
curl -k -X POST "${HESTIA_URL}/api/" \
  -d "hash=${ACCESS_KEY}:${SECRET_KEY}" \
  -d "returncode=yes" \
  -d "cmd=v-delete-web-domain" \
  -d "arg1=epgmooky" \
  -d "arg2=domain.com"
```

#### `v-rebuild-web-domain`
Rebuilds Nginx config (po změnách)
```bash
curl -k -X POST "${HESTIA_URL}/api/" \
  -d "hash=${ACCESS_KEY}:${SECRET_KEY}" \
  -d "returncode=yes" \
  -d "cmd=v-rebuild-web-domain" \
  -d "arg1=epgmooky" \
  -d "arg2=domain.com" \
  -d "arg3=yes"                 # restart nginx
```

#### `v-add-letsencrypt-domain`
Automaticky nastaví SSL (Let's Encrypt)
```bash
curl -k -X POST "${HESTIA_URL}/api/" \
  -d "hash=${ACCESS_KEY}:${SECRET_KEY}" \
  -d "returncode=yes" \
  -d "cmd=v-add-letsencrypt-domain" \
  -d "arg1=epgmooky" \
  -d "arg2=domain.com" \
  -d "arg3=www.domain.com"      # aliases (optional)
```

### 3. **Response Codes**

HestiaCP API vrací:
- `0` = Success
- `1-255` = Error codes
- JSON data = Pro list příkazy

**Error handling v našem skriptu:**
```bash
if [[ "$response" == "0" ]] || [[ "$response" == "" ]]; then
    echo "✅ Success"
else
    echo "❌ Error: ${response}"
fi
```

### 4. **Bezpečnost**

#### ✅ Co je zabezpečené:
- **Access Keys** místo admin hesla
- **HTTPS** (self-signed cert na :8083)
- **IP Whitelist** - musíš povolit svou IP v HestiaCP
- **Omezeče permissions** - access key může mít omezené příkazy

#### 🔒 Jak povolit svou IP:
```bash
# Na serveru přidej svou IP do firewallu
v-add-firewall-rule ACCEPT 123.45.67.89 8083 tcp "My local IP"
```

Nebo v HestiaCP Web UI:
1. **Server** → **Firewall**
2. Přidej pravidlo pro port 8083
3. IP address = tvoje IP

### 5. **Test API připojení**

```bash
chmod +x test-hestia-api.sh
./test-hestia-api.sh
```

Skript otestuje:
- ✅ Server je dostupný
- ✅ API autentizace funguje
- ✅ API příkazy odpovídají
- ✅ Doména existuje/neexistuje

### 6. **Deployment flow**

```
1. test-hestia-api.sh      → Ověří API připojení
   ↓
2. deploy-hestia.sh        → Spustí deployment
   ↓
   → v-list-web-domain     → Check jestli doména existuje
   → v-add-web-domain      → Vytvoří doménu
   → SSH upload files      → Nahraje build/ a server.js
   → SSH nginx config      → Vytvoří nginx.conf_override
   → v-rebuild-web-domain  → Rebuilds Nginx
   → v-add-letsencrypt     → Nastaví SSL
   → SSH pm2 start         → Spustí backend
   ↓
3. Hotovo! 🎉
```

### 7. **Troubleshooting**

#### API nedostupné
```bash
# Zkontroluj že port 8083 je otevřený
curl -k https://server-ip:8083

# Zkontroluj firewall
v-list-firewall
```

#### Authentication fails
```bash
# Zkontroluj access keys
cat .env.deploy | grep ACCESS

# Vygeneruj nové keys na serveru
v-add-access-key admin '*' mykey json
```

#### IP není whitelisted
```bash
# Na serveru
v-add-firewall-rule ACCEPT tvoje-ip 8083 tcp "API access"
sudo systemctl restart hestia
```

#### Příkaz selhal
```bash
# Zkontroluj že user má permissions
v-list-user-permissions epgmooky

# Zkontroluj API log
tail -f /var/log/hestia/api.log
```

---

## Odkazy

- [HestiaCP REST API Docs](https://hestiacp.com/docs/server-administration/rest-api)
- [HestiaCP API Reference](https://hestiacp.com/docs/reference/api)
- [API Examples (GitHub)](https://github.com/hestiacp/hestiacp-api-examples)

---

## Credentials

Tvoje HestiaCP API credentials (z Discord):
```env
HESTIA_USER=epgmooky
HESTIA_ACCESS_KEY_ID=o2z6TO8bZ7M89w1SrfUr
HESTIA_SECRET_ACCESS_KEY=x62zVT1n=tS6gqZXiDfjApFJd9ppdXLU_VW6lIp-
```

**DŮLEŽITÉ:** Tyto credentials jsou v `.env.deploy` který je v `.gitignore` - necommitnou se!
