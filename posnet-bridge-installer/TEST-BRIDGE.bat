@echo off
chcp 65001 >nul 2>&1
title Test bridge POSNET
color 0B

echo.
echo  ====================================================
echo   Test polaczenia z bridge POSNET
echo  ====================================================
echo.
echo  Sprawdzam czy bridge dziala na http://127.0.0.1:9977...
echo.

curl -s http://127.0.0.1:9977/health

if %ERRORLEVEL% NEQ 0 (
    echo.
    color 0C
    echo  BLAD: Bridge nie odpowiada!
    echo.
    echo  Upewnij sie ze:
    echo  1. Okno "URUCHOM-BRIDGE.bat" jest otwarte i dziala
    echo  2. Nie zamknales okna bridge'a
    echo.
) else (
    echo.
    echo.
    color 0A
    echo  OK! Bridge dziala prawidlowo.
    echo.
)

pause
