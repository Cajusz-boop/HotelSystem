@echo off
chcp 65001 >nul 2>&1
title Instalacja autostartu POSNET Bridge
color 0A

echo.
echo  ====================================================
echo   Instalacja autostartu POSNET Bridge
echo  ====================================================
echo.

:: Sprawdz czy Node.js jest zainstalowany
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  BLAD: Node.js nie jest zainstalowany!
    echo.
    echo  Najpierw zainstaluj Node.js:
    echo  1. Wejdz na https://nodejs.org
    echo  2. Pobierz wersje LTS
    echo  3. Zainstaluj i zrestartuj komputer
    echo  4. Uruchom ten plik ponownie
    echo.
    pause
    exit /b 1
)

echo  Node.js znaleziony:
node --version
echo.

:: Sprawdz czy server.mjs istnieje
if not exist "%~dp0server.mjs" (
    color 0C
    echo  BLAD: Nie znaleziono pliku server.mjs!
    echo.
    pause
    exit /b 1
)

echo  Znaleziono server.mjs
echo  Instaluje autostart...
echo.

:: Wywolaj skrypt PowerShell ktory tworzy VBS w Autostarcie
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-autostart.ps1"

if %ERRORLEVEL% NEQ 0 goto :FAIL

:: Sprawdz czy plik istnieje
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP_FOLDER%\POSNET-Bridge.vbs" goto :SUCCESS

:FAIL
color 0C
echo.
echo  ====================================================
echo.
echo  BLAD: Nie udalo sie utworzyc autostartu.
echo.
echo  Sprobuj recznie:
echo  1. Nacisnij Win+R, wpisz: shell:startup
echo  2. Skopiuj plik bridge-silent.vbs do tego folderu
echo.
echo  ====================================================
echo.
pause
exit /b 1

:SUCCESS
echo.
echo  ====================================================
echo.
echo   SUKCES! Autostart zostal zainstalowany.
echo.
echo   Bridge POSNET bedzie uruchamial sie automatycznie
echo   po kazdym wlaczeniu komputera (w tle, bez okna).
echo.
echo   Aby wylaczyc autostart, uruchom:
echo   ODINSTALUJ-AUTOSTART.bat
echo.
echo  ====================================================
echo.
pause
