# Integracja z Symplex Bistro -- dania na pokoj

Celem jest **dwukierunkowa integracja** systemu hotelowego z restauracją (Symplex Bistro):

1. **Hotel → Bistro:** Lista zajętych pokoi z nazwiskami gości, żeby kelner mógł wybrać pokój.
2. **Bistro → Hotel:** Rachunki "na pokój" z listą dań trafiają do rezerwacji gościa.

## Architektura integracji

```
+------------------+          +------------------+          +------------------+
|   Symplex Bistro |  <----   |     Bridge       |  <----   |  System hotelowy |
|   (restauracja)  |  pokoje  | symplex-bridge/  |  API     |  (ten program)   |
|                  |  ------→ |   run.mjs        |  ------→ |                  |
|  kelner nabija   |  rachunki|  przetwarza pliki|  POST    |  rezerwacja →    |
|  "na pokój 101"  |          |  i wysyła do API |          |  zakładka Posiłki|
+------------------+          +------------------+          +------------------+
```

---

## API systemu hotelowego (2 endpointy)

### 1. Lista zajętych pokoi -- kelner wybiera pokój

**`GET /api/v1/external/occupied-rooms`**

Bistro (lub bridge) odpytuje ten endpoint, żeby kelner widział aktualną listę zajętych pokoi z nazwiskami gości.

**Query parametry:**
- `date` (opcjonalnie) -- data w formacie YYYY-MM-DD (domyślnie: dzisiaj)

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
    },
    {
      "roomNumber": "102",
      "roomType": "Twin",
      "guestName": "Anna Nowak",
      "checkIn": "2026-02-15",
      "checkOut": "2026-02-17",
      "pax": 1
    }
  ]
}
```

**Jak podłączyć do Bistro:**
- Bridge co kilka minut pobiera listę i generuje plik importu kontrahentów/pokoi do Bistro (format EDI Symplex).
- Lub: zapytaj dealera Symplex o import kontrahentów z pliku / API.

### 2. Nabijanie rachunku na pokój -- dania trafiają do hotelu

**`POST /api/v1/external/posting`**

Gdy kelner zamknie rachunek "na pokój", Bistro (lub bridge) wysyła obciążenie do systemu hotelowego.

**Body (JSON):**

| Pole | Typ | Wymagane | Opis |
|------|-----|----------|------|
| `roomNumber` | string | tak* | Numer pokoju |
| `reservationId` | string | tak* | ID rezerwacji (alternatywa do roomNumber) |
| `amount` | number | tak | Kwota łączna |
| `type` | string | nie | Typ: `RESTAURANT`, `BAR` (domyślnie `POSTING`) |
| `description` | string | nie | Opis (np. "Restauracja -- obiad") |
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
  "description": "Restauracja -- obiad",
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

## Bridge (symplex-bridge/)

Bridge działa w dwóch kierunkach:

### Kierunek 1: Hotel → Bistro (lista pokoi)

Bridge może co kilka minut:
1. Pobrać `GET /api/v1/external/occupied-rooms`
2. Wygenerować plik z listą pokoi w formacie Symplex EDI
3. Umieścić plik w folderze importu Bistro

### Kierunek 2: Bistro → Hotel (rachunki)

Bridge czyta pliki eksportu z Bistro i wysyła do API:
1. Bistro eksportuje zamknięte rachunki "na pokój" do folderu
2. Bridge parsuje plik (prosty CSV lub rozszerzony z pozycjami)
3. Bridge wysyła `POST /api/v1/external/posting` do systemu hotelowego

**Szczegóły:** zob. [symplex-bridge/README.md](../symplex-bridge/README.md)

---

## Co ustalić z dealerem Symplex

1. **Jak Bistro importuje listę pokoi** -- czy przez plik EDI, tabelę kontrahentów, czy API?
2. **Format eksportu rachunków "na pokój"** -- EDI, CSV, jakie pola?
3. **Jak oznaczyć rachunek "na pokój"** -- pole kontrahenta = numer pokoju? Uwagi? Dedykowane pole?
4. **Moment eksportu** -- przy zamknięciu rachunku, co X minut, na żądanie?
5. **Obecna integracja z KW Hotel** -- czy da się przełączyć/zduplikować?

---

## Konfiguracja

### System hotelowy (.env)

```env
EXTERNAL_API_KEY=twoj-bezpieczny-klucz
```

### Bridge (zmienne środowiskowe)

```env
POSTING_URL=https://twoj-hotel.example.com/api/v1/external/posting
EXTERNAL_API_KEY=twoj-bezpieczny-klucz
SYMPLEX_WATCH_DIR=C:\Symplex\eksport\na-pokoj
```

---

## Podsumowanie

| Element | Status |
|---------|--------|
| API: lista zajętych pokoi | Gotowe -- `GET /api/v1/external/occupied-rooms` |
| API: posting rachunków z pozycjami | Gotowe -- `POST /api/v1/external/posting` |
| Bridge: rachunki Bistro → hotel | Gotowe -- `symplex-bridge/run.mjs` |
| Bridge: pokoje hotel → Bistro | Do dopasowania po ustaleniu formatu z Symplex |
| UI: zakładka Posiłki w rezerwacji | Gotowe -- lista dań nabitych na pokój |
| Konfiguracja Bistro | Wymaga ustalenia z dealerem Symplex |
