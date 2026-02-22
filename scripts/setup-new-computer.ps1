# ===========================================
# AUTOMATYCZNY SETUP HOTEL SYSTEM PMS
# Uruchom po sklonowaniu repo na nowym komputerze
# ===========================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  HOTEL SYSTEM PMS - Setup komputera" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Sprawdz Node.js ---
Write-Host "[1/6] Sprawdzam Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node -v
    Write-Host "      OK: Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "      BLAD: Node.js nie znaleziony!" -ForegroundColor Red
    Write-Host "      Zainstaluj z: https://nodejs.org/" -ForegroundColor Red
    Write-Host ""
    Read-Host "Nacisnij Enter aby zamknac"
    exit 1
}

# --- 2. Sprawdz Git ---
Write-Host "[2/6] Sprawdzam Git..." -ForegroundColor Yellow
try {
    $gitVersion = git --version
    Write-Host "      OK: $gitVersion" -ForegroundColor Green
    
    $gitUser = git config --global user.name 2>$null
    $gitEmail = git config --global user.email 2>$null
    
    if (-not $gitUser -or -not $gitEmail) {
        Write-Host ""
        Write-Host "      Git nie jest skonfigurowany. Podaj dane:" -ForegroundColor Yellow
        $newName = Read-Host "      Twoje imie i nazwisko"
        $newEmail = Read-Host "      Twoj email"
        git config --global user.name $newName
        git config --global user.email $newEmail
        Write-Host "      OK: Git skonfigurowany" -ForegroundColor Green
    } else {
        Write-Host "      OK: Git user: $gitUser <$gitEmail>" -ForegroundColor Green
    }
} catch {
    Write-Host "      BLAD: Git nie znaleziony!" -ForegroundColor Red
    Write-Host "      Zainstaluj z: https://git-scm.com/download/win" -ForegroundColor Red
    Write-Host ""
    Read-Host "Nacisnij Enter aby zamknac"
    exit 1
}

# --- 3. Instaluj npm dependencies ---
Write-Host "[3/6] Instaluje zaleznosci npm..." -ForegroundColor Yellow
Write-Host "      (to moze potrwac kilka minut)" -ForegroundColor Gray

$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot

try {
    npm install 2>&1 | Out-Null
    Write-Host "      OK: Zaleznosci zainstalowane" -ForegroundColor Green
} catch {
    Write-Host "      BLAD: npm install nie powiodl sie" -ForegroundColor Red
    Write-Host "      Sprobuj recznie: npm install" -ForegroundColor Yellow
}

# --- 4. Utworz .env jesli nie istnieje ---
Write-Host "[4/6] Sprawdzam plik .env..." -ForegroundColor Yellow

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "      OK: Skopiowano .env.example -> .env" -ForegroundColor Green
        Write-Host ""
        Write-Host "      WAZNE: Edytuj plik .env i ustaw DATABASE_URL!" -ForegroundColor Yellow
        Write-Host "      Domyslnie: mysql://root:@localhost:3306/hotel_pms" -ForegroundColor Gray
        Write-Host ""
        
        $editNow = Read-Host "      Czy chcesz otworzyc .env teraz? (t/n)"
        if ($editNow -eq "t" -or $editNow -eq "T") {
            notepad .env
            Write-Host ""
            Read-Host "      Po zapisaniu .env nacisnij Enter aby kontynuowac"
        }
    } else {
        Write-Host "      UWAGA: Brak .env.example - utworz .env recznie" -ForegroundColor Yellow
    }
} else {
    Write-Host "      OK: Plik .env juz istnieje" -ForegroundColor Green
}

# --- 5. Sprawdz MySQL ---
Write-Host "[5/6] Sprawdzam MySQL..." -ForegroundColor Yellow
Write-Host "      Upewnij sie ze MySQL dziala (np. XAMPP -> Start MySQL)" -ForegroundColor Gray

$mysqlReady = Read-Host "      Czy MySQL jest uruchomiony? (t/n)"
if ($mysqlReady -ne "t" -and $mysqlReady -ne "T") {
    Write-Host ""
    Write-Host "      Uruchom MySQL i uruchom ten skrypt ponownie," -ForegroundColor Yellow
    Write-Host "      lub wykonaj recznie:" -ForegroundColor Yellow
    Write-Host "        npx prisma db push" -ForegroundColor Gray
    Write-Host "        npx prisma generate" -ForegroundColor Gray
    Write-Host ""
    Pop-Location
    Read-Host "Nacisnij Enter aby zamknac"
    exit 0
}

# --- 6. Prisma setup ---
Write-Host "[6/6] Konfiguruję baze danych (Prisma)..." -ForegroundColor Yellow

try {
    Write-Host "      Uruchamiam: npx prisma db push" -ForegroundColor Gray
    npx prisma db push 2>&1 | Out-Null
    Write-Host "      OK: Schemat bazy zsynchronizowany" -ForegroundColor Green
    
    Write-Host "      Uruchamiam: npx prisma generate" -ForegroundColor Gray
    npx prisma generate 2>&1 | Out-Null
    Write-Host "      OK: Prisma Client wygenerowany" -ForegroundColor Green
} catch {
    Write-Host "      BLAD: Prisma nie powiodla sie" -ForegroundColor Red
    Write-Host "      Sprawdz DATABASE_URL w .env i czy MySQL dziala" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "      Sprobuj recznie:" -ForegroundColor Gray
    Write-Host "        npx prisma db push" -ForegroundColor Gray
    Write-Host "        npx prisma generate" -ForegroundColor Gray
}

Pop-Location

# --- GOTOWE ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SETUP ZAKONCZONY!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Uruchom aplikacje:" -ForegroundColor Cyan
Write-Host "    npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "  Otworz w przegladarce:" -ForegroundColor Cyan
Write-Host "    http://localhost:3011" -ForegroundColor White
Write-Host ""

$runNow = Read-Host "Czy uruchomic aplikacje teraz? (t/n)"
if ($runNow -eq "t" -or $runNow -eq "T") {
    Write-Host ""
    Write-Host "Uruchamiam npm run dev..." -ForegroundColor Cyan
    Write-Host "(Ctrl+C aby zatrzymac)" -ForegroundColor Gray
    Write-Host ""
    Push-Location $projectRoot
    npm run dev
    Pop-Location
}
