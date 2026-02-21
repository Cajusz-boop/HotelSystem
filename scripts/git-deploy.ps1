# Szybki deploy przez git push
# Użycie: .\scripts\git-deploy.ps1
# Opcje:
#   -Message "treść"  - własny commit message
#   -NoBuild          - pomiń lokalny test build

param(
    [string]$Message = "",
    [switch]$NoBuild
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "=== Git Deploy ===" -ForegroundColor Green

# 1. Sprawdź czy są zmiany
$status = git status --porcelain
if (-not $status) {
    Write-Host "Brak zmian do commitowania." -ForegroundColor Yellow
    
    # Sprawdź czy są niepushnięte commity
    $ahead = git rev-list --count HEAD "@{upstream}"
    if ($ahead -eq 0) {
        Write-Host "Wszystko zsynchronizowane z origin." -ForegroundColor Green
        exit 0
    }
    Write-Host "Masz $ahead niepushnięte commity - pushuję..." -ForegroundColor Cyan
} else {
    # 2. Pokaż co się zmieni
    Write-Host ""
    Write-Host "Zmiany do wysłania:" -ForegroundColor Cyan
    git status --short
    Write-Host ""

    # 3. Opcjonalny lokalny build test
    if (-not $NoBuild) {
        Write-Host "Sprawdzam czy build przejdzie..." -ForegroundColor Yellow
        npx tsc --noEmit 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[BŁĄD] TypeScript ma błędy - popraw przed deployem!" -ForegroundColor Red
            exit 1
        }
        Write-Host "TypeScript OK" -ForegroundColor Green
    }

    # 4. Auto-generuj commit message jeśli nie podano
    if (-not $Message) {
        $changedFiles = git diff --cached --name-only 2>$null
        if (-not $changedFiles) {
            $changedFiles = git diff --name-only
        }
        $fileCount = ($changedFiles | Measure-Object).Count
        $firstFile = ($changedFiles | Select-Object -First 1)
        
        if ($fileCount -eq 1) {
            $Message = "Update $firstFile"
        } elseif ($fileCount -le 3) {
            $Message = "Update $fileCount files"
        } else {
            $Message = "Update $fileCount files including $firstFile"
        }
    }

    # 5. Git add + commit
    Write-Host "Commit: $Message" -ForegroundColor Cyan
    git add -A
    git commit -m $Message
}

# 6. Push
Write-Host ""
Write-Host "Pushing to origin..." -ForegroundColor Yellow
git push origin

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "[OK] Push completed!" -ForegroundColor Green
Write-Host "Webhook uruchomi deploy na serwerze." -ForegroundColor Green
Write-Host "Logi: ssh hetzner 'tail -50 /var/www/hotel/deploy.log'" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Green
