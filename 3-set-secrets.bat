@echo off
echo ================================================
echo   Krok 3: Nastaveni GoPay Secrets
echo ================================================
echo.
echo Nastavuji GoPay credentials jako Supabase secrets...
echo.

echo [1/4] GOPAY_GO_ID...
npx supabase secrets set GOPAY_GO_ID=8801275087
if %ERRORLEVEL% NEQ 0 goto error

echo [2/4] GOPAY_CLIENT_ID...
npx supabase secrets set GOPAY_CLIENT_ID=1341082006
if %ERRORLEVEL% NEQ 0 goto error

echo [3/4] GOPAY_CLIENT_SECRET...
npx supabase secrets set GOPAY_CLIENT_SECRET=57RdPFDE
if %ERRORLEVEL% NEQ 0 goto error

echo [4/4] GOPAY_ENVIRONMENT...
npx supabase secrets set GOPAY_ENVIRONMENT=SANDBOX
if %ERRORLEVEL% NEQ 0 goto error

echo.
echo OK - Vsechny secrets nastaveny!
echo.
echo Overeni:
npx supabase secrets list
echo.
echo Dal pokracuj: spust 4-deploy-functions.bat
echo.
pause
exit /b 0

:error
echo.
echo ERROR: Nastaveni secrets selhalo!
echo Zkontroluj ze jsi propojen s projektem (spust 2-link-project.bat)
pause
exit /b 1
