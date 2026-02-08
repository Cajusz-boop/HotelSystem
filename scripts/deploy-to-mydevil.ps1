# Wdrożenie na mydevil: build lokalnie + synchronizacja na serwer
# Uruchom z katalogu projektu: .\scripts\deploy-to-mydevil.ps1
# Przy scp zostaniesz poproszony o hasło SSH (jeśli nie masz klucza).

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $ProjectRoot

$SSH_USER = "karczma-labedz"
$SSH_HOST = "s5.mydevil.net"
$REMOTE_PATH = "domains/hotel.karczma-labedz.pl/public_nodejs"

Write-Host "=== 1/4 Prisma generate (engineType=client) ===" -ForegroundColor Cyan
npx prisma generate

Write-Host "`n=== 2/4 npm run build ===" -ForegroundColor Cyan
npm run build

Write-Host "`n=== 3/4 Kopiowanie static i Prisma (.prisma/client + WASM) do standalone ===" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path ".next\standalone\.next" | Out-Null
xcopy /E /I /Y .next\static .next\standalone\.next\static | Out-Null
New-Item -ItemType Directory -Force -Path ".next\standalone\node_modules\.prisma" | Out-Null
Copy-Item -Path "node_modules\.prisma\*" -Destination ".next\standalone\node_modules\.prisma\" -Recurse -Force

Write-Host "`n=== 4/4 Wysyłanie na serwer (scp) ===" -ForegroundColor Cyan
Write-Host "Cel: ${SSH_USER}@${SSH_HOST}:${REMOTE_PATH}" -ForegroundColor Yellow
Write-Host "Wgraj: app.js, .next" -ForegroundColor Yellow
scp -r app.js .next "${SSH_USER}@${SSH_HOST}:${REMOTE_PATH}/"

Write-Host "`n[OK] Wyslano. Na serwerze uruchom: devil www restart hotel.karczma-labedz.pl" -ForegroundColor Green
