@echo off
echo ================================================
echo   Krok 2: Propojeni s projektem
echo ================================================
echo.
echo Propojuji s Supabase projektem: ccgxtldxeerwacyekzyk
echo.

npx supabase link --project-ref ccgxtldxeerwacyekzyk

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Propojeni se nezdarilo!
    echo Zkontroluj ze jsi prihlasen (spust 1-login-supabase.bat)
    pause
    exit /b 1
)

echo.
echo OK - Projekt propojen!
echo.
echo Dal pokracuj: spust 3-set-secrets.bat
echo.
pause
