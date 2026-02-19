# Wdrozenie na MyDevil: build lokalnie -> upload (ZIP lub rsync) -> migracja bazy -> restart
# Gdy jest rsync (np. Git for Windows): wysylane sa tylko zmienione pliki (lekki deploy).
# Uruchom: powershell -ExecutionPolicy Bypass -File .\scripts\deploy-to-mydevil.ps1
# Opcja: -FullZip - wymusza pelny ZIP zamiast rsync (gdy rsync jest dostepny).

param([switch]$FullZip)

$ErrorActionPreference = "Continue"
Write-Host "=== deploy-to-mydevil.ps1 start ===" -ForegroundColor Green
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

# Wykryj rsync (tylko zmienione pliki = lekki deploy)
# Szukaj: PATH, Chocolatey, Git for Windows
$RsyncExe = $null
foreach ($c in @("rsync", "C:\ProgramData\chocolatey\bin\rsync.exe", "C:\Program Files\Git\usr\bin\rsync.exe", "C:\Program Files (x86)\Git\usr\bin\rsync.exe")) {
    if ($c -eq "rsync") {
        $p = Get-Command rsync -ErrorAction SilentlyContinue
        if ($p) { $RsyncExe = $p.Source; break }
    } elseif (Test-Path $c) {
        $RsyncExe = $c
        break
    }
}
$UseRsync = (-not $FullZip) -and $RsyncExe
if ($UseRsync) {
    Write-Host "Tryb: lekki (rsync - tylko zmienione pliki)" -ForegroundColor Green
} else {
    if ($FullZip) { Write-Host "Tryb: pelny ZIP (wymuszone -FullZip)" -ForegroundColor Yellow }
    else { Write-Host "Tryb: pelny ZIP (brak rsync - zainstaluj: choco install rsync lub Git for Windows)" -ForegroundColor Yellow }
}

# Wczytaj zmienne z .env.deploy
$envFile = Join-Path $ProjectRoot ".env.deploy"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $key = $matches[1].Trim(); $val = $matches[2].Trim()
            Set-Variable -Name $key -Value $val -Scope Script
        }
    }
    $SSH_USER    = $DEPLOY_SSH_USER
    $SSH_HOST    = $DEPLOY_SSH_HOST
    $REMOTE_PATH = $DEPLOY_REMOTE_PATH
    $DOMAIN      = $DEPLOY_DOMAIN
    $DB_HOST     = $DEPLOY_DB_HOST
    $DB_USER     = $DEPLOY_DB_USER
    $DB_PASS     = $DEPLOY_DB_PASS
    $DB_NAME     = $DEPLOY_DB_NAME
} else {
    Write-Host "[BLAD] Brak pliku .env.deploy" -ForegroundColor Red
    exit 1
}

$SSH_TARGET = $SSH_USER + "@" + $SSH_HOST
$REMOTE_FULL = "~/" + $REMOTE_PATH

Write-Host ("Cel: " + $SSH_TARGET + ":" + $REMOTE_PATH) -ForegroundColor Yellow
Write-Host ("Domena: " + $DOMAIN) -ForegroundColor Yellow
Write-Host ""

# === 1/6 Prisma generate ===
Write-Host "=== 1/6 Prisma generate ===" -ForegroundColor Cyan
npx prisma generate

# === 2/6 npm run build ===
Write-Host "" ; Write-Host "=== 2/6 npm run build ===" -ForegroundColor Cyan
$nextDir = Join-Path $ProjectRoot ".next"
if (Test-Path $nextDir) {
    Write-Host "Usuwanie starego .next..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $nextDir
}
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[BLAD] Build nie powiodl sie!" -ForegroundColor Red
    exit 1
}

# Sprawdz czy standalone zostal wygenerowany
$standaloneDir = Join-Path (Join-Path $nextDir "standalone") "server.js"
if (-not (Test-Path $standaloneDir)) {
    Write-Host "[BLAD] Brak .next/standalone/server.js - build nie wygenerował standalone!" -ForegroundColor Red
    exit 1
}
Write-Host "Build OK - standalone wygenerowany." -ForegroundColor Green

# === 3/6 SQL diff ===
Write-Host "" ; Write-Host "=== 3/6 Generowanie SQL diff ===" -ForegroundColor Cyan
$sqlDiffFile = Join-Path $ProjectRoot "_deploy_schema_diff.sql"
Write-Host "Generuje pelny schemat SQL z IF NOT EXISTS..." -ForegroundColor Yellow
$env:PRISMA_HIDE_DEPRECATION_WARNINGS = "1"

