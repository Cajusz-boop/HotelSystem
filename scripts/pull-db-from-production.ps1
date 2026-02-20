# Sciagniecie bazy MySQL z chmury (MyDevil) i import do lokalnej bazy.
# Uruchom z katalogu projektu: powershell -ExecutionPolicy Bypass -File .\scripts\pull-db-from-production.ps1
#
# Po skonczeniu lokalna baza (hotel_pms) bedzie miala te same dane co produkcja
# – grafik Recepcji pokaze te same pokoje i rezerwacje co na hotel.karczma-labedz.pl.
#
# Wymagania:
# - SSH do panel5.mydevil.net (skrypt zapyta o haslo 2x: eksport + SCP)
# - Na serwerze: mysqldump, mysql w PATH
# - Lokalnie: mysql w PATH (np. XAMPP: C:\xampp\mysql\bin) lub ustaw w skrypcie
# - .env.deploy z DEPLOY_SSH_*, DEPLOY_DB_*
# - .env z DATABASE_URL (lokalna baza, np. mysql://root@localhost:3306/hotel_pms)
#
# Opcja -SkipImport: tylko sciagnij zrzut, nie importuj (np. do recznego importu).

param([switch]$SkipImport)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$DumpFileName = "hotel_prod_dump.sql"
$LocalDumpPath = Join-Path $ProjectRoot $DumpFileName

# --- Wczytaj .env.deploy ---
$envDeploy = Join-Path $ProjectRoot ".env.deploy"
if (-not (Test-Path $envDeploy)) {
    Write-Host "[BLAD] Brak pliku .env.deploy" -ForegroundColor Red
    exit 1
}
Get-Content $envDeploy | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $key = $matches[1].Trim(); $val = $matches[2].Trim().Trim('"')
        Set-Variable -Name $key -Value $val -Scope Script
    }
}
$SSH_USER = $DEPLOY_SSH_USER
$SSH_HOST = $DEPLOY_SSH_HOST
$DB_HOST = $DEPLOY_DB_HOST
$DB_USER = $DEPLOY_DB_USER
$DB_PASS = $DEPLOY_DB_PASS
$DB_NAME = $DEPLOY_DB_NAME
$SSH_TARGET = $SSH_USER + "@" + $SSH_HOST
$keyPath = Join-Path $env:USERPROFILE ".ssh\id_ed25519"
$sshScpArgs = if (Test-Path $keyPath) { @("-i", $keyPath) } else { @() }

# --- Eksport na serwerze (mysqldump przez SSH) ---
Write-Host "=== 1/3 Eksport bazy na serwerze (mysqldump) ===" -ForegroundColor Cyan
$SafePass = $DB_PASS -replace "'", "'\\''"
$RemoteScript = @"
set -e
mysqldump -h $DB_HOST -u $DB_USER -p'$SafePass' --single-transaction --quick $DB_NAME > ~/$DumpFileName 2>/dev/null
echo DEPLOY_DUMP_OK
"@
$RemoteScript | ssh @sshScpArgs $SSH_TARGET "bash -s"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[BLAD] Eksport na serwerze nie powiodl sie. Sprawdz haslo SSH i dostep do MySQL." -ForegroundColor Red
    exit 1
}
$Check = ssh @sshScpArgs $SSH_TARGET "test -f ~/$DumpFileName && wc -c ~/$DumpFileName"
if (-not $Check -or $Check -match "^\s*0\s") {
    Write-Host "[BLAD] Plik zrzutu na serwerze jest pusty lub brak. Sprawdz DEPLOY_DB_* w .env.deploy." -ForegroundColor Red
    exit 1
}
Write-Host "Zrzut na serwerze: $Check" -ForegroundColor Green

