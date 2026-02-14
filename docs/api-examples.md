# Przykłady wywołań API dla partnerów

Bazowy URL: `https://twoja-domena.pl/api/v1`  
Autoryzacja: ustaw zmienną `EXTERNAL_API_KEY` w panelu; w żądaniach podaj nagłówek `X-API-Key` lub `Authorization: Bearer YOUR_KEY`.

---

## 1. Dostępność pokoi (GET /external/availability)

Parametry zapytania:
- `from` (wymagane) – data od, format YYYY-MM-DD
- `to` (wymagane) – data do, format YYYY-MM-DD
- `roomType` (opcjonalne) – filtr po typie pokoju

### cURL

```bash
curl -X GET "https://twoja-domena.pl/api/v1/external/availability?from=2025-02-15&to=2025-02-20" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Odpowiedź 200

```json
{
  "rooms": [
    {
      "id": "clxx...",
      "number": "101",
      "type": "Standard",
      "price": 350.00
    }
  ]
}
```

---

## 2. Obciążenie rezerwacji/pokoju (POST /external/posting)

Body (JSON):
- `amount` (wymagane) – kwota w PLN
- `reservationId` (opcjonalne) – ID rezerwacji
- `roomNumber` (opcjonalne) – numer pokoju, gdy brak reservationId
- `type` (opcjonalne) – domyślnie "POSTING"
- `description` (opcjonalne) – opis pozycji

### cURL – obciążenie po ID rezerwacji

```bash
curl -X POST "https://twoja-domena.pl/api/v1/external/posting" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"reservationId": "clxx...", "amount": 49.99, "description": "Room service"}'
```

### cURL – obciążenie po numerze pokoju

```bash
curl -X POST "https://twoja-domena.pl/api/v1/external/posting" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"roomNumber": "101", "amount": 29.00, "description": "Mini bar"}'
```

### Odpowiedź 200

```json
{
  "transactionId": "clxx...",
  "reservationId": "clxx..."
}
```

### Błędy

- **400** – brak `amount` lub kwota ≤ 0
- **401** – brak lub nieprawidłowy klucz API
- **404** – rezerwacja lub pokój nie istnieje
