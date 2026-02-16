# Bridge: Nowy system hotelowy ↔ Symplex Bistro (przez bazę KW Hotel)

Dwukierunkowa integracja z restauracją (Symplex Bistro) **bez udziału dealera Symplex** — przez bezpośredni dostęp do bazy danych KW Hotel, z której Bistro czyta dane pokoi i gości.

## Jak to działa

```
Nowy system hotelowy          Bridge (sync.mjs)           Baza KW Hotel          Bistro
        │                           │                          │                    │
        │  1. GET /occupied-rooms   │                          │                    │
        │◄──────────────────────────│                          │                    │
        │  lista pokoi + goście     │                          │                    │
        │                           │  2. WRITE rooms/klienci  │                    │
        │                           │  /rezerwacje             │                    │
        │                           │─────────────────────────►│                    │
        │                           │                          │  3. kelner czyta   │
        │                           │                          │◄───────────────────│
        │                           │                          │  pokoje z gośćmi   │
        │                           │                          │                    │
        │                           │                          │  4. kelner nabija  │
        │                           │                          │  rachunek "na      │
        │                           │                          │  pokój 101"        │
        │                           │                          │◄───────────────────│
        │                           │  5. READ rachunki        │                    │
        │                           │◄─────────────────────────│                    │
        │  6. POST /posting         │                          │                    │
        │◄──────────────────────────│                          │                    │
        │  obciążenie na pokój      │                          │                    │
```

## Pliki

| Plik | Opis |
|------|------|
| `sync.mjs` | Główny skrypt synchronizacji (oba kierunki) |
| `run.mjs` | Starszy bridge plikowy (CSV/EDI → API) — nadal działa |
| `recon-kwhotel-db.mjs` | Diagnostyka bazy KW Hotel (uruchom przed konfiguracją) |
| `setup-scheduler.ps1` | Skrypt tworzący zadanie w Harmonogramie Zadań Windows |
| `.env.example` | Szablon konfiguracji |
| `.sync-state.json` | Stan synchronizacji (auto-generowany, nie edytuj) |

## Szybki start

### Krok 1: Diagnostyka bazy

Uruchom na komputerze z dostępem do bazy KW Hotel:

```powershell
$env:KW_DATABASE_URL = "mysql://user:haslo@192.168.1.10:3306/kwhotel"
node symplex-bridge/sync.mjs --recon
```

Lub z projektu:

```powershell
$env:KW_DATABASE_URL = "mysql://user:haslo@192.168.1.10:3306/kwhotel"
npm run symplex:recon
```

Skopiuj wynik — pokaże listę tabel, struktury i próbki danych.

### Krok 2: Konfiguracja

Skopiuj `.env.example` do `.env` w folderze `symplex-bridge/`:

```powershell
Copy-Item symplex-bridge\.env.example symplex-bridge\.env
```

Uzupełnij dane:

```env
KW_DATABASE_URL=mysql://user:haslo@192.168.1.10:3306/kwhotel
OCCUPIED_ROOMS_URL=https://hotel.karczma-labedz.pl/api/v1/external/occupied-rooms
POSTING_URL=https://hotel.karczma-labedz.pl/api/v1/external/posting
EXTERNAL_API_KEY=twoj-klucz-api
```

### Krok 3: Test ręczny

```powershell
# Oba kierunki
npm run symplex:sync

# Tylko pokoje → KW Hotel (Bistro)
npm run symplex:sync:to-kw

# Tylko rachunki → nowy system
npm run symplex:sync:from-kw
```

### Krok 4: Harmonogram (automatyczne uruchamianie co 2 min)

Uruchom jako Administrator:

```powershell
powershell -ExecutionPolicy Bypass -File symplex-bridge\setup-scheduler.ps1
```

Zarządzanie:

```powershell
# Podgląd
Get-ScheduledTask -TaskName "HotelSystem-Bistro-Sync"

# Ręczne uruchomienie
Start-ScheduledTask -TaskName "HotelSystem-Bistro-Sync"

# Zatrzymanie
Stop-ScheduledTask -TaskName "HotelSystem-Bistro-Sync"

# Usunięcie
Unregister-ScheduledTask -TaskName "HotelSystem-Bistro-Sync" -Confirm:$false
```

## Jak znaleźć dane dostępu do bazy KW Hotel

1. **Na komputerze z KW Hotel** szukaj pliku konfiguracyjnego:
   - `C:\KWHotel\config.ini` lub `C:\KWHotel\kwhotel.ini`
   - `C:\Program Files\KWHotel\*.ini`
   - Szukaj linii z `server=`, `database=`, `user=`, `password=`

2. **Jeśli KW Hotel Pro** (wersja sieciowa) — baza jest na serwerze MySQL:
   - Host: adres IP serwera
   - Port: 3306 (domyślnie)
   - Baza: zazwyczaj `kwhotel` lub `kwhotel_pro`

3. **Jeśli KW Hotel Standard** — baza lokalna (XAMPP/MySQL):
   - Host: `127.0.0.1` lub `localhost`
   - Port: 3306
   - User: `root` (często bez hasła)

## Struktura tabel KW Hotel (znana)

Skrypt synchronizacji korzysta z tych tabel:

| Tabela | Opis | Kluczowe kolumny |
|--------|------|------------------|
| `rooms` | Pokoje | id, name, room_group_id, deleted |
| `room_groups` | Typy pokoi | id, name, beds_number |
| `klienci` | Goście | KlientID, Nazwisko, Active |
| `rezerwacje` | Rezerwacje | RezerwacjaID, PokojID, KlientID, DataOd, DataDo, status_id |

Statusy rezerwacji w KW Hotel:
- `status_id = 0` — nowa
- `status_id = 1` — potwierdzona
- `status_id = 2` — zameldowana (CHECKED_IN) ← **tego szuka Bistro**
- `status_id = 3` — wymeldowana (CHECKED_OUT)

## Rozwiązywanie problemów

### "Brak OCCUPIED_ROOMS_URL"
Ustaw zmienne w `.env` — skopiuj z `.env.example`.

### "Błąd połączenia z bazą"
Sprawdź `KW_DATABASE_URL`. Upewnij się, że:
- MySQL działa na komputerze z KW Hotel
- Firewall nie blokuje portu 3306
- User/hasło są poprawne

### "Brak aktywnej rezerwacji dla tego pokoju"
Gość nie jest zameldowany w nowym systemie. Zamelduj go (status CHECKED_IN).

### "Nie znaleziono tabeli z dokumentami sprzedaży"
Uruchom `--recon` i sprawdź jakie tabele ma baza. Możliwe, że Bistro używa
innej nazwy tabeli. Zgłoś wynik recon — dopasujemy skrypt.

### Bistro nie widzi pokoi
1. Sprawdź czy sync się uruchomił: `Get-Content symplex-bridge\sync.log -Tail 20`
2. Sprawdź czy w bazie KW Hotel są rezerwacje ze status_id=2
3. Może Bistro cachuje dane — zrestartuj Bistro

## Stary bridge plikowy (run.mjs)

Jeśli Bistro eksportuje rachunki do plików (zamiast bazy), nadal możesz używać `run.mjs`:

```powershell
$env:POSTING_URL = "https://hotel.karczma-labedz.pl/api/v1/external/posting"
$env:EXTERNAL_API_KEY = "klucz"
$env:SYMPLEX_WATCH_DIR = "C:\Symplex\eksport\na-pokoj"
npm run symplex:bridge
```

Format pliku: `roomNumber;amount;receiptNumber;cashier;item1:qty:price|item2:qty:price`