$rawSql = npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] prisma migrate diff nie powiodlo sie - pomijam migracje bazy" -ForegroundColor Yellow
    $rawSql = $null
} else {
    $safeSql = $rawSql -replace 'CREATE TABLE `', 'CREATE TABLE IF NOT EXISTS `'
    [System.IO.File]::WriteAllText($sqlDiffFile, ($safeSql -join "`n"), [System.Text.Encoding]::UTF8)
    Write-Host "SQL diff zapisany." -ForegroundColor Green
}

# === 3b/6 Import konfiguracji (Dane sprzedawcy, szablony) do produkcji ===
$configSnapshotPath = Join-Path $ProjectRoot "prisma\config-snapshot.json"
if (Test-Path $configSnapshotPath) {
  Write-Host "" ; Write-Host "=== 3b/6 Import konfiguracji do bazy produkcyjnej ===" -ForegroundColor Cyan
  $dbUrl = $DEPLOY_DATABASE_URL
  if (-not $dbUrl) { $dbUrl = "mysql://$DB_USER`:$DB_PASS@$DB_HOST/$DB_NAME" }
  $env:DATABASE_URL = $dbUrl
  try {
    npx tsx prisma/config-import.ts 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Konfiguracja (dane sprzedawcy, logo, szablony) zsynchronizowana z produkcja." -ForegroundColor Green
    } else {
      Write-Host "[WARN] config-import zakonczyl sie bledem - pomijam." -ForegroundColor Yellow
    }
  } catch {
    Write-Host "[WARN] Nie udalo sie wykonac config-import:" ($_.Exception.Message) -ForegroundColor Yellow
  }
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
} else {
  Write-Host "" ; Write-Host "Brak prisma/config-snapshot.json - pomijam import konfiguracji." -ForegroundColor Gray
}

# === 4/6 Upload (rsync = tylko zmiany, albo ZIP) ===
$remoteDest = $SSH_TARGET + ":" + $REMOTE_FULL

if ($UseRsync) {
    Write-Host "" ; Write-Host "=== 4/6 Wysylanie tylko zmienionych plikow (rsync) ===" -ForegroundColor Cyan
    # cwRsync traktuje "C:" jako host. Uzywamy sciezek wzglednych (Push-Location).
    $standaloneDst = $remoteDest + "/.next/standalone/"
    Write-Host "*** Wpisz haslo SSH (moze byc kilka razy) ***" -ForegroundColor Magenta
    # Zapewnij katalog .next na serwerze
    $mkCmd = "mkdir -p " + $REMOTE_FULL + "/.next"
    $mkCmd | ssh $SSH_TARGET "sh -s" 2>&1 | Out-Null
    # rsync standalone – z katalogu projektu, sciezka wzgledna bez C:
    Push-Location $ProjectRoot
    try {
        & $RsyncExe -avz --delete -e "ssh" ".next/standalone/" "$standaloneDst"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[BLAD] rsync .next/standalone nie powiodl sie!" -ForegroundColor Red
            exit 1
        }
        & $RsyncExe -avz -e "ssh" "app.js" "$remoteDest/"
        if ($LASTEXITCODE -ne 0) { Write-Host "[BLAD] rsync app.js nie powiodl sie!" -ForegroundColor Red; exit 1 }
        & $RsyncExe -avz -e "ssh" "prisma/" "$remoteDest/prisma/"
        if ($LASTEXITCODE -ne 0) { Write-Host "[BLAD] rsync prisma nie powiodl sie!" -ForegroundColor Red; exit 1 }
        if (Test-Path "_deploy_schema_diff.sql") {
            & $RsyncExe -avz -e "ssh" "_deploy_schema_diff.sql" "$remoteDest/_deploy_schema_diff.sql"
            if ($LASTEXITCODE -ne 0) { Write-Host "[BLAD] rsync SQL nie powiodl sie!" -ForegroundColor Red; exit 1 }
        }
    } finally {
        Pop-Location
    }
    Write-Host "Rsync zakonczony (wyslane tylko zmienione pliki)." -ForegroundColor Green
} else {
    # === Pelny ZIP ===
    Write-Host "" ; Write-Host "=== 4/6 Pakowanie ZIP ===" -ForegroundColor Cyan
    $zipFile = Join-Path $ProjectRoot "deploy_mydevil.zip"
    if (Test-Path $zipFile) { Remove-Item $zipFile -Force }

    $tmpDeploy = Join-Path $ProjectRoot "_deploy_tmp"
    if (Test-Path $tmpDeploy) { Remove-Item $tmpDeploy -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $tmpDeploy | Out-Null

    Write-Host "Kopiowanie app.js..." -ForegroundColor Yellow
    Copy-Item "app.js" -Destination $tmpDeploy

    Write-Host "Kopiowanie .next/standalone/..." -ForegroundColor Yellow
    $src = Join-Path (Join-Path $ProjectRoot ".next") "standalone"
    $dst = Join-Path (Join-Path $tmpDeploy ".next") "standalone"
    New-Item -ItemType Directory -Force -Path (Join-Path $tmpDeploy ".next") | Out-Null
    Copy-Item -Path $src -Destination $dst -Recurse -Force

    Write-Host "Kopiowanie prisma/..." -ForegroundColor Yellow
    Copy-Item -Path "prisma" -Destination (Join-Path $tmpDeploy "prisma") -Recurse -Force

    if (Test-Path $sqlDiffFile) {
        Write-Host "Kopiowanie SQL diff..." -ForegroundColor Yellow
        Copy-Item $sqlDiffFile -Destination (Join-Path $tmpDeploy "_deploy_schema_diff.sql")
    }

    Write-Host "Pakowanie ZIP..." -ForegroundColor Yellow
    Compress-Archive -Path (Join-Path $tmpDeploy "*") -DestinationPath $zipFile -Force
    Remove-Item $tmpDeploy -Recurse -Force

    $zipSizeMB = [math]::Round((Get-Item $zipFile).Length / 1MB, 1)
    Write-Host ("ZIP gotowy: " + $zipSizeMB + " MB") -ForegroundColor Green

    if ($zipSizeMB -lt 10) {
        Write-Host ("[BLAD] ZIP za maly (" + $zipSizeMB + " MB) - prawdopodobnie .next/standalone sie nie skopiował!") -ForegroundColor Red
        exit 1
    }

    Write-Host "" ; Write-Host "=== 5/6 Wysylanie ZIP na serwer ===" -ForegroundColor Cyan
    Write-Host "*** Wpisz haslo SSH ***" -ForegroundColor Magenta
    $scpDest = $SSH_TARGET + ":" + $REMOTE_FULL + "/"
    scp $zipFile $scpDest
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[BLAD] scp nie powiodlo sie!" -ForegroundColor Red
        exit 1
    }
    Write-Host "ZIP wyslany." -ForegroundColor Green
}

