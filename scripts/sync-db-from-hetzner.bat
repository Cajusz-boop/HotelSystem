@echo off
REM =============================================================================
REM Synchronizacja bazy danych: Hetzner -> Serwer Lokalny
REM Uruchom NA SERWERZE LOKALNYM (10.119.169.20) przez AnyDesk
REM =============================================================================

cd /d E:\HotelSystem

echo.
echo === SYNCHRONIZACJA BAZY DANYCH ===
echo Kierunek: Hetzner (produkcja) -^> Serwer Lokalny
echo.

echo UWAGA: To nadpisze dane na serwerze lokalnym!
set /p confirm="Kontynuowac? (t/n): "
if /i not "%confirm%"=="t" (
    echo Anulowano.
    pause
    exit /b 0
)

echo.
echo [1/3] Pobieranie danych z Hetzner przez SSH...

REM Sprawdz czy ssh jest dostepne
where ssh >nul 2>&1
if %errorlevel% neq 0 (
    echo BLAD: ssh nie jest zainstalowane. Zainstaluj OpenSSH.
    pause
    exit /b 1
)

REM Dump z Hetzner - wymaga skonfigurowanego klucza SSH
ssh root@65.108.245.25 "mysqldump -u hotel -p'HotelPMS2024#Secure' --single-transaction --routines --triggers hotel_pms" > "%TEMP%\hotel_dump.sql" 2>nul

if not exist "%TEMP%\hotel_dump.sql" (
    echo BLAD: Nie udalo sie pobrac danych z Hetzner
    echo Sprawdz polaczenie SSH do 65.108.245.25
    pause
    exit /b 1
)

for %%A in ("%TEMP%\hotel_dump.sql") do set DUMP_SIZE=%%~zA
echo        Pobrano: %DUMP_SIZE% bajtow

echo.
echo [2/3] Importowanie do lokalnej bazy...

"c:\wamp64\bin\mysql\mysql5.7.14\bin\mysql.exe" -u root -proot123 hotel_pms < "%TEMP%\hotel_dump.sql" 2>nul
if %errorlevel% neq 0 (
    echo BLAD: Import do lokalnej bazy nie powiodl sie
    pause
    exit /b 1
)

echo.
echo [3/3] Weryfikacja...
"c:\wamp64\bin\mysql\mysql5.7.14\bin\mysql.exe" -u root -proot123 hotel_pms -e "SELECT COUNT(*) as 'Pokoi w bazie:' FROM Room"

del "%TEMP%\hotel_dump.sql" 2>nul

echo.
echo === SYNCHRONIZACJA ZAKONCZONA ===
echo.
pause
