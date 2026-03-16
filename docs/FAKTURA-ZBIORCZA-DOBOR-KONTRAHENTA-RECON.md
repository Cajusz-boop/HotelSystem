# Faza 1 — Recon: Dobór kontrahenta przy tworzeniu FVZ

## 1. Gdzie w UI użytkownik wybiera rezerwacje i inicjuje tworzenie FVZ

**Dwa miejsca:**

### A) Tape Chart (grafik pokojów)
- **Pliki:** `components/tape-chart/index.tsx`, `components/tape-chart/reservation-bar-with-menu.tsx`
- **Przepływ:** Użytkownik zaznacza rezerwacje Ctrl+klik (Set `selectedReservationIds`), potem prawy przycisk na zaznaczonym pasku → menu kontekstowe → pozycja „Faktura zbiorcza”. Klik uruchamia `handleCreateConsolidatedInvoiceRequest(primaryReservation)` i ustawia `consolidatedInvoicePending` z `rightClickedReservation` (primary) oraz `idsToInclude`. Otwiera się **UnifiedReservationDialog** w trybie edycji z `consolidatedReservationIds` i `primaryReservation`. W dialogu użytkownik może przejść do „Wystawić dokument?” i tam wywoływane jest `createConsolidatedVatInvoice({ reservationIds, companyId: primaryReservation.companyId })`.
- **Dane o rezerwacjach:** Tablica `reservations` ze store’u (typ `Reservation[]` z `lib/tape-chart-types`). Każdy element ma `companyId`, `companyName` (z mapowania w `app/actions/tape-chart.ts` — relacja `company` jest **eager-loaded** w `getTapeChartData`). Zaznaczone rezerwacje = `reservations.filter(r => selectedReservationIds.has(r.id))` — **pełne obiekty z firmą są dostępne**.

### B) Kontrahenci (strona firmy)
- **Plik:** `app/kontrahenci/page.tsx`
- **Przepływ:** Użytkownik jest na karcie konkretnej firmy (`selectedCompany`). Przycisk „Nowa faktura zbiorcza” → `loadReservationsForInvoice(selectedCompany.id)` ładuje listę rezerwacji **już przefiltrowanych po tej firmie** (`getReservationsForConsolidatedInvoice(companyId)`). Wybór rezerwacji w tabeli (checkboxy `selectedForInvoice`), przycisk „Wystaw fakturę zbiorczą” → `handleCreateConsolidatedInvoice({ companyId: selectedCompany.id, reservationIds: Array.from(selectedForInvoice) })`.
- **Dane o rezerwacjach:** Lista `invoiceReservations` nie zawiera pola `companyId` w typie (zwracana struktura z akcji ma tylko id, guestName, roomNumber, daty, totalAmount, hasInvoice). Kontrahent jest **z góry ustalony** (`selectedCompany`), więc **reguła doboru kontrahenta wg specu nie ma tu zastosowania** — zawsze jedna firma.

---

## 2. Akcja serwerowa tworząca FVZ — sygnatura i wyznaczanie kontrahenta

**Plik:** `app/actions/companies.ts`

- **createConsolidatedInvoiceFromReservationIds(data):**
  - Parametry: `reservationIds: string[]`, `companyId: string`, opcjonalnie `vatRate`, `paymentTermDays`, `notes`, `paymentMethod`.
  - **Dane kontrahenta:** Nie są wyznaczane z rezerwacji. Wywołujący **musi przekazać `companyId`**. Akcja wywołuje `createConsolidatedInvoice({ companyId, reservationIds, ... })`, która:
    - Pobiera firmę: `prisma.company.findUnique({ where: { id: companyId } })`.
    - Używa `company.nip`, `company.name`, `company.address`, itd. do pól faktury (`buyerNip`, `buyerName`, …).
  - Komentarz w kodzie: „companyId = dane nabywcy (firma z primaryReservation), nie filtr”.

- **createConsolidatedVatInvoice(data):** Przyjmuje `reservationIds`, `companyId`, `notes`, `amountGrossOverride`, `paymentMethod` — tylko przekazuje je do `createConsolidatedInvoiceFromReservationIds`. Również **nie** wyznacza kontrahenta z rezerwacji.

