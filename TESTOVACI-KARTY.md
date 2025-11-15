# 💳 GoPay Testovací karty - Kompletní seznam

## 🎯 Různé scénáře testování

### ✅ ÚSPĚŠNÁ PLATBA (bez 3DS)
```
Číslo: 4111111111111111
Expirace: 12/28
CVV: 123
Chování: Automaticky zaplatí bez extra ověření
```

### 🔐 ÚSPĚŠNÁ PLATBA S 3DS OVĚŘENÍM
```
Číslo: 4000000000000101
Expirace: 12/28
CVV: 123
Chování: Vyžaduje 3DS ověření (zobrazí testovací menu)
```

### ❌ ZAMÍTNUTÁ PLATBA (nedostatek prostředků)
```
Číslo: 4000000000000002
Expirace: 12/28
CVV: 123
Chování: Automaticky zamítnuto
```

### ⏱️ TIMEOUT (platba vypršela)
```
Číslo: 4000000000000051
Expirace: 12/28
CVV: 123
Chování: Simuluje timeout
```

### 🔄 VYŽADUJE AUTORIZACI
```
Číslo: 4000000000000200
Expirace: 12/28
CVV: 123
Chování: Vyžaduje další autorizaci
```

### 💰 MASTERCARD - Úspěšná
```
Číslo: 5555555555554444
Expirace: 12/28
CVV: 123
Chování: Automaticky zaplatí
```

### 💳 VISA ELECTRON - Úspěšná
```
Číslo: 4917300800000000
Expirace: 12/28
CVV: 123
Chování: Automaticky zaplatí
```

### 🏦 MAESTRO - Úspěšná
```
Číslo: 6304000000000000
Expirace: 12/28
CVV: 123
Chování: Automaticky zaplatí
```

## 🎮 3DS Simulátor (Testovací menu)

### Co to je:
Testovací stránka na `https://partner.sandbox.gopay.com/gp-gateways/gpayment3ds/` kde můžeš ručně vybrat výsledek platby.

### Tlačítka v 3DS simulátoru:
- **"Platba plně ověřena - zaplatit"** → Status: PAID ✅
- **"Platba částečně ověřena - zaplatit"** → Status: PAID (s varováním)
- **"Platba neověřena - zrušit"** → Status: CANCELED ❌

### Proč se 3DS menu NEZOBRAZUJE:

#### 1. **GoPay si pamatuje cookies**
GoPay sandbox ukládá cookies a při dalších platbách automaticky platí bez 3DS.

**Řešení:**
```
1. Otevři DevTools (F12)
2. Application → Cookies
3. Vymaž všechny cookies z "sandbox.gopay.com"
4. Zkus znovu vytvořit platbu
```

#### 2. **Použij Incognito mode**
```
1. Otevři prohlížeč v Incognito/Private módu
2. Vytvoř novou objednávku
3. 3DS menu by se mělo zobrazit
```

#### 3. **Použij kartu která vyžaduje 3DS**
```
Použij: 4000000000000101
Tato karta VŽDY vyžaduje 3DS ověření
```

## 🔧 Jak vynutit zobrazení 3DS menu

### Metoda 1: Vyčistit session
```bash
1. F12 → Application → Storage → Clear site data
2. Zavři všechny GoPay taby
3. Zkus znovu
```

### Metoda 2: Jiný prohlížeč
```bash
1. Zkus Chrome → Zkus Firefox
2. Nebo použij Private/Incognito mode
```

### Metoda 3: Použij jinou kartu
```bash
Místo: 4111111111111111 (automatická)
Použij: 4000000000000101 (vyžaduje 3DS)
```

## 📊 Jak GoPay Sandbox funguje

### Automatický režim:
- Použiješ kartu `4111111111111111`
- GoPay **automaticky zaplatí**
- Žádné 3DS menu
- Status: PAID ✅

### 3DS režim:
- První platba: Zobrazí 3DS menu
- Můžeš vybrat výsledek (zaplatit/zrušit)
- Další platby: GoPay si pamatuje volbu
- Může automaticky aplikovat stejný výsledek

### Co ovlivňuje zobrazení 3DS:
1. **Cookies/Session** - GoPay si pamatuje
2. **Typ karty** - některé vyžadují 3DS vždy
3. **Náhodnost** - sandbox náhodně rozhoduje
4. **Historie** - pokud jsi už platil, může přeskočit

## 🎯 Doporučení pro testování

### Test 1: Úspěšná platba (automatická)
```
Karta: 4111111111111111
Očekávání: Rovnou PAID
```

### Test 2: 3DS ověření
```
Karta: 4000000000000101
Očekávání: 3DS menu → vyber "zaplatit"
```

### Test 3: Zamítnutá platba
```
Karta: 4000000000000002
Očekávání: Rovnou CANCELED
```

### Test 4: Timeout
```
Karta: 4000000000000051
Očekávání: TIMEOUTED
```

## 🔍 Pro produkci

V **produkčním prostředí**:
- 3DS se zobrazí automaticky pokud to vyžaduje banka
- Chování je konzistentní (ne náhodné jako v sandboxu)
- Uživatel musí projít skutečným 3DS ověřením své banky
- Žádné testovací menu

## ✅ Tvoje aplikace JE připravená!

PaymentSuccess stránka rozpoznává všechny stavy:
- ✅ PAID = Success (zelená)
- ⏳ PAYMENT_METHOD_CHOSEN = Pending (vybral kartu, čeká na 3DS)
- ⏳ AUTHORIZED = Pending (autorizováno, zpracovává se)
- ❌ CANCELED = Failed (červená)
- ❌ TIMEOUTED = Failed (červená)

**Aplikace správně zpracuje 3DS i bez něj!** 🎉

---

**TIP:** Pokud chceš vždy vidět 3DS menu v sandboxu, používej kartu `4000000000000101` v Incognito módu.
