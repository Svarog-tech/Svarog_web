@echo off
REM ============================================
REM Lokalni MariaDB setup pro Alatyr Hosting
REM ============================================
REM Pozadavky: MariaDB 12.x nainstalovana a bezici
REM Pouziti: spustit z adresare projektu
REM ============================================

set MYSQL="C:\Program Files\MariaDB 12.1\bin\mysql.exe"
set DB_NAME=alatyr_hosting
set DB_USER=alatyr
set DB_PASS=alatyr_dev_2026

echo [1/6] Vytvarim databazi a uzivatele...
%MYSQL% -u root -e "CREATE DATABASE IF NOT EXISTS %DB_NAME% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS '%DB_USER%'@'localhost' IDENTIFIED BY '%DB_PASS%'; GRANT ALL PRIVILEGES ON %DB_NAME%.* TO '%DB_USER%'@'localhost'; FLUSH PRIVILEGES;"
if errorlevel 1 (echo CHYBA: Nepodarilo se vytvorit DB. Bezi MariaDB? && exit /b 1)

echo [2/6] Spoustim zakladni schema...
%MYSQL% -u %DB_USER% -p%DB_PASS% %DB_NAME% < sql\mysql-setup.sql
if errorlevel 1 (echo CHYBA: mysql-setup.sql && exit /b 1)

echo [3/6] Migrace v3 - MFA, invoice, indexy...
%MYSQL% -u %DB_USER% -p%DB_PASS% %DB_NAME% < sql\migration-v3.sql
if errorlevel 1 (echo CHYBA: migration-v3.sql && exit /b 1)

echo [4/6] Migrace v4 - audit, webhooks...
%MYSQL% -u %DB_USER% -p%DB_PASS% %DB_NAME% < sql\migration-v4.sql
if errorlevel 1 (echo CHYBA: migration-v4.sql && exit /b 1)

echo [5/6] Migrace v5 - statistiky...
%MYSQL% -u %DB_USER% -p%DB_PASS% %DB_NAME% < sql\migration-v5-statistics.sql
if errorlevel 1 (echo CHYBA: migration-v5-statistics.sql && exit /b 1)

echo [6/6] Migrace discord...
%MYSQL% -u %DB_USER% -p%DB_PASS% %DB_NAME% < sql\migration-discord.sql
if errorlevel 1 (echo CHYBA: migration-discord.sql && exit /b 1)

echo.
echo ============================================
echo Databaze %DB_NAME% pripravena!
echo Uzivatel: %DB_USER% / %DB_PASS%
echo Tabulky:
%MYSQL% -u %DB_USER% -p%DB_PASS% %DB_NAME% -e "SELECT COUNT(*) AS pocet_tabulek FROM information_schema.tables WHERE table_schema='%DB_NAME%';"
echo ============================================
echo Nyni spustte: node create-admin-user-final.sql pro seed admin uzivatele
echo Nebo upravte .env s MYSQL_HOST=localhost
echo ============================================
