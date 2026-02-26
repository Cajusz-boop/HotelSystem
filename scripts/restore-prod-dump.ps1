# Przywraca bazę z pliku hotel_prod_dump.sql do lokalnej bazy (z .env DATABASE_URL).
# Uruchom z katalogu projektu: powershell -ExecutionPolicy Bypass -File .\scripts\restore-prod-dump.ps1
#
# Wymagania:
# - hotel_prod_dump.sql w katalogu projektu (np. z npm run db:pull -SkipImport)
# - .env z DATABASE_URL (mysql://user:pass@host:port/dbname)
# - mysql w PATH (np. C:\xampp\mysql\bin)

param([switch]$WhatIf)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$DumpFileName = "hotel_prod_dump.sql"
$DumpPath = Join-Path $ProjectRoot $DumpFileName

if (-not (Test-Path $DumpPath)) {
    Write-Host "[BLAD] Brak pliku $DumpFileName" -ForegroundColor Red
    Write-Host "Pobierz zrzut: npm run db:pull (lub npm run db:pull -- -SkipImport, potem import reczny)" -ForegroundColor Yellow
    exit 1
}

# Parsuj DATABASE_URL z .env
$envPath = Join-Path $ProjectRoot ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "[BLAD] Brak pliku .env" -ForegroundColor Red
    exit 1
}
$line = Get-Content $envPath | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $line -or $line -notmatch '=\s*["'']?([^"''\s]+)["'']?') {
    Write-Host "[BLAD] Nie znaleziono DATABASE_URL w .env" -ForegroundColor Red
    exit 1
}
$LocalUrl = $matches[1]
if ($LocalUrl -notmatch 'mysql://([^:]+)(?::([^@]*))?@([^/:]+):(\d+)/(.+)') {
    Write-Host "[BLAD] Nieprawidlowy format DATABASE_URL: $LocalUrl" -ForegroundColor Red
    exit 1
}
$LocalUser = $matches[1]
$LocalPass = $matches[2]
$LocalHost = $matches[3]
$LocalPort = $matches[4]
$LocalDb   = $matches[5]

if ($WhatIf) {
    Write-Host "[WhatIf] Import do: $LocalHost`:$LocalPort / $LocalDb (user: $LocalUser)" -ForegroundColor Cyan
    exit 0
}

Write-Host "=== Przywracanie bazy z $DumpFileName ===" -ForegroundColor Cyan
Write-Host "Cel: $LocalHost`:$LocalPort / $LocalDb" -ForegroundColor Gray

$mysqlExe = Get-Command mysql -ErrorAction SilentlyContinue
if (-not $mysqlExe) { $mysqlExe = Get-Command "C:\xampp\mysql\bin\mysql.exe" -ErrorAction SilentlyContinue }
if (-not $mysqlExe) {
    Write-Host "[BLAD] Nie znaleziono mysql w PATH. Uruchom recznie:" -ForegroundColor Red
    Write-Host "  mysql -u $LocalUser -h $LocalHost -P $LocalPort $LocalDb < `"$DumpPath`"" -ForegroundColor Yellow
    exit 1
}

$args = @("-u", $LocalUser, "-h", $LocalHost, "-P", $LocalPort, "--default-character-set=utf8mb4", $LocalDb)
if ($LocalPass) { $args = @("-u", $LocalUser, "-p$LocalPass", "-h", $LocalHost, "-P", $LocalPort, "--default-character-set=utf8mb4", $LocalDb) }

Get-Content $DumpPath -Raw -Encoding UTF8 | & $mysqlExe.Source @args 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[OSTRZEZENIE] Import mogl zwrocic bledy. Sprawdz aplikacje." -ForegroundColor Yellow
} else {
    Write-Host "Import zakonczony pomyslnie." -ForegroundColor Green
}
