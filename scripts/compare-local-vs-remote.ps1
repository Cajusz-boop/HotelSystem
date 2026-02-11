# Porownanie plikow wgrywanych na mydevil (app.js + .next bez cache) z wersja na serwerze
# Pomija .next/cache - nie wplywa na dzialanie aplikacji. Wymaga SSH.
# Uzycie: .\scripts\compare-local-vs-remote.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

# Wczytaj .env.deploy
$envFile = Join-Path $ProjectRoot ".env.deploy"
if (-not (Test-Path $envFile)) {
    Write-Host "Brak .env.deploy - uzywam domyslnych z deploy-to-mydevil.ps1" -ForegroundColor Yellow
    $SSH_USER = "karczma-labedz"
    $SSH_HOST = "s5.mydevil.net"
    $REMOTE_PATH = "domains/hotel.karczma-labedz.pl/public_nodejs"
} else {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $val = $matches[2].Trim()
            Set-Variable -Name $key -Value $val -Scope Script
        }
    }
    $SSH_USER = $DEPLOY_SSH_USER
    $SSH_HOST = $DEPLOY_SSH_HOST
    $REMOTE_PATH = $DEPLOY_REMOTE_PATH
}

Write-Host "=== Porownanie (app.js + .next, bez cache): lokal vs ${SSH_USER}@${SSH_HOST} ===" -ForegroundColor Cyan
Write-Host ""

# 1) Lista plikow lokalnych: app.js + .next BEZ .next/cache (to samo co ma sens na serwerze)
$localBase = $ProjectRoot
$localFiles = @{}
if (Test-Path (Join-Path $localBase "app.js")) {
    $f = Get-Item (Join-Path $localBase "app.js")
    $localFiles["app.js"] = @{ Length = $f.Length; LastWrite = $f.LastWriteTimeUtc }
}
if (Test-Path (Join-Path $localBase ".next")) {
    Get-ChildItem -Path (Join-Path $localBase ".next") -Recurse -File | Where-Object {
        $_.FullName -notlike "*\.next\cache\*"
    } | ForEach-Object {
        $rel = $_.FullName.Substring($localBase.Length + 1).Replace("\", "/")
        $localFiles[$rel] = @{ Length = $_.Length; LastWrite = $_.LastWriteTimeUtc }
    }
}

Write-Host "Lokalnie: $($localFiles.Count) plikow (app.js + .next bez cache)" -ForegroundColor Gray

# 2) Lista plikow na serwerze (SSH), bez .next/cache - format "SIZE PATH"
$remoteListScript = @"
cd $REMOTE_PATH 2>/dev/null || exit 1
echo '---BEGIN---'
if [ -f app.js ]; then echo "`$(wc -c < app.js) app.js"; fi
if [ -d .next ]; then
  find .next -type f ! -path '.next/cache*' | while read f; do printf '%s %s\n' "`$(wc -c < "`$f")" "`$f"; done
fi
echo '---END---'
"@
$remoteListScript = $remoteListScript -replace "`r`n", "`n"

$remoteOutput = $null
try {
    $remoteOutput = $remoteListScript | ssh -o ConnectTimeout=10 -o BatchMode=no "${SSH_USER}@${SSH_HOST}" "sh -s" 2>&1
} catch {
    Write-Host "Blad SSH (sprawdz haslo/klucz): $_" -ForegroundColor Red
    exit 1
}

$remoteFiles = @{}
$inBlock = $false
$remoteOutput -split "`n" | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "---BEGIN---") { $inBlock = $true; return }
    if ($line -eq "---END---")   { $inBlock = $false; return }
    if (-not $inBlock -or [string]::IsNullOrWhiteSpace($line)) { return }
    # format: SIZE PATH (path od pierwszej spacji do konca)
    if ($line -match '^(\d+)\s+(.+)$') {
        $size = [long]$matches[1]
        $path = $matches[2].Trim()
        if ($path -match '^\./') { $path = $path.Substring(2) }
        $remoteFiles[$path] = @{ Length = $size }
    }
}

Write-Host "Na serwerze: $($remoteFiles.Count) plikow (tez bez cache)" -ForegroundColor Gray
Write-Host ""

# 3) Porownanie
$onlyLocal = @()
$onlyRemote = @()
$differentSize = @()

foreach ($p in $localFiles.Keys) {
    if (-not $remoteFiles.ContainsKey($p)) {
        $onlyLocal += $p
    } else {
        if ($localFiles[$p].Length -ne $remoteFiles[$p].Length) {
            $differentSize += [PSCustomObject]@{ Path = $p; LocalSize = $localFiles[$p].Length; RemoteSize = $remoteFiles[$p].Length }
        }
    }
}
foreach ($p in $remoteFiles.Keys) {
    if (-not $localFiles.ContainsKey($p)) {
        $onlyRemote += $p
    }
}

# Raport
$ok = ($onlyLocal.Count -eq 0 -and $onlyRemote.Count -eq 0 -and $differentSize.Count -eq 0)
if ($ok) {
    Write-Host "[OK] Pliki lokalne i chmurowe sa takie same (liczby i rozmiary)." -ForegroundColor Green
    exit 0
}

Write-Host "Roznice (porownujemy tylko to, co wgrywa deploy; cache pomijamy):" -ForegroundColor Yellow
if ($onlyLocal.Count -gt 0) {
    Write-Host "  Tylko lokalnie ($($onlyLocal.Count)) - brak na serwerze:" -ForegroundColor Cyan
    $onlyLocal | Sort-Object | Select-Object -First 30 | ForEach-Object { Write-Host "    $_" }
    if ($onlyLocal.Count -gt 30) { Write-Host "    ... i $($onlyLocal.Count - 30) innych" }
}
if ($onlyRemote.Count -gt 0) {
    Write-Host "  Tylko na serwerze ($($onlyRemote.Count)) - brak lokalnie (np. stary deploy lub inny build):" -ForegroundColor Cyan
    $onlyRemote | Sort-Object | Select-Object -First 30 | ForEach-Object { Write-Host "    $_" }
    if ($onlyRemote.Count -gt 30) { Write-Host "    ... i $($onlyRemote.Count - 30) innych" }
}
if ($differentSize.Count -gt 0) {
    Write-Host "  Rozna wielkosc ($($differentSize.Count)):" -ForegroundColor Cyan
    $differentSize | Select-Object -First 20 | ForEach-Object { Write-Host "    $($_.Path)  lokal: $($_.LocalSize)  zdalny: $($_.RemoteSize)" }
    if ($differentSize.Count -gt 20) { Write-Host "    ... i $($differentSize.Count - 20) innych" }
}
Write-Host ""
Write-Host "Aby zsynchronizowac: .\scripts\deploy-to-mydevil.ps1" -ForegroundColor Gray
exit 1
