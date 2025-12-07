@echo off
chcp 65001 >nul
echo ================================================
echo   Rychlé nastavení HestiaCP - TVOJE ÚDAJE
echo ================================================
echo.

REM Zkontroluj jestli existuje .env soubor
if not exist .env (
    echo Vytvářím .env soubor...
    echo. > .env
)

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
echo Přidávám HestiaCP konfiguraci s tvými údaji...
echo.

REM Přidej HestiaCP konfiguraci
(
    echo.
    echo # HestiaCP Configuration
    echo # Admin User: epgmooky (System Administrator)
    echo # Email: epgmooky@gmail.com
    echo # Server: https://server1.hostingforge.eu:8083/
    echo HESTIACP_URL=https://server1.hostingforge.eu:8083
    echo HESTIACP_USERNAME=epgmooky
    echo HESTIACP_ACCESS_KEY=o2z6TO8bZ7M89w1SrfUr
    echo HESTIACP_SECRET_KEY=x62zVT1n=tS6gqZXiDfjApFJd9ppdXLU_VW6lIp-
    echo HESTIACP_DEFAULT_PACKAGE=default
    echo HESTIACP_SERVER_IP=46.41.23.200
) >> .env

echo ✅ Konfigurace přidána do .env
echo.
echo ================================================
echo   Nastavení dokončeno!
echo ================================================
echo.
echo Další kroky:
echo   1. Otestuj připojení: node test-hestiacp-quick.js
echo   2. Restartuj backend server: node server.js
echo   3. Zkontroluj že vidíš "HestiaCP Status: ✅ Configured"
echo.
echo Pro více informací se podívej do HESTIACP-SETUP-NOW.md
echo.
pause

