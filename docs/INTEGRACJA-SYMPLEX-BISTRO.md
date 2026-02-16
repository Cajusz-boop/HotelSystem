# Integracja z Symplex Bistro — dania na pokój

Celem jest **dwukierunkowa integracja** systemu hotelowego z restauracją (Symplex Bistro):

1. **Hotel → Bistro:** Lista zajętych pokoi z nazwiskami gości, żeby kelner mógł wybrać pokój.
2. **Bistro → Hotel:** Rachunki "na pokój" z listą dań trafiają do rezerwacji gościa.

## Metody integracji

### Metoda 1: Przez bazę KW Hotel (REKOMENDOWANA — bez udziału Symplex)

Jeśli Bistro jest już podpięte do KW Hotel (wspólna baza MySQL), nowy system
**pisze bezpośrednio do tabel KW Hotel** — Bistro nie zauważa różnicy.

```
Nowy system ──API──► sync.mjs ──SQL──► Baza KW Hotel ◄──── Bistro
                                  (rooms, klienci,         (czyta pokoje,
                                   rezerwacje)              pisze rachunki)
```

**Skrypt:** `symplex-bridge/sync.mjs`
**Dokumentacja:** `symplex-bridge/README.md`

#### Szybki start

```powershell
# 1. Diagnostyka bazy
$env:KW_DATABASE_URL = "mysql://user:pass@192.168.1.10:3306/kwhotel"
npm run symplex:recon

# 2. Konfiguracja
Copy-Item symplex-bridge\.env.example symplex-bridge\.env
# Edytuj symplex-bridge\.env — uzupełnij dane

# 3. Test
npm run symplex:test

# 4. Ręczna synchronizacja
npm run symplex:sync

# 5. Automatyczna synchronizacja (co 2 min)
powershell -ExecutionPolicy Bypass -File symplex-bridge\setup-scheduler.ps1
```

### Metoda 2: Przez pliki (eksport/import)

Jeśli Bistro eksportuje rachunki do plików CSV/EDI, bridge czyta je z folderu
i wysyła do API.

**Skrypt:** `symplex-bridge/run.mjs`

```powershell
$env:POSTING_URL = "https://hotel.karczma-labedz.pl/api/v1/external/posting"
$env:EXTERNAL_API_KEY = "klucz"
$env:SYMPLEX_WATCH_DIR = "C:\Symplex\eksport\na-pokoj"
npm run symplex:bridge
```

---

## Architektura integracji (Metoda 1 — przez bazę)

```
+------------------+          +------------------+          +------------------+
|   Nowy system    |  API     |     Bridge       |  MySQL   |  Baza KW Hotel   |
|   hotelowy       |◄────────►| symplex-bridge/  |◄────────►|  (wspólna z      |
|                  |          |   sync.mjs       |          |   Bistro)        |
|  hotel.karczma-  |          |                  |          |                  |
|  labedz.pl       |          | co 2 min:        |          | rooms            |
|                  |          | 1. GET pokoje    |          | klienci          |
|  /occupied-rooms |          | 2. WRITE do KW   |          | rezerwacje       |
|  /posting        |          | 3. READ rachunki |          | dokumenty*       |
|                  |          | 4. POST do API   |          |                  |
+------------------+          +------------------+          +------------------+
                                                                    ▲
                                                                    │ czyta/pisze
                                                            +------------------+
                                                            |  Symplex Bistro  |
                                                            |  (restauracja)   |
                                                            |                  |
                                                            |  kelner nabija   |
                                                            |  "na pokój 101"  |
                                                            +------------------+
```

## API systemu hotelowego (2 endpointy)

### 1. Lista zajętych pokoi

**`GET /api/v1/external/occupied-rooms`**

Bistro (przez bridge) odpytuje ten endpoint, żeby kelner widział aktualną listę
zajętych pokoi z nazwiskami gości.

**Query parametry:**
- `date` (opcjonalnie) — data w formacie YYYY-MM-DD (domyślnie: dzisiaj)

**Autoryzacja:** nagłówek `X-API-Key` lub `Authorization: Bearer <key>`

**Przykład odpowiedzi:**

