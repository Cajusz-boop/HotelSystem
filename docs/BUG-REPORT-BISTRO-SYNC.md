# BUG REPORT: Synchronizacja pokoi HotelSystem → Bistro

## Problem
Bistro (Symplex Small Business SB4) pokazuje **inne pokoje/gości** niż te zapisane w bazie MySQL `kwhotel`. Skrypt `sync.mjs` poprawnie zapisuje dane do bazy, ale Bistro ich nie widzi.

## Środowisko
- **Serwer bazy:** Windows z XAMPP, IP `10.119.169.20`
- **Baza:** MySQL/MariaDB, nazwa `kwhotel`
- **Bistro:** Symplex Small Business SB4 (program desktopowy Windows)
- **KWHotel:** Program hotelowy (na tym samym serwerze)
- **Nowy system:** HotelSystem (Next.js + Prisma) na `hotel.karczma-labedz.pl`

## Architektura (założona)

```
HotelSystem (Hetzner)              Serwer 10.119.169.20
┌─────────────────────┐           ┌─────────────────────────────┐
│ API:                │           │  MySQL (kwhotel)            │
│ /occupied-rooms     │◄──────────│  ├─ rezerwacje              │
│ /posting            │   sync.mjs│  ├─ rooms                   │
└─────────────────────┘           │  ├─ klienci                 │
                                  │  └─ faktury                 │
                                  │                             │
                                  │  KWHotel.exe ◄──► Bistro???│
                                  └─────────────────────────────┘
```

## Co działa ✅
1. `sync.mjs` łączy się z bazą MySQL `kwhotel`
2. `sync.mjs` poprawnie tworzy/aktualizuje rekordy w tabeli `rezerwacje`
3. Zapytania SQL potwierdzają że dane są w bazie
4. API HotelSystem zwraca poprawną listę zajętych pokoi

## Co NIE działa ❌
1. Bistro pokazuje inne pokoje niż te w tabeli `rezerwacje`
2. Zmiana `status_id` nie wpływa na widoczność w Bistro
3. Restart Bistro nie pomaga

## Dowody

### Dane w bazie MySQL (po sync):
```sql
SELECT rm.name, k.Nazwisko, r.status_id 
FROM rezerwacje r 
JOIN rooms rm ON r.PokojID = rm.id 
JOIN klienci k ON r.KlientID = k.KlientID 
WHERE r.status_id IN (1,2) AND r.DataDo >= '2026-02-28';

-- Wynik:
-- 011 | Czarnecki Maciej      | 1
-- 012 | KOZELSKA DOROTA       | 1
-- 013 | Stępkowska Małgorzata | 1
-- 014 | Farat Daniel          | 1
-- SI 025 | idea art            | 1
-- SI 026 | idea art            | 1
```

### Co pokazuje Bistro (screenshot):
```
009 | Łukasz Wojenko...    | 27.02.2026 - 28.02.2026
012 | Czanecki Maciej      | 27.02.2026 - 28.02.2026  (INNY niż w bazie!)
015 | Miadziel Roman       | 26.02.2026 - 01.03.2026
SI 020 | Włodarczyk Grze... | 27.02.2026 - 28.02.2026
SI 021 | Grzegorz Włodar... | 27.02.2026 - 01.03.2026
```

### Rozbieżności:
| Bistro pokazuje | Baza MySQL ma |
|-----------------|---------------|
| 009 Łukasz Wojenkowski | BRAK |
| 012 Czanecki Maciej | 012 KOZELSKA DOROTA |
| 015 Miadziel Roman | BRAK (status_id=3) |
| SI 020 Włodarczyk | BRAK |
| SI 021 Grzegorz Włodarczyk | BRAK |
| BRAK | 011 Czarnecki Maciej |
| BRAK | 013 Stępkowska Małgorzata |
| BRAK | 014 Farat Daniel |

## Hipotezy do zbadania

