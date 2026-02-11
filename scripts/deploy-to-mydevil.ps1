# Wdrożenie na mydevil: build lokalnie + synchronizacja na serwer
# Uruchom z katalogu projektu: .\scripts\deploy-to-mydevil.ps1
# Przy scp zostaniesz poproszony o hasło SSH (jeśli nie masz klucza).
#
# Jeśli skrypt "nie startuje" (brak outputu), uruchom:
#   powershell -ExecutionPolicy Bypass -File .\scripts\deploy-to-mydevil.ps1
# albo raz na konto: Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

$ErrorActionPreference = "Stop"
Write-Host "=== deploy-to-mydevil.ps1 start ===" -ForegroundColor Green
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

# Jesli jest .env.deploy, uzyj z niego (zgodnosc z compare-local-vs-remote.ps1)
$envFile = Join-Path $ProjectRoot ".env.deploy"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $key = $matches[1].Trim(); $val = $matches[2].Trim()
            Set-Variable -Name $key -Value $val -Scope Script
        }
    }
    $SSH_USER = $DEPLOY_SSH_USER; $SSH_HOST = $DEPLOY_SSH_HOST; $REMOTE_PATH = $DEPLOY_REMOTE_PATH
} else {
    $SSH_USER = "karczma-labedz"
    $SSH_HOST = "s5.mydevil.net"
    $REMOTE_PATH = "domains/hotel.karczma-labedz.pl/public_nodejs"
}

Write-Host "=== 1/5 Prisma generate (engineType=client) ===" -ForegroundColor Cyan
npx prisma generate

Write-Host "`n=== 2/5 npm run build ===" -ForegroundColor Cyan
npm run build

Write-Host "`n=== 3/5 Kopiowanie static i Prisma (.prisma/client + WASM) do standalone ===" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path ".next\standalone\.next" | Out-Null
xcopy /E /I /Y .next\static .next\standalone\.next\static | Out-Null
New-Item -ItemType Directory -Force -Path ".next\standalone\node_modules\.prisma" | Out-Null
Copy-Item -Path "node_modules\.prisma\*" -Destination ".next\standalone\node_modules\.prisma\" -Recurse -Force

Write-Host "`n=== 4/5 Wysyłanie na serwer (scp) ===" -ForegroundColor Cyan
Write-Host "Cel: ${SSH_USER}@${SSH_HOST}:${REMOTE_PATH}" -ForegroundColor Yellow
Write-Host "Wgraj: app.js, .next, prisma (schema + migrations)" -ForegroundColor Yellow
# Uwaga: komunikaty „No such file or directory” dla export-marker.json / images-manifest.json można zignorować – aplikacja działa bez nich
scp -r app.js .next prisma "${SSH_USER}@${SSH_HOST}:${REMOTE_PATH}/"

Write-Host "`n=== 5/5 Aktualizacja bazy na serwerze (prisma db push) ===" -ForegroundColor Cyan
Write-Host "Na serwerze: cd do projektu, npx prisma db push (wymaga DATABASE_URL w ~/.bash_profile)" -ForegroundColor Yellow
ssh "${SSH_USER}@${SSH_HOST}" "cd ~/${REMOTE_PATH} && npx prisma db push"

Write-Host "`n[OK] Wyslano i zaktualizowano baze. Na serwerze uruchom: devil www restart hotel.karczma-labedz.pl" -ForegroundColor Green
