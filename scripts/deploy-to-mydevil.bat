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
REM Usun cache webpacka ze standalone (zbedny na produkcji, duzo MB)
if exist ".next\standalone\.next\cache" rmdir /S /Q ".next\standalone\.next\cache"
REM Pakuj z prawidlowa struktura: .next\standalone i .next\static w ZIP-ie
REM (po unzip na serwerze pliki laduja od razu w .next/standalone i .next/static)
powershell -Command "$tmp = 'deploy_tmp'; if(Test-Path $tmp){Remove-Item $tmp -Recurse -Force}; New-Item -ItemType Directory -Path $tmp\.next -Force | Out-Null; Copy-Item '.next\standalone' -Destination \"$tmp\.next\standalone\" -Recurse; Copy-Item '.next\static' -Destination \"$tmp\.next\static\" -Recurse; Copy-Item 'app.js' -Destination $tmp\; Compress-Archive -Path \"$tmp\*\" -DestinationPath deploy_mydevil.zip -Force; Remove-Item $tmp -Recurse -Force"
scp deploy_mydevil.zip karczma-labedz@s5.mydevil.net:domains/hotel.karczma-labedz.pl/public_nodejs/

echo.
echo Na serwerze (SSH) wykonaj:
echo   cd ~/domains/hotel.karczma-labedz.pl/public_nodejs
echo   rm -rf .next/standalone .next/static
echo   unzip -o deploy_mydevil.zip
echo   devil www restart hotel.karczma-labedz.pl
pause
