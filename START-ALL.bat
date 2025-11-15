@echo off
echo ================================================
echo   HOSTING VEMICE - Start All
echo ================================================
echo.
echo Spoustim:
echo 1. GoPay Proxy Server (port 3001)
echo 2. React aplikace (port 3000)
echo.
echo POZOR: Pokud jeste nemas nainstalované dependencies, spust:
echo   npm install
echo.
echo ================================================
echo.

start "GoPay Server" cmd /k "npm run server"
timeout /t 3 /nobreak > nul
start "React App" cmd /k "npm start"

echo.
echo Servery se spouštějí v nových oknech...
echo.
echo GoPay Server: http://localhost:3001
echo React App: http://localhost:3000
echo.
pause
