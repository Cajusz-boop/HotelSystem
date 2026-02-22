# Setup SSH dla projektu HotelSystem (Hetzner)
# Uruchom po sklonowaniu repo: .\scripts\setup-ssh.ps1

$ErrorActionPreference = "Continue"
Write-Host "=== Setup SSH dla HotelSystem ===" -ForegroundColor Green
Write-Host ""

$sshDir = "$env:USERPROFILE\.ssh"
$configFile = "$sshDir\config"
$keyFile = "$sshDir\hetzner_key"

# 1. Sprawdz folder .ssh
if (-not (Test-Path $sshDir)) {
    Write-Host "Tworzenie folderu .ssh..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
}

# 2. Konfiguracja SSH dla Hetzner
$hetznerConfig = @"

Host hetzner hotel-hetzner
  HostName 65.108.245.25
  User root
  IdentityFile ~/.ssh/hetzner_key
  
  # Szybsze polaczenie
  ConnectTimeout 10
  ServerAliveInterval 60
  ServerAliveCountMax 3
  
  # Wylacz niepotrzebne metody auth
  GSSAPIAuthentication no
  PreferredAuthentications publickey
  
  # Kompresja
  Compression yes
  
  # Wylacz sprawdzanie DNS
  AddressFamily inet
"@

# Sprawdz czy config istnieje i czy ma juz wpis hetzner
$needsConfig = $true
if (Test-Path $configFile) {
    $existingConfig = Get-Content $configFile -Raw
    if ($existingConfig -match "Host hetzner") {
        Write-Host "[OK] Konfiguracja SSH dla Hetzner juz istnieje" -ForegroundColor Green
        $needsConfig = $false
    }
}

if ($needsConfig) {
    Write-Host "Dodawanie konfiguracji SSH dla Hetzner..." -ForegroundColor Yellow
    Add-Content -Path $configFile -Value $hetznerConfig
    Write-Host "[OK] Konfiguracja SSH dodana do $configFile" -ForegroundColor Green
}

# 3. Sprawdz klucz SSH
Write-Host ""
if (Test-Path $keyFile) {
    Write-Host "[OK] Klucz SSH istnieje: $keyFile" -ForegroundColor Green
    
    # Test polaczenia
    Write-Host ""
    Write-Host "Testowanie polaczenia SSH..." -ForegroundColor Yellow
    $testResult = ssh -o BatchMode=yes -o ConnectTimeout=10 hetzner "echo SSH_OK" 2>&1
    if ($testResult -match "SSH_OK") {
        Write-Host "[OK] Polaczenie SSH dziala!" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Polaczenie SSH nie dziala. Sprawdz klucz." -ForegroundColor Yellow
        Write-Host $testResult -ForegroundColor Gray
    }
} else {
    Write-Host "[!] BRAK KLUCZA SSH!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Klucz prywatny musi byc skopiowany reczenie." -ForegroundColor Yellow
    Write-Host "Skopiuj plik 'hetzner_key' z komputera A do:" -ForegroundColor Yellow
    Write-Host "  $keyFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Na komputerze A klucz jest w:" -ForegroundColor Yellow
    Write-Host "  C:\Users\hp\.ssh\hetzner_key" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Mozesz uzyc pendrive, OneDrive, lub scp." -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Setup zakonczony ===" -ForegroundColor Green
