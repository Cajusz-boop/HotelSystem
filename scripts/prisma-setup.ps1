# Uruchamia Prisma (db push + generate) gdy npx nie jest w PATH.
# Użycie: .\scripts\prisma-setup.ps1   (w katalogu HotelSystem)

$nodeDirs = @(
    "C:\Program Files\nodejs",
    "C:\Program Files (x86)\nodejs",
    "$env:LOCALAPPDATA\Programs\node",
    "$env:APPDATA\nvm\v20*",
    "$env:APPDATA\nvm\v18*"
)

$nodeExe = $null
foreach ($d in $nodeDirs) {
    $resolved = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($d)
    if (Test-Path $resolved) {
        $dir = if (($r = Get-Item $resolved -ErrorAction SilentlyContinue)) { $r.FullName } else { $resolved }
        $n = Join-Path $dir "node.exe"
        if (Test-Path $n) { $nodeExe = $n; break }
    }
}

if (-not $nodeExe) {
    Write-Host "Node.js nie znaleziony. Zainstaluj z https://nodejs.org (LTS) i zrestartuj terminal." -ForegroundColor Red
    Write-Host "Albo dodaj do PATH katalog z node.exe (np. C:\Program Files\nodejs)." -ForegroundColor Yellow
    exit 1
}

$nodeDir = [System.IO.Path]::GetDirectoryName($nodeExe)
$env:PATH = "$nodeDir;$env:PATH"
Set-Location $PSScriptRoot\..

Write-Host "Uzycie Node: $nodeExe" -ForegroundColor Cyan
Write-Host "Prisma db push..." -ForegroundColor Cyan
& npx prisma db push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Prisma generate..." -ForegroundColor Cyan
& npx prisma generate
exit $LASTEXITCODE
