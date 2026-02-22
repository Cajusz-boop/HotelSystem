# =============================================================================
# Synchronizacja bazy danych: Hetzner -> Serwer Lokalny
# Uruchom na komputerze który ma dostęp SSH do Hetzner
# =============================================================================

param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$HETZNER_HOST = "hetzner"
$HETZNER_DB_USER = "hotel"
$HETZNER_DB_PASS = "HotelPMS2024#Secure"
$HETZNER_DB_NAME = "hotel_pms"

$LOCAL_HOST = "10.119.169.20"
$LOCAL_DB_USER = "root"
$LOCAL_DB_PASS = "root123"
$LOCAL_DB_NAME = "hotel_pms"

$DUMP_FILE = "$env:TEMP\hotel_pms_dump.sql"

Write-Host ""
Write-Host "=== SYNCHRONIZACJA BAZY DANYCH ===" -ForegroundColor Cyan
Write-Host "Kierunek: Hetzner -> Serwer Lokalny ($LOCAL_HOST)"
Write-Host ""

if (-not $Force) {
    Write-Host "UWAGA: To nadpisze dane na serwerze lokalnym!" -ForegroundColor Yellow
    $confirm = Read-Host "Kontynuować? (t/n)"
    if ($confirm -ne "t") {
        Write-Host "Anulowano."
        exit 0
    }
}

# Krok 1: Dump z Hetzner
Write-Host ""
Write-Host "[1/3] Pobieranie danych z Hetzner..." -ForegroundColor Green
$dumpCmd = "mysqldump -u $HETZNER_DB_USER -p'$HETZNER_DB_PASS' --single-transaction --routines --triggers $HETZNER_DB_NAME"
ssh $HETZNER_HOST $dumpCmd > $DUMP_FILE 2>$null

if (-not (Test-Path $DUMP_FILE) -or (Get-Item $DUMP_FILE).Length -lt 1000) {
    Write-Host "BLAD: Nie udalo sie pobrac dumpa z Hetzner" -ForegroundColor Red
    exit 1
}

$dumpSize = [math]::Round((Get-Item $DUMP_FILE).Length / 1MB, 2)
Write-Host "       Pobrano: $dumpSize MB" -ForegroundColor Gray

# Krok 2: Import na lokalny serwer
Write-Host ""
Write-Host "[2/3] Importowanie na serwer lokalny ($LOCAL_HOST)..." -ForegroundColor Green

# Używamy mysql przez sieć
$mysqlPath = "mysql"
try {
    & $mysqlPath -h $LOCAL_HOST -u $LOCAL_DB_USER -p"$LOCAL_DB_PASS" $LOCAL_DB_NAME -e "SELECT 1" 2>$null | Out-Null
} catch {
    Write-Host "BLAD: Nie mozna polaczyc z serwerem lokalnym $LOCAL_HOST" -ForegroundColor Red
    Write-Host "Sprawdz czy MySQL na serwerze lokalnym akceptuje polaczenia zdalne." -ForegroundColor Yellow
    exit 1
}

Get-Content $DUMP_FILE | & $mysqlPath -h $LOCAL_HOST -u $LOCAL_DB_USER -p"$LOCAL_DB_PASS" $LOCAL_DB_NAME 2>$null

# Krok 3: Weryfikacja
Write-Host ""
Write-Host "[3/3] Weryfikacja..." -ForegroundColor Green

$localCount = & $mysqlPath -h $LOCAL_HOST -u $LOCAL_DB_USER -p"$LOCAL_DB_PASS" $LOCAL_DB_NAME -N -e "SELECT COUNT(*) FROM Room" 2>$null
Write-Host "       Pokoi na serwerze lokalnym: $localCount" -ForegroundColor Gray

# Cleanup
Remove-Item $DUMP_FILE -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== SYNCHRONIZACJA ZAKONCZONA ===" -ForegroundColor Cyan
Write-Host ""
