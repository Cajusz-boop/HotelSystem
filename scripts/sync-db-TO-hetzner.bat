@echo off
REM =============================================================================
REM Synchronizacja bazy danych: Serwer Lokalny -> Hetzner
REM Uruchom NA SERWERZE LOKALNYM (10.119.169.20) przez AnyDesk
REM Uzyj PO PRACY OFFLINE gdy internet wroci
REM =============================================================================

cd /d E:\HotelSystem

echo.
echo ============================================
echo    SYNCHRONIZACJA: LOKALNY -^> HETZNER
echo ============================================
echo.
echo UWAGA: To NADPISZE dane na serwerze Hetzner!
echo Uzywaj tylko po pracy offline, gdy internet wrocil.
echo.
echo Dane z lokalnego serwera zostana wyslane na:
echo   hotel.karczma-labedz.pl (65.108.245.25)
echo.

set /p confirm="Czy na pewno chcesz kontynuowac? (t/n): "
if /i not "%confirm%"=="t" (
    echo Anulowano.
    pause
    exit /b 0
)

echo.
echo [1/4] Eksportowanie lokalnej bazy...

REM Dump lokalnej bazy
"c:\wamp64\bin\mysql\mysql5.7.14\bin\mysqldump.exe" -u root -proot123 --single-transaction --routines --triggers hotel_pms > "%TEMP%\hotel_local_dump.sql" 2>nul

if not exist "%TEMP%\hotel_local_dump.sql" (
    echo BLAD: Nie udalo sie wyeksportowac lokalnej bazy
    pause
    exit /b 1
)

for %%A in ("%TEMP%\hotel_local_dump.sql") do set DUMP_SIZE=%%~zA
if %DUMP_SIZE% LSS 1000 (
    echo BLAD: Dump jest za maly (%DUMP_SIZE% bajtow) - cos poszlo nie tak
    pause
    exit /b 1
)
echo        Wyeksportowano: %DUMP_SIZE% bajtow

echo.
echo [2/4] Sprawdzanie polaczenia z Hetzner...

where ssh >nul 2>&1
if %errorlevel% neq 0 (
    echo BLAD: ssh nie jest zainstalowane. Zainstaluj OpenSSH.
    pause
    exit /b 1
)

ssh -o ConnectTimeout=10 root@65.108.245.25 "echo OK" >nul 2>&1
if %errorlevel% neq 0 (
    echo BLAD: Brak polaczenia z Hetzner (65.108.245.25)
    echo Sprawdz czy internet dziala i klucz SSH jest poprawny.
    del "%TEMP%\hotel_local_dump.sql" 2>nul
    pause
    exit /b 1
)
echo        Polaczenie OK

echo.
echo [3/4] Wysylanie danych na Hetzner...

REM Kopiuj dump na Hetzner
scp "%TEMP%\hotel_local_dump.sql" root@65.108.245.25:/tmp/hotel_local_dump.sql
if %errorlevel% neq 0 (
    echo BLAD: Nie udalo sie wyslac pliku na Hetzner
    del "%TEMP%\hotel_local_dump.sql" 2>nul
    pause
    exit /b 1
)
echo        Wyslano

echo.
echo [4/4] Importowanie na Hetzner...

REM Import na Hetzner
ssh root@65.108.245.25 "mysql -u hotel -p'HotelPMS2024#Secure' hotel_pms < /tmp/hotel_local_dump.sql && rm /tmp/hotel_local_dump.sql && echo Import OK"
if %errorlevel% neq 0 (
    echo BLAD: Import na Hetzner nie powiodl sie
    del "%TEMP%\hotel_local_dump.sql" 2>nul
    pause
    exit /b 1
)

REM Weryfikacja
echo.
echo Weryfikacja - liczba pokoi na Hetzner:
ssh root@65.108.245.25 "mysql -u hotel -p'HotelPMS2024#Secure' hotel_pms -e \"SELECT COUNT(*) as 'Pokoi:' FROM Room\""

REM Czyszczenie
del "%TEMP%\hotel_local_dump.sql" 2>nul

echo.
echo ============================================
echo    SYNCHRONIZACJA ZAKONCZONA POMYSLNIE
echo ============================================
echo.
echo Dane z serwera lokalnego zostaly wyslane na Hetzner.
echo Mozesz teraz wrocic do pracy na:
echo   https://hotel.karczma-labedz.pl
echo.
pause