### 1. Bistro czyta z INNEJ bazy/tabeli
Sprawdzić na serwerze:
- Czy jest inna baza MySQL (nie `kwhotel`)?
- Czy jest SQLite/Access w folderze Bistro?
- Pliki `.mdb`, `.db`, `.sqlite` w `C:\Program Files\Symplex\` lub podobnym

### 2. Bistro używa widoku/procedury
Sprawdzić w MySQL:
```sql
SHOW FULL TABLES WHERE Table_type = 'VIEW';
SHOW PROCEDURE STATUS WHERE Db = 'kwhotel';
```

### 3. Bistro ma własny cache
Szukać plików cache w:
- `%APPDATA%\Symplex\`
- `%LOCALAPPDATA%\Symplex\`
- Folder instalacji Bistro

### 4. KWHotel jest pośrednikiem
Może Bistro nie czyta bezpośrednio z MySQL, tylko:
- KWHotel eksportuje dane do pliku
- Bistro czyta ten plik
- Sprawdzić czy KWHotel ma opcję "eksport do POS"

### 5. Inna tabela niż `rezerwacje`
Może Bistro czyta z tabeli:
- `rezerwacje_hotelowe`
- `pokoje_zajete`
- `hotel_rooms`
- Sprawdzić: `SHOW TABLES LIKE '%hotel%'` i `SHOW TABLES LIKE '%bistro%'`

## Konfiguracja sync.mjs

### Plik: `symplex-bridge/.env`
```env
KW_DATABASE_URL=mysql://root:root123@10.119.169.20:3306/kwhotel
OCCUPIED_ROOMS_URL=https://hotel.karczma-labedz.pl/api/v1/external/occupied-rooms
POSTING_URL=https://hotel.karczma-labedz.pl/api/v1/external/posting
EXTERNAL_API_KEY=a89f3281-8ae4-4c06-a351-987b35caa4f
SYNC_DIRECTION=both
```

### Jak działa sync.mjs (kierunek Hotel → KWHotel):

1. **Pobiera zajęte pokoje z API:**
```javascript
const res = await fetch(OCCUPIED_ROOMS_URL, {
  headers: { "X-API-Key": EXTERNAL_API_KEY },
});
const data = await res.json();
// data.rooms = [{roomNumber: "011", guestName: "Czarnecki Maciej", checkIn, checkOut, pax}]
```

2. **Dla każdego pokoju szuka/tworzy w KWHotel:**
```javascript
// Szuka pokoju po nazwie
let kwRoomId = roomByName.get(roomNumber);
if (!kwRoomId) {
  // Tworzy nowy pokój w tabeli `rooms`
  await kw.query(`INSERT INTO rooms (id, name, ...) VALUES (?, ?, ...)`);
}

// Szuka gościa po nazwisku
let kwClientId = clientByName.get(guestName);
if (!kwClientId) {
  // Tworzy nowego klienta w tabeli `klienci`
  await kw.query(`INSERT INTO klienci (KlientID, Nazwisko, ...) VALUES (?, ?, ...)`);
}
```

3. **Tworzy rezerwację:**
```javascript
await kw.query(
  `INSERT INTO rezerwacje 
   (RezerwacjaID, PokojID, KlientID, DataOd, DataDo, Osob, status_id, status2_id, ...)
   VALUES (?, ?, ?, ?, ?, ?, 1, 1, ...)`,
  [rezId, kwRoomId, kwClientId, checkIn, checkOut, pax]
);
// status_id=1 = potwierdzona (widoczna w Bistro - teoretycznie)
```

## Struktura tabel KWHotel

### Tabela `rezerwacje`:
```sql
CREATE TABLE rezerwacje (
  RezerwacjaID int(11) PRIMARY KEY AUTO_INCREMENT,
  PokojID int(11),                    -- FK do rooms.id
  KlientID int(11),                   -- FK do klienci.KlientID
  DataOd datetime NOT NULL,           -- check-in
  DataDo datetime NOT NULL,           -- check-out
  status_id tinyint(3) NOT NULL,      -- 0=wstępna, 1=potwierdzona, 2=zameldowana, 3=wymeldowana
  status2_id int(11) NOT NULL,        -- FK do rez_status.res_id
  Osob tinyint(3) NOT NULL DEFAULT 1, -- liczba gości
  SposRozlicz tinyint(4) NOT NULL,
  CenaDzieci decimal(15,4) NOT NULL,
  DataUtworzenia datetime NOT NULL,
  WplataZaliczka decimal(15,4) NOT NULL,
  CenaTowaryGrupy decimal(15,4) NOT NULL,
  -- ... wiele innych pól
);
```

### Tabela `rooms`:
```sql
CREATE TABLE rooms (
  id int(11) PRIMARY KEY,
  name varchar(50),            -- numer pokoju: "011", "SI 025"
  room_group_id int(11),
  floor int(11),
  cleanliness int(11),
  renovation int(11),
  deleted tinyint(1) DEFAULT 0
);
```

### Tabela `klienci`:
```sql
CREATE TABLE klienci (
  KlientID int(11) PRIMARY KEY,
  Nazwisko varchar(100),
  Active tinyint(1) DEFAULT 1,
  IsFirma tinyint(1) DEFAULT 0
  -- ... inne pola
);
```

### Tabela `rez_status`:
```sql
-- res_id=1: "-- Default --"
-- res_id=2: "pobyt zakonczony rozliczony"
-- res_id=3: "pobyt rozliczony"
-- res_id=4: "Rezygnacja"
```

## Logi sync.mjs (sukces - ale Bistro nie widzi)

```
[2026-02-28T08:06:16.208Z] [INFO] Połączono z bazą KW Hotel: mysql://root:***@10.119.169.20:3306/kwhotel
[2026-02-28T08:06:16.210Z] [INFO] === Kierunek 1: Hotel → KW Hotel (pokoje) ===
[2026-02-28T08:06:16.698Z] [INFO] Pobrano 6 zajętych pokoi z API (data: 2026-02-28)
[2026-02-28T08:06:17.108Z] [INFO] Pokoje: 0 nowych, Goście: 0 nowych
[2026-02-28T08:06:17.108Z] [INFO] Rezerwacje: 6 utworzono, 0 zaktualizowano, 0 zamknięto
[2026-02-28T08:06:17.109Z] [INFO] === Kierunek 2: KW Hotel → Hotel (rachunki) ===
[2026-02-28T08:06:17.118Z] [INFO] Tabela dokumentów: faktury (ID: FakturaID)
[2026-02-28T08:06:17.120Z] [INFO] Brak nowych dokumentów do przetworzenia.
[2026-02-28T08:06:17.120Z] [INFO] === Synchronizacja zakończona ===
```

## Co trzeba zrobić na serwerze 10.119.169.20

### 1. Znaleźć konfigurację Bistro:
```powershell
# Szukaj plików konfiguracyjnych
Get-ChildItem -Path "C:\" -Recurse -Include "*.ini","*.cfg","*.xml","*.config" -ErrorAction SilentlyContinue | 
  Select-String -Pattern "kwhotel|mysql|database|connection" -List
