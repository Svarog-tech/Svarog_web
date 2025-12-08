@echo off
echo ================================================
echo   Krok 3: Nastaveni GoPay Secrets
echo ================================================
echo.
echo Nastavuji GoPay credentials jako Supabase secrets...
echo.
echo SECURITY: Credentials se cteji z .env souboru
echo.

REM Nacti .env soubor pokud existuje
if exist .env (
    echo Nacitam .env soubor...
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        if "%%a"=="GOPAY_GO_ID" set GOPAY_GO_ID=%%b
        if "%%a"=="GOPAY_CLIENT_ID" set GOPAY_CLIENT_ID=%%b
        if "%%a"=="GOPAY_CLIENT_SECRET" set GOPAY_CLIENT_SECRET=%%b
        if "%%a"=="GOPAY_ENVIRONMENT" set GOPAY_ENVIRONMENT=%%b
    )
)

REM Fallback na default hodnoty pokud .env neexistuje (jen pro development)
if not defined GOPAY_GO_ID set GOPAY_GO_ID=8801275087
if not defined GOPAY_CLIENT_ID set GOPAY_CLIENT_ID=1341082006
if not defined GOPAY_CLIENT_SECRET set GOPAY_CLIENT_SECRET=57RdPFDE
if not defined GOPAY_ENVIRONMENT set GOPAY_ENVIRONMENT=SANDBOX

echo [1/4] GOPAY_GO_ID...
npx supabase secrets set GOPAY_GO_ID=%GOPAY_GO_ID%
if %ERRORLEVEL% NEQ 0 goto error

echo [2/4] GOPAY_CLIENT_ID...
npx supabase secrets set GOPAY_CLIENT_ID=%GOPAY_CLIENT_ID%
if %ERRORLEVEL% NEQ 0 goto error

echo [3/4] GOPAY_CLIENT_SECRET...
npx supabase secrets set GOPAY_CLIENT_SECRET=%GOPAY_CLIENT_SECRET%
if %ERRORLEVEL% NEQ 0 goto error

echo [4/4] GOPAY_ENVIRONMENT...
npx supabase secrets set GOPAY_ENVIRONMENT=%GOPAY_ENVIRONMENT%
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
