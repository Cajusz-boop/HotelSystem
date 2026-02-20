# Wdrozenie na MyDevil: build lokalnie -> upload (delta tar+scp) -> migracja bazy -> restart
# Transfer: manifest MD5 -> diff -> tar tylko zmienionych + scp (bez rsync).
# Uruchom: powershell -ExecutionPolicy Bypass -File .\scripts\deploy-to-mydevil.ps1
# Opcja: -FullZip - wymusza pelny ZIP (wszystko w jednym archiwum, wolniejszy ale prostszy).

param([switch]$FullZip)

$ErrorActionPreference = "Continue"
Write-Host "=== deploy-to-mydevil.ps1 start ===" -ForegroundColor Green
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if ($FullZip) {
    Write-Host "Tryb: pelny ZIP (wymuszone -FullZip)" -ForegroundColor Yellow
} else {
    Write-Host "Tryb: lekki (delta tar+scp - tylko zmienione pliki)" -ForegroundColor Green
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
$keyPath = Join-Path $env:USERPROFILE ".ssh\id_ed25519"

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
$standaloneCheck = Join-Path (Join-Path $nextDir "standalone") "server.js"
if (-not (Test-Path $standaloneCheck)) {
    Write-Host "[BLAD] Brak .next/standalone/server.js - build nie wygenerowal standalone!" -ForegroundColor Red
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
    $sqlContent = ($safeSql -join "`n") + @"

-- Migracja: nazwa produktu noclegowego w szablonie faktury (ALTER ignorowany jesli kolumna juz jest)
ALTER TABLE InvoiceTemplate ADD COLUMN roomProductName VARCHAR(191) NULL;
-- Migracja: nadpisanie ceny za dobę w rezerwacji (mysql --force ignoruje błąd gdy kolumna już jest)
ALTER TABLE Reservation ADD COLUMN rateCodePrice DECIMAL(10,2) NULL;
"@
    [System.IO.File]::WriteAllText($sqlDiffFile, $sqlContent, [System.Text.Encoding]::UTF8)
    Write-Host "SQL diff zapisany." -ForegroundColor Green
}

# === 3a/6 Eksport konfiguracji z lokalnej bazy (snapshot jest aktualny przed deployem) ===
Write-Host "" ; Write-Host "=== 3a/6 Eksport konfiguracji z lokalnej bazy ===" -ForegroundColor Cyan
try {
    npx tsx prisma/config-export.ts 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -eq 0) {
        Write-Host "config-snapshot.json zaktualizowany z lokalnej bazy." -ForegroundColor Green
    } else {
        Write-Host "[WARN] config-export zakonczyl sie bledem - uzywa istniejacego snapshot." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARN] Brak lokalnej bazy lub blad exportu - uzywa istniejacego config-snapshot.json" -ForegroundColor Yellow
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

# === 4/6 Upload plikow na serwer (delta transfer: manifest MD5 -> tar delta -> scp) ===
if (-not $FullZip) {
    # === Tryb lekki: delta transfer bez rsync (manifest + tar+scp) ===
    Write-Host "" ; Write-Host "=== 4/6 Wysylanie plikow (delta tar+scp) ===" -ForegroundColor Cyan

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $manifestLocal = Join-Path $ProjectRoot "_deploy_manifest_local.txt"
    $manifestRemote = Join-Path $ProjectRoot "_deploy_manifest_remote.txt"
    $changedList = Join-Path $ProjectRoot "_deploy_changed.txt"
    $deletedList = Join-Path $ProjectRoot "_deploy_deleted.txt"
    $deltaTar = Join-Path $ProjectRoot "_deploy_delta.tar.gz"

    @($manifestLocal, $manifestRemote, $changedList, $deletedList, $deltaTar) | ForEach-Object {
        if (Test-Path $_) { Remove-Item $_ -Force }
    }

    # --- 4a: Generuj manifest lokalny (MD5, format: HASH  sciezka) ---
    Write-Host "Generowanie manifestu lokalnego (MD5, rownolegle)..." -ForegroundColor Yellow
    $rootNorm = $ProjectRoot.TrimEnd('\', '/') + '\'
    $allFiles = [System.Collections.ArrayList]::new()
    $standalonePath = Join-Path $ProjectRoot ".next\standalone"
    if (Test-Path $standalonePath) {
        Get-ChildItem -Path $standalonePath -Recurse -File | ForEach-Object { [void]$allFiles.Add($_.FullName) }
    }
    $appJsPath = Join-Path $ProjectRoot "app.js"
    if (Test-Path $appJsPath) { [void]$allFiles.Add($appJsPath) }
    $prismaPath = Join-Path $ProjectRoot "prisma"
    if (Test-Path $prismaPath) {
        Get-ChildItem -Path $prismaPath -Recurse -File | ForEach-Object { [void]$allFiles.Add($_.FullName) }
    }

    $manifestLines = @()
    $maxParallel = [Math]::Max(4, [System.Environment]::ProcessorCount - 1)
    $runspacePool = [runspacefactory]::CreateRunspacePool(1, $maxParallel)
    $runspacePool.Open()
    try {
        $jobs = New-Object System.Collections.ArrayList
        foreach ($fullPath in $allFiles) {
            $pathCopy = $fullPath
            $scriptBlock = {
                param([string]$path, [string]$root)
                $h = Get-FileHash -Path $path -Algorithm MD5 -ErrorAction SilentlyContinue
                if ($h) {
                    $rel = $path.Replace($root, "").Replace("\", "/")
                    return $h.Hash.ToLower() + "  " + $rel
                }
                return $null
            }
            $ps = [powershell]::Create().AddScript($scriptBlock).AddArgument($pathCopy).AddArgument($rootNorm)
            $ps.RunspacePool = $runspacePool
            [void]$jobs.Add([pscustomobject]@{ Pipe = $ps; Handle = $ps.BeginInvoke() })
        }
        foreach ($j in $jobs) {
            $r = $j.Pipe.EndInvoke($j.Handle)
            if ($r) { $manifestLines += $r }
            $j.Pipe.Dispose()
        }
    } finally {
        $runspacePool.Close()
        $runspacePool.Dispose()
    }

    [System.IO.File]::WriteAllLines($manifestLocal, $manifestLines, $utf8NoBom)
    Write-Host ("Manifest: " + $manifestLines.Count + " plikow") -ForegroundColor Gray

    # --- 4b: Pobierz manifest z serwera ---
    Write-Host "Pobieranie manifestu z serwera..." -ForegroundColor Yellow
    scp -i $keyPath ($SSH_TARGET + ":" + $REMOTE_FULL + "/_deploy_manifest.txt") $manifestRemote 2>$null | Out-Null
    $hasRemoteManifest = Test-Path $manifestRemote
    if (-not $hasRemoteManifest) {
        Write-Host "Brak manifestu na serwerze - pelny transfer (pierwszy deploy)." -ForegroundColor Yellow
    }

    # --- 4c: Porownaj manifesty ---
    $changedFiles = @()
    $deletedFiles = @()

    if ($hasRemoteManifest) {
        $remoteLines = Get-Content $manifestRemote | Where-Object { $_.Trim() -ne "" }
        $remoteMap = @{}
        foreach ($line in $remoteLines) {
            if ($line -match '^([a-f0-9]{32})\s+(.+)$') {
                $remoteMap[$matches[2].Trim()] = $matches[1]
            }
        }
        $localLines = Get-Content $manifestLocal | Where-Object { $_.Trim() -ne "" }
        $localMap = @{}
        foreach ($line in $localLines) {
            if ($line -match '^([a-f0-9]{32})\s+(.+)$') {
                $localMap[$matches[2].Trim()] = $matches[1]
            }
        }
        foreach ($path in $localMap.Keys) {
            if (-not $remoteMap.ContainsKey($path) -or $remoteMap[$path] -ne $localMap[$path]) {
                $changedFiles += $path
            }
        }
        foreach ($path in $remoteMap.Keys) {
            if (-not $localMap.ContainsKey($path)) {
                $deletedFiles += $path
            }
        }
    } else {
        $changedFiles = $manifestLines | ForEach-Object {
            if ($_ -match '^[a-f0-9]{32}\s+(.+)$') { $matches[1].Trim() }
        } | Where-Object { $_ }
    }

    Write-Host ("Zmienionych/nowych: " + $changedFiles.Count + ", do usuniecia: " + $deletedFiles.Count) -ForegroundColor Cyan

    # --- 4d: Pakuj TYLKO zmienione pliki ---
    if ($changedFiles.Count -gt 0) {
        # Walidacja: tylko sciezki do istniejacych plikow (unikamy "Couldn't visit directory")
        $validPaths = @()
        foreach ($p in $changedFiles) {
            $winPath = $p.Replace("/", [System.IO.Path]::DirectorySeparatorChar)
            $fullPath = Join-Path $ProjectRoot $winPath
            if (Test-Path $fullPath -PathType Leaf) {
                $validPaths += $p
            } else {
                Write-Host "Pomijam (brak pliku): $p" -ForegroundColor DarkGray
            }
        }
        if ($validPaths.Count -eq 0) {
            Write-Host "[WARN] Wszystkie sciezki pominiete - brak plikow do wyslania." -ForegroundColor Yellow
        } else {
            # tar na Windows: forward slash dziala, cudzyslowy przy spacjach w sciezkach
            [System.IO.File]::WriteAllLines($changedList, $validPaths, $utf8NoBom)
            if (Test-Path $deltaTar) { Remove-Item $deltaTar -Force }
            $tarErr = & tar -czf $deltaTar -C $ProjectRoot -T $changedList 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[BLAD] tar delta nie powiodl sie!" -ForegroundColor Red
                Write-Host $tarErr -ForegroundColor Red
                exit 1
            }
            $sizeMB = [math]::Round((Get-Item $deltaTar).Length / 1MB, 1)
            Write-Host ("Delta: " + $validPaths.Count + " plikow, " + $sizeMB + " MB") -ForegroundColor Green

            Write-Host "Wysylanie delta na serwer..." -ForegroundColor Yellow
            scp -i $keyPath $deltaTar ($SSH_TARGET + ":" + $REMOTE_FULL + "/")
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[BLAD] scp delta nie powiodl sie!" -ForegroundColor Red
                exit 1
            }
            Write-Host "Rozpakowywanie delta na serwerze (usun stary .next/static, potem extract)..." -ForegroundColor Yellow
            ssh -i $keyPath $SSH_TARGET ("cd " + $REMOTE_FULL + " && rm -rf .next/standalone/.next/static && tar -xzf _deploy_delta.tar.gz && rm -f _deploy_delta.tar.gz")
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[BLAD] Rozpakowanie delta na serwerze nie powiodlo sie!" -ForegroundColor Red
                exit 1
            }
            Write-Host "Delta OK" -ForegroundColor Green
        }
    } else {
        Write-Host "Brak zmienionych plikow - pomijam transfer delta." -ForegroundColor Green
    }

    # --- 4e: Usun pliki ktore zniknely (rsync --delete) ---
    if ($deletedFiles.Count -gt 0) {
        [System.IO.File]::WriteAllLines($deletedList, $deletedFiles, $utf8NoBom)
        scp -i $keyPath $deletedList ($SSH_TARGET + ":" + $REMOTE_FULL + "/_deploy_deleted.txt")
        if ($LASTEXITCODE -eq 0) {
            ssh -i $keyPath $SSH_TARGET ("cd " + $REMOTE_FULL + " && while read -r f; do rm -f `"`$f`"; done < _deploy_deleted.txt; rm -f _deploy_deleted.txt")
            if ($LASTEXITCODE -eq 0) {
                Write-Host ("Usunieto " + $deletedFiles.Count + " plikow na serwerze.") -ForegroundColor Green
            } else {
                Write-Host "[WARN] Usuwanie usunietych plikow moglo sie nie powiesc" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[WARN] Nie udalo sie wyslac listy do usuniecia" -ForegroundColor Yellow
        }
    }

    # --- 4f: Zapisz nowy manifest na serwerze ---
    Write-Host "Aktualizacja manifestu na serwerze..." -ForegroundColor Yellow
    scp -i $keyPath $manifestLocal ($SSH_TARGET + ":" + $REMOTE_FULL + "/_deploy_manifest.txt")
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARN] Zapis manifestu nie powiodl sie" -ForegroundColor Yellow
    }

    # --- 4g: SQL diff (jesli istnieje) ---
    if (Test-Path $sqlDiffFile) {
        Write-Host "Wysylanie SQL diff..." -ForegroundColor Yellow
        scp -i $keyPath $sqlDiffFile ($SSH_TARGET + ":" + $REMOTE_FULL + "/_deploy_schema_diff.sql")
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[BLAD] scp SQL nie powiodl sie!" -ForegroundColor Red
            exit 1
        }
        Write-Host "SQL diff OK" -ForegroundColor Green
    }

    # Posprzataj pliki tymczasowe
    @($manifestLocal, $manifestRemote, $changedList, $deletedList, $deltaTar) | ForEach-Object {
        if (Test-Path $_) { Remove-Item $_ -Force -ErrorAction SilentlyContinue }
    }
    Write-Host "Transfer zakonczony." -ForegroundColor Green

} else {
    # === Pelny ZIP ===
    Write-Host "" ; Write-Host "=== 4/6 Pakowanie ZIP ===" -ForegroundColor Cyan
    $zipFile = Join-Path $ProjectRoot "deploy_mydevil.tar"
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

    Write-Host "Pakowanie ZIP (tar)..." -ForegroundColor Yellow
    Push-Location $tmpDeploy
    try {
        tar -cf $zipFile -C $tmpDeploy .
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[BLAD] tar nie powiodl sie!" -ForegroundColor Red
            exit 1
        }
    } finally {
        Pop-Location
    }
    Remove-Item $tmpDeploy -Recurse -Force

    $zipSizeMB = [math]::Round((Get-Item $zipFile).Length / 1MB, 1)
    Write-Host ("Archiwum gotowe: " + $zipSizeMB + " MB") -ForegroundColor Green

    if ($zipSizeMB -lt 10) {
        Write-Host ("[BLAD] Archiwum za male (" + $zipSizeMB + " MB) - prawdopodobnie .next/standalone sie nie skopiowal!") -ForegroundColor Red
        exit 1
    }

    Write-Host "" ; Write-Host "=== 5/6 Wysylanie ZIP na serwer ===" -ForegroundColor Cyan
    $scpDest = $SSH_TARGET + ":" + $REMOTE_FULL + "/"
    if (Test-Path $keyPath) {
      scp -i $keyPath $zipFile $scpDest
    } else {
      Write-Host "*** Wpisz haslo SSH (brak klucza w $keyPath) ***" -ForegroundColor Magenta
      scp $zipFile $scpDest
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[BLAD] scp nie powiodlo sie!" -ForegroundColor Red
        exit 1
    }
    Write-Host "ZIP wyslany." -ForegroundColor Green
}

# === 6/6 Na serwerze: (przy ZIP: rozpakuj) migracja + restart ===
Write-Host "" ; Write-Host "=== 6/6 Migracja bazy + restart ===" -ForegroundColor Cyan

$cmd = "cd " + $REMOTE_FULL + " || exit 1" + "`n"
if ($FullZip) {
    $cmd += "echo USUWANIE_NEXT" + "`n"
    $cmd += "rm -rf .next" + "`n"
    $cmd += "echo ROZPAKOWYWANIE" + "`n"
    $cmd += "tar xf deploy_mydevil.tar" + "`n"
    $cmd += "rm -f deploy_mydevil.tar" + "`n"
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
$sshArgs = if (Test-Path $keyPath) { @("-i", $keyPath, $SSH_TARGET) } else { @($SSH_TARGET) }
$sshRaw = Get-Content $cmdFile -Raw | ssh @sshArgs "sh -s" 2>&1
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
