# Jednorazowa konfiguracja klucza SSH do MyDevil - po tym deploy nie bedzie pytal o haslo.
# Uruchom: .\scripts\setup-ssh-mydevil.ps1
# Haslo wpiszesz TYLKO RAZ przy kroku 2 (kopiowanie klucza na serwer).

$ErrorActionPreference = "Stop"
$keyPath = Join-Path $env:USERPROFILE ".ssh\mydevil_key"
$keyPub  = $keyPath + ".pub"
$configPath = Join-Path $env:USERPROFILE ".ssh\config"

# Katalog .ssh
$sshDir = Split-Path $keyPath
if (-not (Test-Path $sshDir)) {
    New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
    Write-Host "Utworzono katalog .ssh" -ForegroundColor Green
}

# 1. Klucz (jesli nie ma)
if (-not (Test-Path $keyPath)) {
    Write-Host "=== 1/2 Generowanie klucza SSH (ed25519) ===" -ForegroundColor Cyan
    ssh-keygen -t ed25519 -f $keyPath -N '""'
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[BLAD] Nie udalo sie wygenerowac klucza." -ForegroundColor Red
        exit 1
    }
    Write-Host "Klucz zapisany: $keyPath" -ForegroundColor Green
} else {
    Write-Host "Klucz juz istnieje: $keyPath" -ForegroundColor Yellow
}

# 2. Config (dopisz lub utworz wpis dla MyDevil)
$hostEntry = @"
Host mydevil panel5.mydevil.net
  HostName panel5.mydevil.net
  User karczma-labedz
  IdentityFile ~/.ssh/mydevil_key
"@

$needEntry = $true
if (Test-Path $configPath) {
    $content = Get-Content $configPath -Raw
    if ($content -match "mydevil_key") {
        Write-Host "Config juz zawiera wpis dla MyDevil." -ForegroundColor Yellow
        $needEntry = $false
    }
}
if ($needEntry) {
    Add-Content -Path $configPath -Value "`n$hostEntry"
    Write-Host "Dodano wpis do $configPath" -ForegroundColor Green
}

# 3. Kopiowanie klucza na serwer - TUTAJ WPISZESZ HASLO RAZ
Write-Host ""
Write-Host "=== 2/2 Kopiowanie klucza na serwer MyDevil ===" -ForegroundColor Cyan
Write-Host "Za chwile zostaniesz poproszony o HASLO SSH (karczma-labedz@panel5.mydevil.net)."
Write-Host "Wpisz je raz - potem deploy nie bedzie juz pytal." -ForegroundColor Yellow
Write-Host ""
# Pojedyncze cudzyslowy - zeby >> bylo na serwerze, nie w PowerShell
Get-Content $keyPub -Raw | ssh karczma-labedz@panel5.mydevil.net 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
if ($LASTEXITCODE -ne 0) {
    Write-Host "[BLAD] Nie udalo sie skopiowac klucza. Sprawdz haslo i polaczenie." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Gotowe. Od teraz deploy NIE bedzie pytal o haslo." -ForegroundColor Green
Write-Host "Sprawdz: ssh mydevil (powinno wejsc bez hasla)." -ForegroundColor Green
Write-Host "Potem: .\scripts\zapisz-i-wdroz.ps1 `"zapisz dane`"" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
