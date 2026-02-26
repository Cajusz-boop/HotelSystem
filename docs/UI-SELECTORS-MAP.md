# Mapa selektorów UI — HotelSystem PMS

Dokument generowany na potrzeby testów E2E Playwright. Zawiera selektory dla głównych widoków i formularzy.

## Serwer dev

- **Base URL:** `http://localhost:3011`

---

## 1. Dialog rezerwacji (Unified Reservation Dialog)

### Przycisk otwierania
- `[data-testid="create-reservation-open-btn"]` — przycisk „Zarezerwuj” na TapeChart
- URL: `/front-office?e2eOpenCreate=1` — otwiera dialog od razu

### Zakładki dialogu
- `role="tab"` + `name: /Dane|Szczegóły|Rozlicz|Dokumenty|i/` — zakładki dialogu

### Pola formularza (Settlement Tab / settlement-tab.tsx)
| Pole | Selektor | ID |
|------|----------|-----|
| Pokój | `#uni-room` | `data-testid="create-reservation-room"` |
| Check-in | `#uni-checkIn` | `data-testid="create-reservation-checkIn"` |
| Check-out | `#uni-checkOut` | `data-testid="create-reservation-checkOut"` |
| Status | `#uni-status` | `data-testid="create-reservation-status"` |
| Gość | `#uni-guestName` | `data-testid="create-reservation-guest"` |
| Parking | `#uni-parking` | `data-testid="create-reservation-parking"` |

### Przyciski
- `[data-testid="create-reservation-save"]` — Zapisz
- `[data-testid="create-reservation-error"]` — komunikat błędu

---

## 2. TapeChart (Grafik recepcji)

### Struktura
- `[data-testid="room-row-{numer}"]` — wiersz pokoju (np. `room-row-101`, `room-row-102`)
- `[data-testid="reservation-bar"]` — pasek rezerwacji
- `[data-reservation-id="{id}"]` — atrybut na pasku (ID rezerwacji)
- `[data-testid="cell-{roomNumber}-{dateStr}"]` — komórka (np. `cell-101-2026-02-26`)
- `[data-date-header]` — nagłówek kolumny daty

### Interakcje
- **Double-click** na pasku → otwiera dialog rezerwacji (edycja)
- **Right-click** na pasku → menu kontekstowe
- **Drag** — pasek można przeciągać (zmiana pokoju/daty) — dla CONFIRMED, CHECKED_IN

### Menu kontekstowe (Context Menu)
- `role="menuitem"` + `name: /Edytuj rezerwację/i`
- `role="menuitem"` + `name: /Zamelduj/i`
- `role="menuitem"` + `name: /Wymelduj/i`
- `role="menuitem"` + `name: /Anuluj/i`
- `role="menuitem"` + `name: /Przedłuż pobyt/i`
- `role="menuitem"` + `name: /Skróć pobyt/i`
- `role="menuitem"` + `name: /Rozliczenie/i` — otwiera zakładkę Rozliczenie
- `role="menuitem"` + `name: /Podziel rezerwację/i`

---

## 3. Zakładka Rozliczenie (Settlement Tab)

### Zakładka
- `role="tab"` + `name: /Rozlicz/i`

### Obciążenia
- `role="button"` + `name: /Dodaj obciążenie/i` — otwiera dialog dodawania obciążenia
- `role="heading"` + `name: /Dodaj obciążenie/i` — tytuł dialogu (weryfikacja otwarcia)

### Płatności
- Przycisk dodawania płatności — szukać `role="button"` + `name: /Płatność|Zarejestruj płatność|Dodaj płatność/i`

### Dokumenty
- Przyciski: Paragon, Faktura VAT, Proforma — w zakładce lub menu kontekstowym

---

## 4. Add Charge Dialog (Dodaj obciążenie)

| Element | Selektor |
|---------|----------|
| Kwota | `#add-charge-amount` (input) |
| Typ | `#add-charge-type` (select) — opcje: MINIBAR, GASTRONOMY, SPA, PARKING, PHONE, LAUNDRY, OTHER |
| Opis | `#add-charge-desc` (input, opcjonalny) |
| Przycisk Dodaj | `role="button"` + `name: /Dodaj obciążenie/i` (ostatni w dialogu) |

### Toast po sukcesie
- Tekst: „Obciążenie dodane do folio” lub zawiera „45.00” / „Minibar”

---

## 5. Strona /finance

### Zakładki / sekcje
- Tekst widoczny: „Finanse”, „Rachunki”, „Faktury”, „Transakcje”, „Zamknięcie”
- `table`, `[role="grid"]`, `.receipts-list`, `.transactions` — listy/tabele

### Funkcje
- Nocny audyt (Moon)
- Raport kasowy
- Zamknięcie zmiany kasowej
- Lista rachunków (paragonów)
- Lista faktur

---

## 6. Booking Engine (/booking)

### Formularz wyszukiwania
- `role="heading"` + `name: /Rezerwacja|dostępność/i`
- Label/Zameldowanie: `getByLabel(/Zameldowanie|Check-in/i)`
- Label/Wymeldowanie: `getByLabel(/Wymeldowanie|Check-out/i)`
- Dorosłych: `select` z `option[value="2"]`
- Przycisk Szukaj: `role="button"` + `name: /Szukaj|Sprawdź|Wyszukaj|Search/i`

### Wyniki
- Tekst: „dostępne”, „pokoi”, „wynik”, „Znaleziono”
- Elementy kart: `[class*="room"]`, `[class*="card"]`

---

## 7. CRM / Kontrahenci (/kontrahenci)

- `role="heading"` + `name: "Kontrahenci"`
- Pole szukaj: `getByLabel(/Szukaj/i)` lub `getByPlaceholder(/Nazwisko|Szukaj/i)`

---

## 8. Księga meldunkowa (/ksiega-meldunkowa)

- `role="heading"` + `name: /Księga meldunkowa/i`
- Tabela: `table`, `[role="grid"]`

---

## 9. Dashboard (/dashboard, /front-office)

### Sekcje (dashboard)
- `[data-testid="checkin-section"]` — przyjazdy
- `[data-testid="checkout-section"]` — wyjazdy

### Front Office
- TapeChart (jak wyżej)

---

## 10. Przyciski akcji — podsumowanie

| Akcja | Selektor / Metoda |
|-------|-------------------|
| Zamelduj | `role="button"` + `name: /Melduj gościa/i` (w dialogu) lub `role="menuitem"` + `name: /Zamelduj/i` (menu kontekstowe) |
| Wymelduj | `role="menuitem"` + `name: /Wymelduj/i` → potem `role="dialog"` + `role="button"` + `name: /^Wymelduj/` |
| Anuluj rezerwację | `role="menuitem"` + `name: /Anuluj/i` |
| Zapisz | `[data-testid="create-reservation-save"]` |
| Dodaj obciążenie | `role="button"` + `name: /Dodaj obciążenie/i` |
| Otwórz nową rezerwację | `[data-testid="create-reservation-open-btn"]` |

---

## 11. Dialog (ogólne)

- `role="dialog"` — dowolny dialog
- `role="button"` + `name: /Zamknij/i` — przycisk zamykania (aria-label)
- `Escape` — zamyka dialog
