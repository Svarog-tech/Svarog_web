# Nasazení na produkci

Na této větvi (**devpanel**) jsou sitemap, robots.txt a index.html nastaveny na **localhost** (vhodné pro vývoj a testování).

Pro nasazení na produkci použijte větev **deploydevpanel**, kde jsou:
- `public/sitemap.xml`, `public/robots.txt`, `index.html` s doménou **https://alatyrhosting.eu**
- script `npm run build:prod` a checklist v DEPLOYMENT.md

```bash
git checkout deploydevpanel
# pak dle checklistu na té větvi: .env, npm run build:prod, npm run start:prod
```

---

## Obecný checklist (větev deploydevpanel)

1. Zkopírovat `.env.example` na `.env` a vyplnit (JWT_SECRET, MySQL, HestiaCP, APP_URL).
2. **APP_URL** = produkční URL (např. https://alatyrhosting.eu).
3. Build: `npm run build:prod`  
   Spuštění: `npm run start:prod`
4. Health: `/health`, `/health/live`, `/health/ready`
