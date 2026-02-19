@echo off
chcp 65001 >nul 2>&1
title Odinstalowanie autostartu POSNET Bridge
color 0E

echo.
echo  ====================================================
echo   Odinstalowanie autostartu POSNET Bridge
echo  ====================================================
echo.

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "FOUND=0"

if exist "%STARTUP_FOLDER%\POSNET-Bridge.lnk" (
    del "%STARTUP_FOLDER%\POSNET-Bridge.lnk"
    set "FOUND=1"
)
if exist "%STARTUP_FOLDER%\POSNET-Bridge.vbs" (
    del "%STARTUP_FOLDER%\POSNET-Bridge.vbs"
    set "FOUND=1"
)

if "%FOUND%"=="1" (
    echo  Autostart zostal usuniety.
    echo  Bridge nie bedzie sie juz uruchamial automatycznie.
) else (
    echo  Autostart nie byl zainstalowany (nie znaleziono skrotu).
)

echo.

:: Zabij dzialajacy bridge na porcie 9977
echo  Sprawdzam czy bridge dziala...
set "KILLED=0"
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":9977" ^| findstr "LISTENING"') do (
    taskkill /pid %%a /f >nul 2>&1
    echo  Zatrzymano bridge (PID: %%a).
    set "KILLED=1"
)

if "%KILLED%"=="0" (
    echo  Bridge nie byl uruchomiony.
)

echo.
echo  Gotowe.
echo.
pause
