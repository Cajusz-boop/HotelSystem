@echo off
REM =============================================================================
REM Automatyczna aktualizacja HotelSystem - uruchamiana przez Task Scheduler
REM Sprawdza czy są nowe zmiany na GitHub i aktualizuje jeśli tak
REM =============================================================================

cd /d E:\HotelSystem

REM Sprawdź czy są nowe zmiany
git fetch origin master >nul 2>&1

for /f %%i in ('git rev-parse HEAD') do set LOCAL=%%i
for /f %%i in ('git rev-parse origin/master') do set REMOTE=%%i

if "%LOCAL%"=="%REMOTE%" (
    REM Brak zmian - nic nie rób
    exit /b 0
)

REM Są zmiany - aktualizuj
echo %date% %time% - Wykryto zmiany, aktualizuję... >> E:\HotelSystem\logs\auto-update.log

call git pull >> E:\HotelSystem\logs\auto-update.log 2>&1
if %errorlevel% neq 0 (
    echo %date% %time% - BLAD: git pull >> E:\HotelSystem\logs\auto-update.log
    exit /b 1
)

call npm install >> E:\HotelSystem\logs\auto-update.log 2>&1
call npx prisma generate >> E:\HotelSystem\logs\auto-update.log 2>&1

call pm2 stop hotel-pms >> E:\HotelSystem\logs\auto-update.log 2>&1
call npm run build >> E:\HotelSystem\logs\auto-update.log 2>&1

if %errorlevel% neq 0 (
    echo %date% %time% - BLAD: npm run build >> E:\HotelSystem\logs\auto-update.log
    call pm2 restart hotel-pms >> E:\HotelSystem\logs\auto-update.log 2>&1
    exit /b 1
)

call pm2 restart hotel-pms >> E:\HotelSystem\logs\auto-update.log 2>&1

echo %date% %time% - Aktualizacja zakonczona pomyslnie >> E:\HotelSystem\logs\auto-update.log
exit /b 0
