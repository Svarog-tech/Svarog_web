@echo off
echo ================================================
echo   Krok 4: Nasazeni Edge Functions
echo ================================================
echo.
echo Nasazuji Edge Functions s CORS headers...
echo.

echo [1/3] create-gopay-payment...
npx supabase functions deploy create-gopay-payment --no-verify-jwt
if %ERRORLEVEL% NEQ 0 goto error
echo OK
echo.

echo [2/3] check-gopay-payment...
npx supabase functions deploy check-gopay-payment --no-verify-jwt
if %ERRORLEVEL% NEQ 0 goto error
echo OK
echo.

echo [3/3] gopay-webhook...
npx supabase functions deploy gopay-webhook --no-verify-jwt
if %ERRORLEVEL% NEQ 0 goto error
echo OK
echo.

echo ================================================
echo   USPECH! Vsechny funkce nasazeny!
echo ================================================
echo.
echo Overeni:
npx supabase functions list
echo.
echo Funkce jsou dostupne na:
echo - https://ccgxtldxeerwacyekzyk.supabase.co/functions/v1/create-gopay-payment
echo - https://ccgxtldxeerwacyekzyk.supabase.co/functions/v1/check-gopay-payment
echo - https://ccgxtldxeerwacyekzyk.supabase.co/functions/v1/gopay-webhook
echo.
echo Nyni muzes testovat platby v aplikaci!
echo Restartuj aplikaci: npm start
echo.
pause
exit /b 0

:error
echo.
echo ERROR: Nasazeni funkci selhalo!
echo Zkontroluj:
echo 1. Jsi prihlasen? (1-login-supabase.bat)
echo 2. Jsi propojen s projektem? (2-link-project.bat)
echo 3. Jsou nastaveny secrets? (3-set-secrets.bat)
pause
exit /b 1
