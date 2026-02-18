# Zapisz zmiany do GitHuba i wdroz na hotel.karczma-labedz.pl
# Uzycie: .\scripts\zapisz-i-wdroz.ps1 "zapisz dane"
#         .\scripts\zapisz-i-wdroz.ps1 "poprawka formularza"
# Jesli pominiesz komunikat: uzyte bedzie "zapisz dane".

param([Parameter(Position=0)][string]$Komunikat = "zapisz dane")

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "=== Zapisz i wdroz ===" -ForegroundColor Green
Write-Host "Komunikat commita: $Komunikat" -ForegroundColor Cyan
Write-Host ""

# 1. Git: dodaj, commit, push (jesli sa zmiany)
$status = git status --porcelain 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[BLAD] git status nie powiodl sie (moze to nie repozytorium git?)." -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "Brak zmian do zapisania - pomijam commit i push." -ForegroundColor Yellow
} else {
    Write-Host "=== 1/2 Git: zapis do GitHub ===" -ForegroundColor Cyan
    git add -A
    git commit -m $Komunikat
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[BLAD] git commit nie powiodl sie." -ForegroundColor Red
        exit 1
    }
    git push
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[BLAD] git push nie powiodl sie (sprawdz haslo/token lub SSH)." -ForegroundColor Red
        exit 1
    }
    Write-Host "Zapisano na GitHub." -ForegroundColor Green
    Write-Host ""
}

# 2. Deploy na MyDevil
Write-Host "=== 2/2 Deploy na hotel.karczma-labedz.pl ===" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "deploy-to-mydevil.ps1")
if ($LASTEXITCODE -ne 0) {
    Write-Host "[BLAD] Deploy nie powiodl sie." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Gotowe: GitHub zaktualizowany, strona wdrożona." -ForegroundColor Green
