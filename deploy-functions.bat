@echo off
echo ================================================
echo   Deploy GoPay Edge Functions do Supabase
echo ================================================
echo.
echo Nasazuji Edge Functions...
echo.

echo [1/3] Nasazuji create-gopay-payment...
supabase functions deploy create-gopay-payment --no-verify-jwt
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Chyba pri nasazeni create-gopay-payment
    pause
    exit /b 1
)
echo OK - create-gopay-payment nainstalovan
echo.

echo [2/3] Nasazuji check-gopay-payment...
supabase functions deploy check-gopay-payment --no-verify-jwt
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Chyba pri nasazeni check-gopay-payment
    pause
    exit /b 1
)
echo OK - check-gopay-payment nainstalovan
echo.

echo [3/3] Nasazuji gopay-webhook...
supabase functions deploy gopay-webhook --no-verify-jwt
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Chyba pri nasazeni gopay-webhook
    pause
    exit /b 1
)
echo OK - gopay-webhook nainstalovan
echo.

echo ================================================
echo   Vsechny Edge Functions byly uspesne nasazeny!
echo ================================================
echo.
echo Pro overeni spustte: supabase functions list
echo.
pause
