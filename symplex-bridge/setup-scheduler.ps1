# setup-scheduler.ps1
# Tworzy zadanie w Harmonogramie Zadań Windows, które uruchamia sync.mjs co 2 minuty.
#
# Użycie (jako Administrator):
#   powershell -ExecutionPolicy Bypass -File symplex-bridge\setup-scheduler.ps1
#
# Aby usunąć zadanie:
#   Unregister-ScheduledTask -TaskName "HotelSystem-Bistro-Sync" -Confirm:$false

param(
    [int]$IntervalMinutes = 2,
    [string]$TaskName = "HotelSystem-Bistro-Sync"
)

$ErrorActionPreference = "Stop"

# Ścieżki
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
$syncScript = Join-Path $scriptDir "sync.mjs"
$envFile = Join-Path $scriptDir ".env"
$logFile = Join-Path $scriptDir "sync.log"

# Sprawdź czy sync.mjs istnieje
if (-not (Test-Path $syncScript)) {
    Write-Error "Nie znaleziono $syncScript"
    exit 1
}

# Sprawdź czy .env istnieje
if (-not (Test-Path $envFile)) {
    Write-Host "[WARN] Brak pliku $envFile" -ForegroundColor Yellow
    Write-Host "       Skopiuj .env.example do .env i uzupełnij dane." -ForegroundColor Yellow
    $envExample = Join-Path $scriptDir ".env.example"
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "       Skopiowano .env.example -> .env (UZUPEŁNIJ DANE!)" -ForegroundColor Cyan
    }
}

# Znajdź node.exe
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) {
    Write-Error "Nie znaleziono node.exe w PATH. Zainstaluj Node.js."
    exit 1
}
Write-Host "[OK] Node.js: $nodePath" -ForegroundColor Green

# Zbuduj komendę uruchamiającą sync z załadowanym .env
# Używamy cmd /c żeby uniknąć problemów z PowerShell i zmiennymi środowiskowymi
$batContent = @"
@echo off
cd /d "$scriptDir"
REM Załaduj zmienne z .env
for /f "usebackq tokens=1,* delims==" %%A in ("$envFile") do (
    if not "%%A"=="" if not "%%A:~0,1%"=="#" set "%%A=%%B"
)
"$nodePath" "$syncScript" >> "$logFile" 2>&1
"@

$batFile = Join-Path $scriptDir "run-sync.bat"
Set-Content -Path $batFile -Value $batContent -Encoding ASCII
Write-Host "[OK] Utworzono $batFile" -ForegroundColor Green

# Usuń istniejące zadanie (jeśli jest)
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[OK] Usunięto istniejące zadanie: $TaskName" -ForegroundColor Yellow
}

# Utwórz trigger — co N minut, bez końca
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration ([TimeSpan]::MaxValue)

# Utwórz akcję
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batFile`"" -WorkingDirectory $scriptDir

# Ustawienia
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -MultipleInstances IgnoreNew

# Zarejestruj zadanie
Register-ScheduledTask `
    -TaskName $TaskName `
    -Description "Synchronizacja nowy system hotelowy <-> KW Hotel (Bistro) co $IntervalMinutes min." `
    -Trigger $trigger `
    -Action $action `
    -Settings $settings `
    -RunLevel Highest | Out-Null

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Zadanie utworzone pomyślnie!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " Nazwa:    $TaskName"
Write-Host " Interwał: co $IntervalMinutes minuty"
Write-Host " Skrypt:   $batFile"
Write-Host " Logi:     $logFile"
Write-Host ""
Write-Host " Zarządzanie:"
Write-Host "   Podgląd:  Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "   Start:    Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "   Stop:     Stop-ScheduledTask -TaskName '$TaskName'"
Write-Host "   Usuń:     Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
Write-Host ""
Write-Host " WAŻNE: Uzupełnij dane w $envFile przed pierwszym uruchomieniem!" -ForegroundColor Yellow
