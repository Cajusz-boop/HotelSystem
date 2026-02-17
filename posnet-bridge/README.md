# POSNET Trio Bridge (Windows)

Usługa pośrednicząca (bridge) między aplikacją hotelową (Next.js) a kasą fiskalną **POSNET Trio**.

## Uruchomienie

```bash
npm run posnet:bridge
```

Bridge wystartuje na `http://127.0.0.1:9977`.

## Endpointy

| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/health` | Status bridge'a (diagnostyka, liczniki, uptime) |
| `POST` | `/fiscal/print` | Druk paragonu fiskalnego |
| `POST` | `/fiscal/invoice` | Druk faktury na kasie |
| `POST` | `/fiscal/report/x` | Raport X (informacyjny, nie zamyka dnia) |
| `POST` | `/fiscal/report/z` | Raport Z (dobowy, zamyka dzień) |
| `POST` | `/fiscal/report/periodic` | Raport okresowy/miesięczny |
| `POST` | `/fiscal/storno` | Storno (anulowanie) paragonu |

## Konfiguracja (ENV)

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `POSNET_BRIDGE_PORT` | `9977` | Port na którym nasłuchuje bridge |
| `FISCAL_POSNET_API_KEY` | (brak) | Klucz API — jeśli ustawiony, wymagany nagłówek `x-api-key` |
| `FISCAL_POSNET_SPOOL_DIR` | `posnet-bridge/spool/` | Katalog zapisu zleceń JSON |

## Tryb pracy

### Tryb SPOOL (domyślny)

Bridge przyjmuje zlecenia i zapisuje je jako pliki JSON do katalogu `spool/`. To pozwala przetestować integrację end-to-end bez fizycznej kasy.

### Tryb druku (produkcja)

Aby bridge faktycznie drukował na POSNET Trio:

1. Zainstaluj sterownik POSNET na komputerze
2. Podłącz kasę przez USB/COM/LAN
3. W `server.mjs` zamień wywołania `spoolWrite(...)` na wywołania SDK/OPOS producenta

## Format żądań

### Paragon (`POST /fiscal/print`)

```json
{
  "transactionId": "tx-123",
  "reservationId": "res-456",
  "items": [
    { "name": "Nocleg pok. 101", "quantity": 1, "unitPrice": 250.00, "vatRate": 8 }
  ],
  "totalAmount": 250.00,
  "paymentType": "CARD",
  "headerLines": ["HOTEL ŁABĘDŹ", "ul. Przykładowa 1"],
  "footerLines": ["Dziękujemy za wizytę!"]
}
```

### Faktura (`POST /fiscal/invoice`)

```json
{
  "reservationId": "res-456",
  "company": {
    "nip": "1234567890",
    "name": "Firma Sp. z o.o.",
    "address": "ul. Biznesowa 5",
    "postalCode": "00-001",
    "city": "Warszawa"
  },
  "items": [
    { "name": "Nocleg", "quantity": 3, "unitPrice": 250.00, "vatRate": 8 }
  ],
  "totalAmount": 750.00
}
```

### Odpowiedź (sukces)

```json
{ "success": true, "receiptNumber": "PAR-A1B2C3D4" }
```

### Odpowiedź (błąd)

```json
{ "success": false, "error": "Opis błędu" }
```
