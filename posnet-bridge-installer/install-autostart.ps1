$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) {
    Write-Host "BLAD: Node.js nie znaleziony" -ForegroundColor Red
    exit 1
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverPath = Join-Path $scriptDir "server.mjs"

if (-not (Test-Path $serverPath)) {
    Write-Host "BLAD: Nie znaleziono server.mjs w $scriptDir" -ForegroundColor Red
    exit 1
}

$startupDir = [Environment]::GetFolderPath("Startup")

Remove-Item (Join-Path $startupDir "POSNET-Bridge.lnk") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $startupDir "POSNET-Bridge.vbs") -Force -ErrorAction SilentlyContinue

$vbsPath = Join-Path $startupDir "POSNET-Bridge.vbs"

$q = '""'
$vbsContent = 'CreateObject("WScript.Shell").Run "' + $q + $nodePath + $q + ' ' + $q + $serverPath + $q + '", 0, False'

Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII

if (Test-Path $vbsPath) {
    Write-Host "OK"
} else {
    Write-Host "FAIL"
    exit 1
}
