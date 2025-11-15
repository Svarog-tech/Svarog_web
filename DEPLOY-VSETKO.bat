@echo off
echo ================================================
echo   KOMPLETNI DEPLOYMENT GOPAY EDGE FUNCTIONS
echo ================================================
echo.
echo Tento skript provede:
echo 1. Prihlaseni do Supabase
echo 2. Propojeni s projektem
echo 3. Nastaveni GoPay secrets
echo 4. Nasazeni Edge Functions
echo.
echo Pokracovat? (Stiskni libovolnou klavesu)
pause > nul
echo.

echo ================================================
echo KROK 1/4: Prihlaseni
echo ================================================
npx supabase login
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Prihlaseni selhalo!
    goto manual
)
echo OK
echo.

echo ================================================
echo KROK 2/4: Propojeni projektu
echo ================================================
npx supabase link --project-ref ccgxtldxeerwacyekzyk
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Propojeni selhalo!
    goto manual
)
echo OK
echo.

echo ================================================
echo KROK 3/4: Nastaveni secrets
echo ================================================
echo Nastavuji GoPay credentials...
npx supabase secrets set GOPAY_GO_ID=8801275087
npx supabase secrets set GOPAY_CLIENT_ID=1341082006
npx supabase secrets set GOPAY_CLIENT_SECRET=57RdPFDE
npx supabase secrets set GOPAY_ENVIRONMENT=SANDBOX
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Nastaveni secrets selhalo!
    goto manual
)
echo OK
echo.

echo ================================================
echo KROK 4/4: Nasazeni funkcí
echo ================================================
echo Nasazuji create-gopay-payment...
npx supabase functions deploy create-gopay-payment --no-verify-jwt
if %ERRORLEVEL% NEQ 0 goto error

echo Nasazuji check-gopay-payment...
npx supabase functions deploy check-gopay-payment --no-verify-jwt
if %ERRORLEVEL% NEQ 0 goto error

echo Nasazuji gopay-webhook...
npx supabase functions deploy gopay-webhook --no-verify-jwt
if %ERRORLEVEL% NEQ 0 goto error

echo.
echo ================================================
echo   HOTOVO! VSECHNO USPESNE NASAZENO!
echo ================================================
echo.
echo Edge Functions jsou dostupne:
echo - create-gopay-payment ✓
echo - check-gopay-payment ✓
echo - gopay-webhook ✓
echo.
echo DALSI KROKY:
echo 1. Restartuj aplikaci: npm start
echo 2. Otevri Configurator
echo 3. Vytvor testovaci objednavku
echo 4. Platba by mela fungovat!
echo.
pause
exit /b 0

:error
echo.
echo ERROR: Nasazeni selhalo!
goto manual

:manual
echo.
echo ================================================
echo   MANUALNI POSTUP
echo ================================================
echo.
echo Pokud automaticky nefunguje, spust krok po kroku:
echo 1. Spust: 1-login-supabase.bat
echo 2. Spust: 2-link-project.bat
echo 3. Spust: 3-set-secrets.bat
echo 4. Spust: 4-deploy-functions.bat
echo.
pause
exit /b 1
