@echo off
chcp 65001 >nul 2>&1
title POSNET Trio Bridge - Kasa fiskalna
color 0A

echo.
echo  ====================================================
echo   POSNET Trio Bridge v2.0 - Kasa fiskalna
echo  ====================================================
echo.

:: Sprawdz czy Node.js jest zainstalowany
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  BLAD: Node.js nie jest zainstalowany!
    echo.
    echo  Pobierz i zainstaluj Node.js:
    echo  https://nodejs.org
    echo.
    echo  1. Wejdz na https://nodejs.org
    echo  2. Kliknij zielony przycisk "LTS" (po lewej)
    echo  3. Uruchom pobrany plik i klikaj "Next" do konca
    echo  4. Po instalacji ZRESTARTUJ komputer
    echo  5. Uruchom ten plik ponownie
    echo.
    pause
    exit /b 1
)

:: Zabij stary bridge jesli dziala (unikamy duplikatow)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":9977" ^| findstr "LISTENING"') do (
    echo  Zamykam poprzednia instancje bridge (PID: %%a)...
    taskkill /pid %%a /f >nul 2>&1
    timeout /t 1 /nobreak >nul
)

:: Zaladuj konfiguracje z bridge.env (jesli istnieje)
if exist "%~dp0bridge.env" (
    echo  Laduje konfiguracje z bridge.env...
    for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%~dp0bridge.env") do (
        if not "%%a"=="" if not "%%b"=="" set "%%a=%%b"
    )
) else (
    echo  UWAGA: Brak pliku bridge.env - uzywam domyslnych ustawien
    echo  Drukarka: 10.119.169.55:6666, tryb: tcp
    set "POSNET_BRIDGE_MODE=tcp"
    set "POSNET_PRINTER_HOST=10.119.169.55"
    set "POSNET_PRINTER_PORT=6666"
)

:: Pokaz wersje Node.js
echo  Node.js znaleziony:
node --version
echo.

:: Pokaz konfiguracje
echo  Tryb: %POSNET_BRIDGE_MODE%
echo  Drukarka: %POSNET_PRINTER_HOST%:%POSNET_PRINTER_PORT%
echo.

:: Uruchom bridge
echo  Uruchamiam bridge POSNET...
echo  NIE ZAMYKAJ TEGO OKNA! Bridge musi dzialac caly czas.
echo.
echo  TIP: Zeby nie musiec uruchamiac tego recznie,
echo       odpal ZAINSTALUJ-AUTOSTART.bat (jednorazowo)
echo       i bridge bedzie startowal sam po wlaczeniu komputera.
echo.
echo  ====================================================
echo.

node "%~dp0server.mjs"

:: Jesli bridge sie zakonczyl (blad)
echo.
color 0C
echo  Bridge zakonczyl dzialanie. Sprawdz bledy powyzej.
echo.
pause
