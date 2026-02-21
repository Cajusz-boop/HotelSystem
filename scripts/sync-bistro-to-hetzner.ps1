# =============================================================================
# SKRYPT SYNCHRONIZACJI BISTRO → HOTELSYSTEM
# =============================================================================
# Ten skrypt pobiera nowe zamówienia gastronomiczne z bazy KWHotel (lokalny serwer)
# i wysyła je do API HotelSystem na serwerze Hetzner.
#
# INSTALACJA NA SERWERZE LOKALNYM:
# 1. Skopiuj ten plik na serwer (np. C:\Scripts\sync-bistro.ps1)
# 2. Zainstaluj MySQL Connector: choco install mysql-connector-net
#    lub pobierz z https://dev.mysql.com/downloads/connector/net/
# 3. Ustaw zmienne poniżej (hasła, klucz API)
# 4. Dodaj do Harmonogramu zadań Windows (co 5 minut)
#
# HARMONOGRAM ZADAŃ:
# - Program: powershell.exe
# - Argumenty: -ExecutionPolicy Bypass -File "C:\Scripts\sync-bistro.ps1"
# - Wyzwalacz: Co 5 minut
# =============================================================================

# KONFIGURACJA - ZMIEŃ TE WARTOŚCI!
$Config = @{
    # Baza danych KWHotel (lokalny serwer)
    DbHost     = "localhost"
    DbPort     = 3306
    DbName     = "kwhotel"
    DbUser     = "admin"
    DbPassword = "gracho123"
    
    # API HotelSystem (Hetzner)
    ApiUrl     = "https://hotel.karczma-labedz.pl/api/v1/external/posting"
    ApiKey     = "TUTAJ_WSTAW_KLUCZ_API"  # Klucz z .env na Hetzner (EXTERNAL_API_KEY)
    
    # Plik ze stanem synchronizacji (ostatnie ID)
    StateFile  = "C:\Scripts\bistro-sync-state.json"
    
    # Logowanie
    LogFile    = "C:\Scripts\bistro-sync.log"
}

# =============================================================================
# FUNKCJE POMOCNICZE
# =============================================================================

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] [$Level] $Message"
    Add-Content -Path $Config.LogFile -Value $logLine -ErrorAction SilentlyContinue
    if ($Level -eq "ERROR") {
        Write-Host $logLine -ForegroundColor Red
    } else {
        Write-Host $logLine
    }
}

function Get-SyncState {
    if (Test-Path $Config.StateFile) {
        try {
            return Get-Content $Config.StateFile | ConvertFrom-Json
        } catch {
            return @{ LastId = 0; LastSync = $null }
        }
    }
    return @{ LastId = 0; LastSync = $null }
}

function Save-SyncState {
    param([int]$LastId)
    $state = @{
        LastId   = $LastId
        LastSync = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    }
    $state | ConvertTo-Json | Set-Content -Path $Config.StateFile
}

function Get-RoomNumber {
    param([string]$Symbol)
    # Symbol ma format "004 140/185" - wyciągamy pierwszy segment (numer pokoju)
    if ($Symbol -match "^(\d{3})") {
        return $Matches[1]
    }
    # Jeśli zaczyna się od liter (np. "SI 020")
    if ($Symbol -match "^([A-Z]+\s*\d+)") {
        return $Matches[1].Trim()
    }
    # Fallback - wszystko do pierwszej spacji
    $parts = $Symbol -split "\s+"
    return $parts[0]
}

# =============================================================================
# GŁÓWNA LOGIKA
# =============================================================================

Write-Log "=== START SYNCHRONIZACJI BISTRO ===" "INFO"

# Sprawdź czy klucz API jest ustawiony
if ($Config.ApiKey -eq "TUTAJ_WSTAW_KLUCZ_API") {
    Write-Log "BŁĄD: Nie ustawiono klucza API! Edytuj plik i wstaw klucz." "ERROR"
    exit 1
}

# Pobierz stan ostatniej synchronizacji
$state = Get-SyncState
$lastId = $state.LastId
Write-Log "Ostatnio zsynchronizowane ID: $lastId"

