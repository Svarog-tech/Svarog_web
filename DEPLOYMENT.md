# Checklist nasazení na produkci

**Větev `deploydevpanel`** je připravena na produkci: sitemap, robots.txt a index.html (OG, JSON-LD) používají doménu **https://alatyrhosting.eu**.

---

## 1. Příprava prostředí

- Zkopírujte **`.env.example`** na **`.env`** a vyplňte hodnoty (JWT_SECRET, MySQL, HestiaCP, APP_URL, …).
- **APP_URL** nastavte na `https://alatyrhosting.eu` (nebo vaši produkční doménu).
- **NODE_ENV=production** (použije se při `npm run start:prod`).

---

## 2. SEO – Sitemap a robots.txt

Na větvi **deploydevpanel** jsou již nastaveny na produkci:

- **`public/sitemap.xml`** – všechny URL s `https://alatyrhosting.eu`.
- **`public/robots.txt`** – `Sitemap: https://alatyrhosting.eu/sitemap.xml`.
- **`index.html`** – og:url, og:image a JSON-LD s `https://alatyrhosting.eu`.

Pokud nasazujete na jinou doménu, nahraďte `alatyrhosting.eu` v těchto souborech.

---

## 3. Build a běh

- **Produkční build frontendu** (canonical a OG v Reactu budou používat správnou base URL):
  ```bash
  npm run build:prod
  ```
  Nebo s vlastní doménou:
  ```bash
  set VITE_APP_BASE_URL=https://vase-domena.cz
  npm run build
  ```

- **Spuštění serveru v produkci:**
  ```bash
  npm run start:prod
  ```
  Server očekává složku **`build`** (výstup z `vite build`). Port lze přenastavit přes **PORT** (výchozí 3001).

---

## 4. Health endpointy

- **GET /health** – plný stav (DB, konfigurace).
- **GET /health/live** – liveness (proces běží), vždy 200.
- **GET /health/ready** – readiness (DB dostupná), 200 nebo 503.

Pro Kubernetes/Docker: `livenessProbe: /health/live`, `readinessProbe: /health/ready`.

---

## 5. Bezpečnost

- Helmet a rate limiting (včetně hlaviček RateLimit-*) jsou zapnuté v `server.js`.
- V produkci nepoužívejte `NODE_ENV=development`.
- CSRF, JWT a cookie nastavení jsou připravené na produkci.

---

## 6. Volitelně (dle AUDIT_REPORT_V2.md)

- Redis caching, APM/Sentry, automatické zálohy DB, API versioning (`/api/v1/`), OpenAPI/Swagger.
