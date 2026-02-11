# Synchronizacja lokalnego schema.prisma z produkcją (po introspect na serwerze).
# Uruchom z katalogu projektu: .\scripts\sync-schema-from-production.ps1
#
# Wymagane wcześniej (ręcznie):
# 1. Na serwerze (SSH): cd ~/domains/hotel.karczma-labedz.pl/public_nodejs && npx prisma db pull
# 2. Na Windows: scp karczma-labedz@panel5.mydevil.net:domains/hotel.karczma-labedz.pl/public_nodejs/prisma/schema.prisma prisma/schema.pulled.prisma

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PrismaDir = Join-Path $ProjectRoot "prisma"
$SchemaPath = Join-Path $PrismaDir "schema.prisma"
$PulledPath = Join-Path $PrismaDir "schema.pulled.prisma"

if (-not (Test-Path $PulledPath)) {
    Write-Host "Brak pliku prisma/schema.pulled.prisma." -ForegroundColor Yellow
    Write-Host "Wykonaj najpierw:" -ForegroundColor Cyan
    Write-Host "  1. SSH na serwer, w katalogu aplikacji: npx prisma db pull"
    Write-Host "  2. scp karczma-labedz@panel5.mydevil.net:domains/hotel.karczma-labedz.pl/public_nodejs/prisma/schema.prisma prisma/schema.pulled.prisma"
    exit 1
}

$currentLines = Get-Content $SchemaPath
$pulledSchema = Get-Content $PulledPath -Raw

# Wyciągnij blok generator client z obecnego schema (od początku do końca pierwszego "}" zamykającego generator)
$genStartIndex = -1
$genEndIndex = -1
for ($i = 0; $i -lt $currentLines.Count; $i++) {
    if ($currentLines[$i] -match '^\s*generator\s+client\s+\{') { $genStartIndex = $i; break }
}
if ($genStartIndex -lt 0) { Write-Host "Nie znaleziono generator client w schema.prisma"; exit 1 }
for ($i = $genStartIndex + 1; $i -lt $currentLines.Count; $i++) {
    if ($currentLines[$i] -match '^\s*\}\s*$') { $genEndIndex = $i; break }
}
if ($genEndIndex -lt 0) { Write-Host "Nie znaleziono zamykajacego } generatora"; exit 1 }
$headerAndGenerator = ($currentLines[0..$genEndIndex] -join "`n").TrimEnd()

# Z pulled: usuń generator client (zostaw datasource, enums, modele)
$pulledWithoutGenerator = $pulledSchema -replace '(?s)^\s*generator\s+client\s+\{[\s\S]*?\}\s*\r?\n?', ''
$pulledWithoutGenerator = $pulledWithoutGenerator.TrimStart()

# Połącz: nasz generator + reszta z pulla
$merged = $headerAndGenerator + "`n`n" + $pulledWithoutGenerator
Set-Content -Path $SchemaPath -Value $merged -NoNewline

Write-Host "Zaktualizowano schema.prisma (generator zachowany, reszta z produkcji)." -ForegroundColor Green

Set-Location $ProjectRoot
Write-Host "`nPrisma generate..." -ForegroundColor Cyan
npx prisma generate
Write-Host "`nPrisma db push (lokalna baza)..." -ForegroundColor Cyan
npx prisma db push

Remove-Item $PulledPath -Force
Write-Host "`nUsunieto schema.pulled.prisma. Gotowe." -ForegroundColor Green