```

### 2. Sprawdzić czy są inne bazy:
```sql
SHOW DATABASES;
-- Sprawdzić czy jest: bistro, symplex, pos, restaurant, itp.
```

### 3. Sprawdzić widoki i procedury:
```sql
USE kwhotel;
SHOW FULL TABLES WHERE Table_type = 'VIEW';
SHOW PROCEDURE STATUS WHERE Db = 'kwhotel';
SHOW FUNCTION STATUS WHERE Db = 'kwhotel';
```

### 4. Znaleźć pliki Bistro:
```powershell
# Folder instalacji Symplex/Bistro
Get-ChildItem -Path "C:\Program Files*" -Recurse -Directory -Filter "*Symplex*" -ErrorAction SilentlyContinue
Get-ChildItem -Path "C:\Program Files*" -Recurse -Directory -Filter "*Bistro*" -ErrorAction SilentlyContinue
Get-ChildItem -Path "C:\Program Files*" -Recurse -Directory -Filter "*Small Business*" -ErrorAction SilentlyContinue

# Pliki baz danych
Get-ChildItem -Path "C:\" -Recurse -Include "*.mdb","*.accdb","*.db","*.sqlite","*.fdb" -ErrorAction SilentlyContinue
```

### 5. Sprawdzić w dokumentacji KWHotel:
- Czy KWHotel ma integrację z POS?
- Czy jest opcja "eksport pokoi do restauracji"?
- Czy Bistro jest oficjalnie wspierane?

## Pełny kod sync.mjs

Plik: `c:\HotelSystem\symplex-bridge\sync.mjs` (760 linii)

Kluczowe funkcje:
- `syncRoomsToKw(kw)` - kierunek Hotel → KWHotel (linie 154-312)
- `syncBillsFromKw(kw)` - kierunek KWHotel → Hotel (linie 328-396)
- `detectDocumentTable(kw)` - wykrywa tabelę z rachunkami (linie 402-466)
- `buildPostingFromDoc()` - buduje obiekt rachunku (linie 535-626)

## Podsumowanie

**Problem:** sync.mjs zapisuje dane do MySQL `kwhotel.rezerwacje`, ale Bistro czyta z innego źródła.

**Kluczowe pytanie:** Skąd Bistro pobiera listę pokoi hotelowych?

**Możliwe rozwiązania:**
1. Znaleźć prawdziwe źródło danych Bistro
2. Skonfigurować Bistro żeby czytało z `kwhotel.rezerwacje`
3. Znaleźć mechanizm synchronizacji KWHotel → Bistro i go użyć
4. Kontakt z supportem Symplex/KWHotel
