@echo off
chcp 65001 >nul
echo ================================================
echo   HestiaCP Setup - Konfigurace připojení
echo ================================================
echo.

REM Zkontroluj jestli existuje .env soubor
if not exist .env (
    echo ❌ Soubor .env neexistuje!
    echo Vytvoř prosím .env soubor podle .env.example
    pause
    exit /b 1
)

echo Tento skript ti pomůže nastavit HestiaCP konfiguraci.
echo.
echo Budeme potřebovat následující údaje:
echo   1. URL nebo IP adresa HestiaCP serveru
echo   2. HestiaCP admin username
echo   3. ACCESS_KEY_ID (z v-add-access-key)
echo   4. SECRET_ACCESS_KEY (z v-add-access-key)
echo   5. Název balíčku (obvykle "default")
echo.
echo Pokud máš už údaje připravené, zadej je níže.
echo Pro rychlé nastavení použij: HESTIACP-SETUP-NOW.md
echo.

set /p HESTIA_URL="Zadej URL HestiaCP serveru (např. https://server1.hostingforge.eu:8083): "
set /p HESTIA_USER="Zadej HestiaCP admin username (default: epgmooky): "
if "%HESTIA_USER%"=="" set HESTIA_USER=epgmooky
set /p HESTIA_ACCESS_KEY="Zadej ACCESS_KEY_ID: "
set /p HESTIA_SECRET_KEY="Zadej SECRET_ACCESS_KEY: "
set /p HESTIA_PACKAGE="Zadej název balíčku (default: default): "
if "%HESTIA_PACKAGE%"=="" set HESTIA_PACKAGE=default

REM Extrahuj IP nebo hostname z URL pro HESTIACP_SERVER_IP
for /f "tokens=2 delims=://" %%a in ("%HESTIA_URL%") do set HESTIA_HOST=%%a
for /f "tokens=1 delims=:" %%a in ("%HESTIA_HOST%") do set HESTIA_IP=%%a

echo.
echo ================================================
echo   Kontroluji .env soubor...
echo ================================================

REM Zkontroluj jestli už existují HestiaCP proměnné
findstr /C:"HESTIACP_URL" .env >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  HestiaCP konfigurace už existuje v .env
    set /p OVERWRITE="Chceš přepsat existující konfiguraci? (a/n): "
    if /i not "%OVERWRITE%"=="a" (
        echo Zrušeno.
        pause
        exit /b 0
    )
    
    REM Odstraň staré HestiaCP řádky
    echo Odstraňuji starou konfiguraci...
    powershell -Command "(Get-Content .env) | Where-Object { $_ -notmatch '^HESTIACP_' } | Set-Content .env.tmp"
    move /y .env.tmp .env >nul
)

echo.
echo Přidávám HestiaCP konfiguraci do .env...
echo.

REM Přidej HestiaCP konfiguraci
(
    echo.
    echo # HestiaCP Configuration
    echo HESTIACP_URL=%HESTIA_URL%
    echo HESTIACP_USERNAME=%HESTIA_USER%
    echo HESTIACP_ACCESS_KEY=%HESTIA_ACCESS_KEY%
    echo HESTIACP_SECRET_KEY=%HESTIA_SECRET_KEY%
    echo HESTIACP_DEFAULT_PACKAGE=%HESTIA_PACKAGE%
    echo HESTIACP_SERVER_IP=%HESTIA_IP%
) >> .env

echo ✅ Konfigurace přidána do .env
echo.
echo ================================================
echo   Nastavení dokončeno!
echo ================================================
echo.
echo Další kroky:
echo   1. Restartuj backend server (node server.js)
echo   2. Zkontroluj že vidíš "HestiaCP Status: ✅ Configured"
echo   3. Otestuj připojení: curl http://localhost:3001/health
echo.
echo Pro více informací se podívej do HESTIACP-SETUP-GUIDE.md
echo.
pause

