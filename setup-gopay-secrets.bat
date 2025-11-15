@echo off
echo Nastavuji GoPay secrets pro Supabase Edge Functions...
echo.

supabase secrets set GOPAY_GO_ID=8801275087
supabase secrets set GOPAY_CLIENT_ID=1341082006
supabase secrets set GOPAY_CLIENT_SECRET=57RdPFDE
supabase secrets set GOPAY_ENVIRONMENT=SANDBOX

echo.
echo GoPay secrets byly uspesne nastaveny!
echo.
echo Pro overeni spustte: supabase secrets list
pause
