@echo off
chcp 65001 >nul
echo ================================================
echo   HestiaCP Connection Test
echo ================================================
echo.

REM Zkontroluj jestli existuje .env soubor
if not exist .env (
    echo ❌ Soubor .env neexistuje!
    echo Spusť nejdřív setup-hestiacp.bat
    pause
    exit /b 1
)

REM Načti proměnné z .env (jednoduchý způsob)
for /f "tokens=2 delims==" %%a in ('findstr "HESTIACP_URL" .env') do set HESTIA_URL=%%a
for /f "tokens=2 delims==" %%a in ('findstr "HESTIACP_ACCESS_KEY" .env') do set HESTIA_ACCESS=%%a
for /f "tokens=2 delims==" %%a in ('findstr "HESTIACP_SECRET_KEY" .env') do set HESTIA_SECRET=%%a

if "%HESTIA_URL%"=="" (
    echo ❌ HESTIACP_URL není nastaveno v .env
    echo Spusť setup-hestiacp.bat pro konfiguraci
    pause
    exit /b 1
)

echo Testuji připojení k: %HESTIA_URL%
echo.

REM Test 1: Health check backend serveru
echo [Test 1] Kontroluji backend server...
curl -s http://localhost:3001/health >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Backend server neběží na localhost:3001
    echo Spusť server: node server.js
    pause
    exit /b 1
)
echo ✅ Backend server běží

REM Test 2: Health endpoint
echo.
echo [Test 2] Kontroluji HestiaCP konfiguraci...
curl -s http://localhost:3001/health | findstr "hestiacp_configured" >nul
if %errorlevel% neq 0 (
    echo ❌ HestiaCP není správně nakonfigurováno
    echo Zkontroluj .env soubor
    pause
    exit /b 1
)
echo ✅ HestiaCP je nakonfigurováno

REM Test 3: Test vytvoření účtu (volitelné)
echo.
echo [Test 3] Test vytvoření testovacího účtu...
echo ⚠️  Tento test vytvoří skutečný účet v HestiaCP!
set /p TEST_CREATE="Chceš otestovat vytvoření účtu? (a/n): "
if /i "%TEST_CREATE%"=="a" (
    set /p TEST_EMAIL="Zadej testovací email: "
    set /p TEST_DOMAIN="Zadej testovací doménu: "
    
    echo.
    echo Vytvářím testovací účet...
    curl -X POST http://localhost:3001/api/hestiacp/create-account ^
        -H "Content-Type: application/json" ^
        -d "{\"email\":\"%TEST_EMAIL%\",\"domain\":\"%TEST_DOMAIN%\",\"package\":\"default\"}"
    
    echo.
    echo.
    if %errorlevel% equ 0 (
        echo ✅ Testovací účet byl vytvořen
        echo ⚠️  Nezapomeň ho smazat v HestiaCP!
    ) else (
        echo ❌ Vytvoření účtu selhalo
        echo Zkontroluj logy serveru
    )
)

echo.
echo ================================================
echo   Test dokončen
echo ================================================
echo.
echo Pokud všechny testy prošly, je HestiaCP správně propojeno!
echo.
pause

