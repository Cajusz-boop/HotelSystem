@echo off
REM =============================================================================
REM Skrypt aktualizacji serwera lokalnego HotelSystem
REM Uruchom na serwerze lokalnym (10.119.169.20) przez AnyDesk
REM =============================================================================

cd /d E:\HotelSystem

echo.
echo === AKTUALIZACJA HOTELSYSTEM ===
echo.

echo [1/5] Pobieranie zmian z GitHub...
git pull
if %errorlevel% neq 0 (
    echo BLAD: Nie udalo sie pobrac zmian z GitHub
    pause
    exit /b 1
)

echo.
echo [2/5] Instalacja nowych bibliotek...
call npm install
if %errorlevel% neq 0 (
    echo BLAD: npm install nie powiodl sie
    pause
    exit /b 1
)

echo.
echo [3/5] Generowanie Prisma Client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo BLAD: prisma generate nie powiodl sie
    pause
    exit /b 1
)

echo.
echo [4/5] Budowanie aplikacji...
call npm run build
if %errorlevel% neq 0 (
    echo BLAD: npm run build nie powiodl sie
    pause
    exit /b 1
)

echo.
echo [5/5] Restart PM2...
call pm2 restart hotel-pms
if %errorlevel% neq 0 (
    echo UWAGA: PM2 restart nie powiodl sie, probuje uruchomic...
    call pm2 start .next\standalone\server.js --name hotel-pms
)

echo.
echo === AKTUALIZACJA ZAKONCZONA POMYSLNIE ===
echo.
echo Aplikacja dostepna pod: http://localhost:3000
echo.
pause
