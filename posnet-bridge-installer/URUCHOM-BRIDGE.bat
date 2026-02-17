@echo off
chcp 65001 >nul 2>&1
title POSNET Trio Bridge - Kasa fiskalna
color 0A

echo.
echo  ====================================================
echo   POSNET Trio Bridge - Kasa fiskalna
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

:: Pokaz wersje Node.js
echo  Node.js znaleziony:
node --version
echo.

:: Uruchom bridge
echo  Uruchamiam bridge POSNET...
echo  NIE ZAMYKAJ TEGO OKNA! Bridge musi dzialac caly czas.
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
