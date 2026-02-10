# Integracja z kasą fiskalną

Program może wysyłać paragony do kasy fiskalnej przy każdej zarejestrowanej transakcji (obciążenie pokoju, zaliczka).

## Włączenie

W pliku `.env` ustaw:

```env
FISCAL_ENABLED=true
FISCAL_DRIVER=mock
```

- **FISCAL_ENABLED** – `true` włącza drukowanie paragonu przy:
  - utworzeniu transakcji przez API posting (`/api/v1/external/posting`),
  - rejestracji zaliczki (Deposit) w panelu Finanse.
- **FISCAL_DRIVER** – wybór sterownika:
  - `mock` – symulacja (log w konsoli serwera, bez fizycznej kasy),
  - `posnet` – POSNET przez HTTP do lokalnego bridge (zalecane na Windows),
  - `novitus`, `elzab` – zarezerwowane pod przyszłe sterowniki sprzętowe (obecnie działają jak mock).

Opcjonalnie:

- **FISCAL_TAX_ID** – NIP jednostki (dla sterowników sprzętowych).
- **FISCAL_POINT_NAME** – nazwa punktu sprzedaży.

## Gdzie jest drukowany paragon

1. **Posting (obciążenie pokoju)** – każda transakcja utworzona przez `POST /api/v1/external/posting` (np. z systemu POS, restauracji) powoduje wysłanie paragonu do kasy (jeśli `FISCAL_ENABLED=true`).
2. **Zaliczka (Deposit)** – rejestracja płatności zaliczkowej w Finansach wywołuje druk paragonu z pozycją „Zaliczka”.

Błąd kasy (np. brak połączenia) **nie cofa** transakcji w systemie – transakcja zostaje zapisana, błąd jest logowany. W przyszłości można dodać retry lub kolejkę.

## Rozszerzenie o fizyczną kasę (POSNET, Novitus, Elzab)

W katalogu `lib/fiscal/`:

- **types.ts** – typy i interfejs `FiscalDriver`.
- **mock-driver.ts** – sterownik symulacyjny.
- **index.ts** – wybór sterownika i funkcja `printFiscalReceipt()`.

Aby podłączyć prawdziwą kasę:

1. Zaimplementuj sterownik zgodny z `FiscalDriver` (np. `lib/fiscal/posnet-driver.ts`) – komunikacja z urządzeniem (RS-232, USB, sieć) według dokumentacji producenta.
2. W `lib/fiscal/index.ts` w `getDriver()` dodaj case `posnet` / `novitus` / `elzab` i zwróć nowy sterownik.
3. Ustaw w `.env`: `FISCAL_DRIVER=posnet` (lub odpowiedni) oraz ewentualnie port/URL w zmiennych środowiskowych.

Producenci (np. Novitus) udostępniają protokoły komunikacyjne w dokumentacji technicznej; często wymagana jest biblioteka natywna lub driver w C/C++ – w Node.js można użyć bindingów (np. `serialport`) lub zewnętrznego demona, który nasłuchuje na TCP i wysyła komendy do kasy.

## POSNET – jak uruchomić w praktyce

W systemach Windows najprościej jest użyć podejścia **bridge**:

- aplikacja hotelowa (Next.js) wysyła paragon jako JSON,
- osobny proces/usługa na Windows komunikuje się z POSNET (USB/COM/LAN) przy użyciu sterownika producenta / OPOS / SDK.

### Konfiguracja `.env`

```env
FISCAL_ENABLED=true
FISCAL_DRIVER=posnet
FISCAL_POSNET_ENDPOINT=http://127.0.0.1:9977/fiscal/print
# FISCAL_POSNET_API_KEY=opcjonalny-klucz
# FISCAL_POSNET_TIMEOUT_MS=8000
```

### Uruchomienie bridge (Windows)

W tym repozytorium jest gotowy prosty bridge, który **przyjmuje** zlecenia paragonu i zapisuje je do `posnet-bridge/spool/`.

Uruchom:

```bash
npm run posnet:bridge
```

Sprawdź działanie:

- `GET http://127.0.0.1:9977/health`

> Dopiero w kolejnym kroku podpinamy w bridge sterownik POSNET/OPOS/SDK, żeby faktycznie drukował na urządzeniu.

### Format żądania do bridge

Aplikacja wysyła do `FISCAL_POSNET_ENDPOINT` JSON w formacie `FiscalReceiptRequest` (m.in. `transactionId`, `reservationId`, `items`, `totalAmount`, `paymentType`).

Bridge powinien zwrócić JSON:

```json
{ "success": true, "receiptNumber": "..." }
```

albo:

```json
{ "success": false, "error": "..." }
```

### Co dalej

Jeśli podasz mi:

- model POSNET (np. Thermal/Ergo/…),
- sposób podłączenia (USB/COM/LAN),
- czy masz sterownik/OPOS/SDK od POSNET,

to przygotuję konkretny bridge (np. w .NET) pod Twoją konfigurację.
