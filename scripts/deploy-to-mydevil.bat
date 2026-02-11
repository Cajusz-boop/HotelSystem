@echo off
REM Wdrozenie na mydevil: build lokalnie + synchronizacja
REM Uruchom z katalogu projektu: scripts\deploy-to-mydevil.bat
REM Przy scp zostaniesz poproszony o haslo SSH.

cd /d "%~dp0.."

echo === 1/4 Prisma generate (engineType=client, bez binarki) ===
call npx prisma generate

echo.
echo === 2/4 npm run build ===
call npm run build

echo.
echo === 3/4 Kopiowanie static i Prisma (.prisma/client + query_compiler_bg.wasm) do standalone ===
if not exist ".next\standalone\.next" mkdir ".next\standalone\.next"
xcopy /E /I /Y .next\static .next\standalone\.next\static
if not exist ".next\standalone\node_modules\.prisma" mkdir ".next\standalone\node_modules\.prisma"
xcopy /E /I /Y node_modules\.prisma .next\standalone\node_modules\.prisma

echo.
echo === 4/4 Pakowanie i wysylanie (ZIP - omija problem scp z linkami na Windows) ===
if exist deploy_mydevil.zip del deploy_mydevil.zip
powershell -Command "Compress-Archive -Path app.js, .next\standalone, .next\static -DestinationPath deploy_mydevil.zip -Force"
scp deploy_mydevil.zip karczma-labedz@s5.mydevil.net:domains/hotel.karczma-labedz.pl/public_nodejs/

echo.
echo Na serwerze (SSH) wykonaj:
echo   cd ~/domains/hotel.karczma-labedz.pl/public_nodejs
echo   unzip -o deploy_mydevil.zip
echo   mkdir -p .next
echo   rm -rf .next/standalone .next/static
echo   mv standalone .next/
echo   mv static .next/
echo   devil www restart hotel.karczma-labedz.pl
pause
