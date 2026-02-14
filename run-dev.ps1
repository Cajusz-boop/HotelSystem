# Uruchom dev server z worktree (vdk) na porcie 3011.
# Najpierw zatrzymaj inny dev (Ctrl+C), potem uruchom: .\run-dev.ps1
Set-Location $PSScriptRoot
if (-not (Test-Path "node_modules\next")) {
    Write-Host "Instalowanie zaleznosci (npm install)..."
    npm install
}
Write-Host "Uruchamianie Next.js na http://localhost:3011"
npx next dev -p 3011
