@echo off
echo ================================================
echo   HOSTING VEMICE - Quick Start
echo ================================================
echo.
echo GoPay je nastavene LOKALNE - zadne Edge Functions!
echo.
echo Credentials jsou v .env:
echo - GoID: 8801275087
echo - ClientID: 1341082006
echo - Environment: SANDBOX
echo.
echo ================================================
echo.
echo DULEZITE: Pred prvnim spustenim spust SQL migraci:
echo 1. Otevri Supabase Dashboard ^> SQL Editor
echo 2. Zkopiruj obsah z: sql/add-admin-and-payment.sql
echo 3. Spust ho (Run / Ctrl+Enter)
echo.
echo ================================================
echo.
echo Spoustim aplikaci...
echo.

npm start

pause
