# Tworzy zadanie w Harmonogramie Zadań Windows.
# Uruchamia sync Bistro (karta dań + rachunki na pokój) co 2 minuty.
#
# Wymaga uprawnień administratora.
#
# Usunięcie zadania:
#   Unregister-ScheduledTask -TaskName "HotelSystem-Bistro-Sync" -Confirm:$false

$TaskName = "HotelSystem-Bistro-Sync"
$IntervalMinutes = 2
$ProjectRoot = $PSScriptRoot + "\.."
$NodeExe = "node"
$ScriptPath = Join-Path $ProjectRoot "bistro-sync\run-sync.mjs"

if (-not (Test-Path $ScriptPath)) {
    Write-Host "Blad: nie znaleziono $ScriptPath" -ForegroundColor Red
    exit 1
}

$Action = New-ScheduledTaskAction -Execute $NodeExe -Argument "`"$ScriptPath`"" -WorkingDirectory $ProjectRoot
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration ([TimeSpan]::MaxValue)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Sync Bistro (karta dan + rachunki) -> HotelSystem co ${IntervalMinutes} min"

Write-Host "Zadanie utworzone: $TaskName (co $IntervalMinutes min)" -ForegroundColor Green
Write-Host "Start: Start-ScheduledTask -TaskName `"$TaskName`""
Write-Host "Stop:  Stop-ScheduledTask -TaskName `"$TaskName`""
Write-Host "Usun:  Unregister-ScheduledTask -TaskName `"$TaskName`" -Confirm:`$false"
