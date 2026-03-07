# Audyt TapeChart — spójność z bazą danych (2026-03-07)

## Wyniki zapytań SQL

### TEST 1: Rezerwacje 2026-03-01 .. 2026-03-14
- **Liczba z bazy:** 27 rezerwacji
- Uruchom: `npx tsx scripts/audit-tapechart-sql.ts` — pełna lista w output

### TEST 4a: Rezerwacje zaczynające się PRZED widocznym zakresem (clamp lewa)
- **Liczba:** 0
- Brak rezerwacji, których checkIn < 2026-03-01 i checkOut > 2026-03-01

### TEST 4b: Rezerwacje kończące się PO widocznym zakresie (clamp prawa)
- **Liczba:** 0

### TEST 4c: Rezerwacje jednodniowe (1 noc)
- **Liczba:** 14

### TEST 7: Rezerwacje PENDING
- **Liczba:** 0

### TEST 8: Nakładające się rezerwacje (ten sam pokój)
- Są nakładające się pary w historii (głównie SI 031)
- W zakresie 2026-03-01..14 brak nakładających się rezerwacji

### TEST 9: Wszystkie pokoje z bazy
- **Liczba:** 28 pokoi
- Numery: 001, 002, 003, …, 016, SI 020 … SI 031

---

## Logi debugowe TapeChart (audyt)

**Warunek:** dodaj `?audit=1` do URL (np. `http://localhost:3011/front-office?audit=1`).

W konsoli pojawią się:
- `TapeChart reservations count:` — liczba rezerwacji w store
- `TapeChart filteredReservations count:` — po filtrowaniu (widoczne pokoje, grupa, wyszukiwanie)
- `TapeChart reservationPlacements count:` — ile pasków jest renderowanych
- `TapeChart roomRowIndex:` — mapowanie numer pokoju → wiersz
- `TapeChart displayRooms:` — lista numerów pokoi na siatce
- `Placement: {id} room=… checkIn=… checkOut=… gridCol=… gridRow=…` — dla każdego pasku

**Usunięcie logów:** usuń bloki oznaczone komentarzami `// AUDIT TEST … – usuń po weryfikacji` z `components/tape-chart/index.tsx`.

---

## Weryfikacja użytkownika

1. Uruchom `npm run dev:clean`, otwórz `/front-office?audit=1`.
2. Ustaw widok na 2026-03-01 .. 2026-03-14 (strzałki / mini-mapka).
3. Porównaj w konsoli:
   - `reservations count` vs 27 (zależy od zakresu ładowania)
   - `reservationPlacements count` vs `filteredReservations count` (powinny być równe)
   - Sprawdź, czy `displayRooms` zawiera wszystkie 28 pokoi z bazy (lub filtrowany podzbiór).
4. Sprawdź `gridRow` dla Room 001: powinno być 2 (headerRowCount=1) lub 3 (headerRowCount=2).

---

## Wprowadzone zmiany

### 1. Status PENDING — kolor i legenda
- **Plik:** `lib/tape-chart-types.ts`
- Dodano `PENDING` do `ReservationStatus`.
- Dodano kolor: `rgb(161 161 170)` (szary/cynk).
- **Plik:** `components/tape-chart/index.tsx`
- Dodano etykiety i opisy dla PENDING („Oczekuje”).

### 2. Skrypt audytu SQL
- **Plik:** `scripts/audit-tapechart-sql.ts`
- Uruchom: `npx tsx scripts/audit-tapechart-sql.ts`
- Wykonuje zapytania z TEST 1, 4a, 4b, 4c, 7, 8, 9.

### 3. Logi debugowe
- **Plik:** `components/tape-chart/index.tsx`
- Logi włączane parametrem `?audit=1` w URL.
- Do usunięcia po weryfikacji.

---

## TEST 5, 6, 10 — testy automatyczne Playwright

Plik: `tests/tapechart-audit-test5-6-10.spec.ts`  
API: `GET /api/test/get-reservation?id=xxx`

**Uruchom (serwer dev na localhost:3011):**
```powershell
npx playwright test tests/tapechart-audit-test5-6-10.spec.ts --project=chromium
```

- **TEST 5:** Drag-and-drop (Shift+przeciągnij) — weryfikuje aktualizację room/dat w DB.
- **TEST 6:** Resize prawej krawędzi paska — weryfikuje aktualizację checkOut w DB.
- **TEST 10:** Double-click → edycja checkOut → zapis — pasek odświeża się bez F5.
