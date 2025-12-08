@echo off
echo Nastavuji GoPay secrets pro Supabase Edge Functions...
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

supabase secrets set GOPAY_GO_ID=%GOPAY_GO_ID%
supabase secrets set GOPAY_CLIENT_ID=%GOPAY_CLIENT_ID%
supabase secrets set GOPAY_CLIENT_SECRET=%GOPAY_CLIENT_SECRET%
supabase secrets set GOPAY_ENVIRONMENT=%GOPAY_ENVIRONMENT%

echo.
echo GoPay secrets byly uspesne nastaveny!
echo.
echo Pro overeni spustte: supabase secrets list
pause
