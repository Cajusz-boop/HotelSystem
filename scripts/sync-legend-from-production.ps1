# Synchronizuje legendę rezerwacji (kolory statusów, etykiety) z produkcji do lokalnej bazy.
# Uruchom z katalogu projektu: powershell -ExecutionPolicy Bypass -File .\scripts\sync-legend-from-production.ps1
#
# Wymagania: .env.deploy (jak przy db:pull), SSH do hetzner, lokalna baza w .env

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

$LegendFile = Join-Path $ProjectRoot "scripts\.legend-from-prod.json"
$SqlFile = Join-Path $ProjectRoot "scripts\.legend-query.sql"

# --- Wczytaj .env.deploy (preferuj Hetzner - produkcja) ---
$envHetzner = Join-Path $ProjectRoot ".env.deploy.hetzner"
$envDeploy = Join-Path $ProjectRoot ".env.deploy"
$envToLoad = if (Test-Path $envHetzner) { $envHetzner } elseif (Test-Path $envDeploy) { $envDeploy } else { $null }
if (-not $envToLoad) {
    Write-Host "[BLAD] Brak .env.deploy.hetzner lub .env.deploy. Skopiuj z .env.deploy.hetzner." -ForegroundColor Red
    exit 1
}
$envDeploy = $envToLoad
Get-Content $envDeploy | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $key = $matches[1].Trim(); $val = $matches[2].Trim().Trim('"')
        Set-Variable -Name $key -Value $val -Scope Script
    }
}
$SSH_TARGET = $DEPLOY_SSH_USER + "@" + $DEPLOY_SSH_HOST
$DB_USER = $DEPLOY_DB_USER
$DB_PASS = $DEPLOY_DB_PASS
$DB_NAME = $DEPLOY_DB_NAME
$keyCandidate = if ($DEPLOY_SSH_KEY) {
    $DEPLOY_SSH_KEY -replace '^~', $env:USERPROFILE -replace '/', [IO.Path]::DirectorySeparatorChar
} else {
    Join-Path $env:USERPROFILE ".ssh\id_ed25519"
}
$keyPath = $keyCandidate
$sshScpArgs = if (Test-Path $keyPath) { @("-i", $keyPath) } else { @() }

# Plik SQL (UTF-8 bez BOM)
$SqlContent = "SELECT JSON_OBJECT('reservationStatusColors', reservationStatusColors, 'statusCombinationColors', statusCombinationColors, 'reservationStatusLabels', reservationStatusLabels, 'reservationStatusDescriptions', reservationStatusDescriptions, 'paymentStatusColors', paymentStatusColors) FROM Property LIMIT 1;"
[System.IO.File]::WriteAllText($SqlFile, $SqlContent, [System.Text.UTF8Encoding]::new($false))

# --- Eksport: SCP SQL, mysql na serwerze, wynik do zmiennej ---
Write-Host "Pobieram legende z produkcji..." -ForegroundColor Cyan
scp @sshScpArgs $SqlFile "${SSH_TARGET}:/tmp/legend_query.sql"
if ($LASTEXITCODE -ne 0) {
    Remove-Item $SqlFile -Force -ErrorAction SilentlyContinue
    Write-Host "[BLAD] Nie udalo sie skopiowac pliku SQL." -ForegroundColor Red
    exit 1
}

$SafePass = $DB_PASS -replace "'", "'\''"
$RemoteBash = "mysql -u $DB_USER -p'$SafePass' -h localhost $DB_NAME -N 2>/dev/null < /tmp/legend_query.sql; rm -f /tmp/legend_query.sql"
$Output = ssh @sshScpArgs $SSH_TARGET $RemoteBash 2>&1 | Out-String
Remove-Item $SqlFile -Force -ErrorAction SilentlyContinue

$Output = $Output.Trim()
if (-not $Output -or $Output -match "ERROR|Access denied") {
    Write-Host "[BLAD] Zapytanie MySQL na serwerze nie powiodlo sie." -ForegroundColor Red
    if ($Output) { Write-Host "Odpowiedz:" $Output }
    exit 1
}

[System.IO.File]::WriteAllText($LegendFile, $Output, [System.Text.UTF8Encoding]::new($false))
Write-Host "Zapisano: $LegendFile" -ForegroundColor Green

# --- Import do lokalnej bazy ---
Write-Host "Importuje do lokalnej bazy..." -ForegroundColor Cyan
npx tsx scripts/import-legend-to-local.ts $LegendFile
if ($LASTEXITCODE -ne 0) { exit 1 }

Remove-Item $LegendFile -Force -ErrorAction SilentlyContinue
Write-Host "Gotowe. Uruchom ponownie serwer (npm run dev) i odswiez Front Office." -ForegroundColor Green