```json
{
  "date": "2026-02-16",
  "occupiedCount": 5,
  "rooms": [
    {
      "roomNumber": "101",
      "roomType": "Queen",
      "guestName": "Jan Kowalski",
      "reservationId": "abc123",
      "checkIn": "2026-02-14",
      "checkOut": "2026-02-18",
      "pax": 2
    }
  ]
}
```

### 2. Nabijanie rachunku na pokój

**`POST /api/v1/external/posting`**

Gdy kelner zamknie rachunek "na pokój", bridge wysyła obciążenie do systemu hotelowego.

**Body (JSON):**

| Pole | Typ | Wymagane | Opis |
|------|-----|----------|------|
| `roomNumber` | string | tak* | Numer pokoju |
| `reservationId` | string | tak* | ID rezerwacji (alternatywa do roomNumber) |
| `amount` | number | tak | Kwota łączna |
| `type` | string | nie | Typ: `RESTAURANT`, `BAR` (domyślnie `POSTING`) |
| `description` | string | nie | Opis (np. "Restauracja — obiad") |
| `items` | array | nie | Lista dań: `{ name, quantity, unitPrice }` |
| `receiptNumber` | string | nie | Numer rachunku z Bistro |
| `cashierName` | string | nie | Imię kelnera |
| `posSystem` | string | nie | Nazwa systemu (np. "Symplex Bistro") |

*Wymagane jedno z: `roomNumber` lub `reservationId`

**Przykład z pozycjami:**

```json
{
  "roomNumber": "101",
  "amount": 89.50,
  "type": "RESTAURANT",
  "description": "Restauracja — obiad",
  "receiptNumber": "R-2024-0142",
  "cashierName": "Anna K.",
  "posSystem": "Symplex Bistro",
  "items": [
    { "name": "Zupa dnia", "quantity": 1, "unitPrice": 15.00 },
    { "name": "Kotlet schabowy", "quantity": 1, "unitPrice": 45.00 },
    { "name": "Kawa", "quantity": 2, "unitPrice": 8.00 },
    { "name": "Deser", "quantity": 1, "unitPrice": 13.50 }
  ]
}
```

Dania pojawiają się w zakładce **Posiłki** w rezerwacji gościa.

---

## Konfiguracja

### System hotelowy (.env)

```env
EXTERNAL_API_KEY=twoj-bezpieczny-klucz
```

### Bridge (symplex-bridge/.env)

```env
KW_DATABASE_URL=mysql://user:pass@192.168.1.10:3306/kwhotel
OCCUPIED_ROOMS_URL=https://hotel.karczma-labedz.pl/api/v1/external/occupied-rooms
POSTING_URL=https://hotel.karczma-labedz.pl/api/v1/external/posting
EXTERNAL_API_KEY=twoj-bezpieczny-klucz
```

---

## Komendy npm

| Komenda | Opis |
|---------|------|
| `npm run symplex:sync` | Synchronizacja obu kierunków |
| `npm run symplex:sync:to-kw` | Tylko pokoje → KW Hotel (Bistro) |
| `npm run symplex:sync:from-kw` | Tylko rachunki → nowy system |
| `npm run symplex:recon` | Diagnostyka bazy KW Hotel |
| `npm run symplex:test` | Test połączeń i uprawnień |
| `npm run symplex:bridge` | Stary bridge plikowy (CSV/EDI) |

---

## Podsumowanie

| Element | Status |
|---------|--------|
| API: lista zajętych pokoi | Gotowe — `GET /api/v1/external/occupied-rooms` |
| API: posting rachunków z pozycjami | Gotowe — `POST /api/v1/external/posting` |
| Bridge: sync przez bazę KW Hotel | Gotowe — `symplex-bridge/sync.mjs` |
| Bridge: rachunki plikowe (CSV) | Gotowe — `symplex-bridge/run.mjs` |
| Diagnostyka bazy | Gotowe — `symplex-bridge/recon-kwhotel-db.mjs` |
| Test integracji | Gotowe — `symplex-bridge/test-sync.mjs` |
| Harmonogram Windows | Gotowe — `symplex-bridge/setup-scheduler.ps1` |
| UI: zakładka Posiłki w rezerwacji | Gotowe — lista dań nabitych na pokój |
| Konfiguracja Bistro | Nie wymaga zmian (Bistro czyta z bazy KW Hotel jak dotychczas) |