---

## 3. Model Prisma — Invoice (faktura zbiorcza)

Faktury zbiorcze to **Invoice** z `sourceType: "CONSOLIDATED"` (nie osobny model ConsolidatedInvoice).

**Pola związane z kontrahentem:**
- `companyId` (String?) — relacja do Company
- `company` — relacja Company?
- `buyerNip`, `buyerName`, `buyerAddress`, `buyerPostalCode`, `buyerCity` — snapshot danych nabywcy na fakturze

**Relacja do rezerwacji:** `invoiceReservations` (InvoiceReservation[]) — wiele pozycji po jednej per rezerwacja (snapshot: guestName, roomNumber, checkIn, checkOut, amountNet, amountVat, amountGross, description).

---

## 4. Model Reservation — pole firmy i ładowanie

- **Pola:** `companyId` (String?), `company` (Company?).
- **Tape Chart:** W `getTapeChartData` (app/actions/tape-chart.ts) rezerwacje są pobierane z `include: { company: { select: { id: true, name: true } }, ... }`. W `mapReservationToTapeChart` ustawiane są `companyId: r.companyId ?? undefined` i `companyName: r.company?.name ?? undefined`. **Relacja jest eager-loaded**; na froncie w Tape Chart mamy więc `companyId` i `companyName` na każdym elemencie `reservations` — **doładowywanie firmy nie jest potrzebne**.

---

## 5. Komponent z przyciskiem „Faktura zbiorcza” — dane w momencie kliknięcia

- **Tape Chart:** W momencie wyboru „Faktura zbiorcza” w menu mamy:
  - `selectedReservationIds` (Set<string>),
  - `reservations` (Reservation[]) — każdy z `companyId`, `companyName`,
  - `primaryReservationForInvoice` — pierwsza zaznaczona rezerwacja z firmą (useMemo z `reservations.find(...)` po `r.companyId`).
  - Zaznaczone rezerwacje w kolejności UI = kolejność w `reservations` przefiltrowana po `selectedReservationIds` (kolejność tablicy `reservations`).
- **Kontrahenci:** Przycisk „Wystaw fakturę zbiorczą” — kontekst jednej firmy (`selectedCompany`), lista rezerwacji bez pola company w zwracanym typie (rezerwacje i tak należą do tej firmy).

---

## Lista plików do modyfikacji (Faza 2)

| Plik | Zmiana |
|------|--------|
| **Nowy:** `lib/utils/consolidated-invoice-company.ts` (lub w `app/actions/companies.ts`) | Helper `resolveConsolidatedInvoiceCompany(reservations)` → `{ companyId, companyName, warning }` lub rzut błędu. |
| `components/tape-chart/index.tsx` | Przed `setConsolidatedInvoicePending`: wywołać helper na zaznaczonych rezerwacjach; przy braku firmy — blokada + komunikat; przy różnych firmach — modal z ostrzeżeniem i „Kontynuuj”/„Anuluj”; po potwierdzeniu ustawić primary = pierwsza z firmą (kolejność tablicy). |
| `components/tape-chart/reservation-bar-with-menu.tsx` | Opcjonalnie: `canConsolidatedInvoice` na podstawie „przynajmniej jedna rezerwacja ma firmę” (spójnie z helperem). |
| **Nowy lub w index.tsx:** Modal potwierdzenia przy różnych firmach | AlertDialog z tekstem ostrzeżenia i przyciskami „Kontynuuj” / „Anuluj”; blokuje wywołanie akcji do momentu „Kontynuuj”. |
| `components/tape-chart/unified-reservation-dialog.tsx` | Ewentualnie: inline komunikat gdy brak firmy (jeśli dialog może być otwarty bez primary) — lub zostawić blokadę tylko w Tape Chart przed otwarciem. |
| `app/kontrahenci/page.tsx` | Nie wymagane — kontekst jednej firmy; można opcjonalnie wywołać helper dla spójności (zawsze jedna firma, brak ostrzeżenia). |

Koniec Fazy 1.