# --- Pobierz plik (SCP) ---
Write-Host "`n=== 2/3 Pobieranie pliku (SCP) ===" -ForegroundColor Cyan
if (Test-Path $LocalDumpPath) { Remove-Item $LocalDumpPath -Force }
scp @sshScpArgs "${SSH_TARGET}:~/$DumpFileName" $LocalDumpPath
if (-not (Test-Path $LocalDumpPath)) {
    Write-Host "[BLAD] Nie pobrano pliku. Haslo SCP?" -ForegroundColor Red
    exit 1
}
$size = (Get-Item $LocalDumpPath).Length
Write-Host "Pobrano: $LocalDumpPath ($([math]::Round($size/1MB, 2)) MB)" -ForegroundColor Green

# Usun zrzut na serwerze (oszczednosc miejsca)
ssh @sshScpArgs $SSH_TARGET "rm -f ~/$DumpFileName" 2>$null

if ($SkipImport) {
    Write-Host "`nPomieto import ( -SkipImport ). Plik: $LocalDumpPath" -ForegroundColor Yellow
    exit 0
}

# --- Parsuj lokalna DATABASE_URL z .env ---
$envLocal = Join-Path $ProjectRoot ".env"
$LocalUrl = ""
if (Test-Path $envLocal) {
    $line = Get-Content $envLocal | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if ($line -match '=\s*["'']?([^"''\s]+)["'']?') { $LocalUrl = $matches[1] }
}
if (-not $LocalUrl -or $LocalUrl -notmatch 'mysql://') {
    Write-Host "[BLAD] W .env nie ma DATABASE_URL (mysql://...). Ustaw lokalna baze." -ForegroundColor Red
    exit 1
}
# mysql://user:pass@host:3306/dbname lub mysql://user@host:3306/dbname
if ($LocalUrl -match 'mysql://([^:]+)(?::([^@]+))?@([^:]+):(\d+)/(.+)') {
    $LocalUser = $matches[1]
    $LocalPass = $matches[2]
    $LocalHost = $matches[3]
    $LocalPort = $matches[4]
    $LocalDb   = $matches[5]
} else {
    Write-Host "[BLAD] Nie mozna sparsowac DATABASE_URL: $LocalUrl" -ForegroundColor Red
    exit 1
}

# --- Import do lokalnej bazy ---
Write-Host "`n=== 3/3 Import do lokalnej bazy ($LocalHost / $LocalDb) ===" -ForegroundColor Cyan
$mysqlExe = Get-Command mysql -ErrorAction SilentlyContinue
if (-not $mysqlExe) {
    $mysqlExe = Get-Command "C:\xampp\mysql\bin\mysql.exe" -ErrorAction SilentlyContinue
}
if (-not $mysqlExe) {
    Write-Host "[BLAD] Nie znaleziono mysql w PATH. Dodaj np. C:\xampp\mysql\bin do PATH lub uruchom import recznie:" -ForegroundColor Red
    Write-Host "  mysql -u $LocalUser -h $LocalHost -P $LocalPort $LocalDb < `"$LocalDumpPath`"" -ForegroundColor Yellow
    exit 1
}
$mysqlPath = $mysqlExe.Source
$args = @("-u", $LocalUser, "-h", $LocalHost, "-P", $LocalPort, "--default-character-set=utf8mb4", $LocalDb)
if ($LocalPass) { $args = @("-u", $LocalUser, "-p$LocalPass", "-h", $LocalHost, "-P", $LocalPort, "--default-character-set=utf8mb4", $LocalDb) }
Get-Content $LocalDumpPath -Raw -Encoding UTF8 | & $mysqlPath $args 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[OSTRZEZENIE] Import mogl zwrocic bledy (np. duplikaty). Sprawdz aplikacje." -ForegroundColor Yellow
} else {
    Write-Host "Import zakonczony." -ForegroundColor Green
}

Write-Host "`nGotowe. Uruchom ponownie serwer (npm run dev) i odswiez Recepcje." -ForegroundColor Green
Write-Host "Plik zrzutu zachowany: $LocalDumpPath (mozna usunac po sprawdzeniu)" -ForegroundColor Gray