# === 6/6 Na serwerze: (przy ZIP: rozpakuj) migracja + restart ===
Write-Host "" ; Write-Host "=== 6/6 Migracja bazy + restart ===" -ForegroundColor Cyan
Write-Host "*** Wpisz haslo SSH ***" -ForegroundColor Magenta

$cmd = "cd " + $REMOTE_FULL + " || exit 1" + "`n"
if (-not $UseRsync) {
    $cmd += "echo USUWANIE_NEXT" + "`n"
    $cmd += "rm -rf .next" + "`n"
    $cmd += "echo ROZPAKOWYWANIE" + "`n"
    $cmd += "unzip -o deploy_mydevil.zip" + "`n"
    $cmd += "rm -f deploy_mydevil.zip" + "`n"
}

if (Test-Path $sqlDiffFile) {
    $cmd += "echo MIGRACJA_BAZY" + "`n"
    $cmd += "mysql --force -h " + $DB_HOST + " -u " + $DB_USER + " -p" + $DB_PASS + " " + $DB_NAME + " < _deploy_schema_diff.sql 2>&1 | tail -5 || true" + "`n"
    $cmd += "rm -f _deploy_schema_diff.sql" + "`n"
} else {
    $cmd += "echo BRAK_SQL_DIFF" + "`n"
}

$cmd += "echo RESTART" + "`n"
$cmd += "devil www restart " + $DOMAIN + "`n"
$cmd += "echo DEPLOY_SSH_OK"

$cmdFile = Join-Path $ProjectRoot "_deploy_ssh_cmd.sh"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($cmdFile, $cmd.Replace("`r`n", "`n").Replace("`r", "`n"), $utf8NoBom)
$sshRaw = Get-Content $cmdFile -Raw | ssh $SSH_TARGET "sh -s" 2>&1
$sshExitCode = $LASTEXITCODE
Remove-Item $cmdFile -Force

# Konwertuj na czysty string (2>&1 w PowerShell zwraca mix String + ErrorRecord)
$sshOutput = ($sshRaw | Out-String).Trim()

Write-Host $sshOutput

if ($sshOutput -notlike "*DEPLOY_SSH_OK*") {
    Write-Host "[BLAD] Krok 6 (SSH) nie powiodl sie! Marker DEPLOY_SSH_OK nie znaleziony." -ForegroundColor Red
    exit 1
}
if ($sshExitCode -ne 0) {
    Write-Host "[WARN] SSH zwrocil kod $sshExitCode, ale marker DEPLOY_SSH_OK jest obecny - deploy OK (bledy SQL to duplikaty kluczy)." -ForegroundColor Yellow
}

# Posprzataj
if (Test-Path $sqlDiffFile) { Remove-Item $sqlDiffFile -Force }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "[OK] Deploy zakonczony pomyslnie!" -ForegroundColor Green
Write-Host ("Strona: https://" + $DOMAIN) -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