try {
    # Połączenie z bazą MySQL
    Add-Type -Path "C:\Program Files (x86)\MySQL\MySQL Connector Net 8.0.33\Assemblies\v4.5.2\MySql.Data.dll" -ErrorAction SilentlyContinue
    
    $connectionString = "Server=$($Config.DbHost);Port=$($Config.DbPort);Database=$($Config.DbName);Uid=$($Config.DbUser);Pwd=$($Config.DbPassword);SslMode=none;"
    $connection = New-Object MySql.Data.MySqlClient.MySqlConnection($connectionString)
    $connection.Open()
    Write-Log "Połączono z bazą KWHotel"
    
    # Zapytanie - pobierz nowe pozycje gastronomiczne
    $query = @"
SELECT 
    ra.RezerwAsortymentID,
    ra.RezerwacjaID,
    ra.Nazwa,
    ra.Ilosc,
    ra.Netto,
    ra.VAT,
    ra.data,
    r.PokojID,
    p.Symbol as PokojSymbol
FROM rezerwasortyment ra
JOIN rezerwacje r ON ra.RezerwacjaID = r.RezerwacjaID
JOIN pokoje p ON r.PokojID = p.PokojID
WHERE ra.RezerwAsortymentID > $lastId
  AND ra.data >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY ra.RezerwAsortymentID ASC
LIMIT 100
"@
    
    $command = New-Object MySql.Data.MySqlClient.MySqlCommand($query, $connection)
    $reader = $command.ExecuteReader()
    
    # Grupuj pozycje po rezerwacji
    $ordersByReservation = @{}
    $maxId = $lastId
    
    while ($reader.Read()) {
        $id = [int]$reader["RezerwAsortymentID"]
        $rezId = [int]$reader["RezerwacjaID"]
        $nazwa = [string]$reader["Nazwa"]
        $ilosc = [decimal]$reader["Ilosc"]
        $netto = [decimal]$reader["Netto"]
        $vat = [decimal]$reader["VAT"]
        $data = $reader["data"]
        $pokojSymbol = [string]$reader["PokojSymbol"]
        
        # Oblicz cenę brutto
        $brutto = [math]::Round($netto * (1 + $vat / 100), 2)
        
        $item = @{
            id        = $id
            name      = $nazwa
            quantity  = [int]$ilosc
            unitPrice = $brutto
        }
        
        if (-not $ordersByReservation.ContainsKey($rezId)) {
            $ordersByReservation[$rezId] = @{
                roomNumber = Get-RoomNumber -Symbol $pokojSymbol
                items      = @()
                timestamp  = $data
            }
        }
        $ordersByReservation[$rezId].items += $item
        
        if ($id -gt $maxId) { $maxId = $id }
    }
    $reader.Close()
    $connection.Close()
    
    $count = $ordersByReservation.Count
    Write-Log "Znaleziono $count nowych zamówień do wysłania"
    
    if ($count -eq 0) {
        Write-Log "Brak nowych danych do synchronizacji"
        exit 0
    }
    
    # Wyślij każde zamówienie do API
    $successCount = 0
    $errorCount = 0
    
    foreach ($rezId in $ordersByReservation.Keys) {
        $order = $ordersByReservation[$rezId]
        $roomNumber = $order.roomNumber
        $items = $order.items
        
        # Oblicz sumę
        $totalAmount = ($items | ForEach-Object { $_.quantity * $_.unitPrice } | Measure-Object -Sum).Sum
        $totalAmount = [math]::Round($totalAmount, 2)
        
        # Przygotuj body dla API
        $body = @{
            roomNumber    = $roomNumber
            amount        = $totalAmount
            type          = "RESTAURANT"
            description   = "Zamówienie z Bistro (KWHotel)"
            posSystem     = "KWHotel Bistro"
            items         = $items | ForEach-Object {
                @{
                    name      = $_.name
                    quantity  = $_.quantity
                    unitPrice = $_.unitPrice
                }
            }
        } | ConvertTo-Json -Depth 10
        
        Write-Log "Wysyłam zamówienie: pokój $roomNumber, kwota $totalAmount PLN, pozycji: $($items.Count)"
        
        try {
            $response = Invoke-RestMethod -Uri $Config.ApiUrl -Method POST -Body $body -ContentType "application/json; charset=utf-8" -Headers @{
                "X-API-Key" = $Config.ApiKey
            }
            
            if ($response.success) {
                Write-Log "  OK: transactionId=$($response.transactionId)"
                $successCount++
            } else {
                Write-Log "  BŁĄD API: $($response.error)" "ERROR"
                $errorCount++
            }
        } catch {
            Write-Log "  BŁĄD HTTP: $_" "ERROR"
            $errorCount++
        }
        
        # Krótka pauza między requestami
        Start-Sleep -Milliseconds 200
    }
    
    # Zapisz stan tylko jeśli były sukcesy
    if ($successCount -gt 0) {
        Save-SyncState -LastId $maxId
        Write-Log "Zapisano stan: LastId=$maxId"
    }
    
    Write-Log "=== KONIEC: sukces=$successCount, błędy=$errorCount ===" "INFO"
    
} catch {
    Write-Log "BŁĄD KRYTYCZNY: $_" "ERROR"
    exit 1
}
