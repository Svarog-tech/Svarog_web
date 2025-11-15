@echo off
echo ================================================
echo   Krok 1: Prihlaseni do Supabase
echo ================================================
echo.
echo Tento skript te prihlas do Supabase.
echo.
echo Otevri prohlizec a potvrdi prihlaseni...
echo.

npx supabase login

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Prihlaseni se nezdarilo!
    echo.
    echo ALTERNATIVA: Pouzij Access Token
    echo 1. Otevri https://supabase.com/dashboard/account/tokens
    echo 2. Vytvor novy Access Token
    echo 3. Spust: set SUPABASE_ACCESS_TOKEN=your_token
    echo 4. Zkus znovu
    pause
    exit /b 1
)

echo.
echo OK - Prihlasen!
echo.
echo Dal pokracuj: spust 2-link-project.bat
echo.
pause
