# Spec: Numer paragonu w HotelSystem

**Wersja:** 1.0  
**Data:** 2025-03-15  
**Status:** Faza 1 — rekonesans zakończony

---

## 1. Model danych

### 1.1 Obecny stan

- **Reservation** (prisma/schema.prisma): ma relacje `invoices`, `receipts`; brak pól na numer paragonu fiskalnego (gdy gość nie chce faktury, tylko paragon z kasy).
- **EventOrder**: brak relacji do Invoice w schemacie; faktury dla wydarzeń są w **Invoice** przez `sourceType: "EVENT"`, `sourceId: eventOrder.id`. Brak pól na paragon.
- **Receipt** (model Prisma): to rachunek nie-VAT (zwolnienie z VAT), ma `number` (R/YYYY/SEQ) — inna encja niż „paragon fiskalny z kasy”.
- **FiscalJob** (kolejka druku): ma `receiptNumber` — numer z drukarki fiskalnej, nie powiązany z rezerwacją/wydarzeniem w UI.

### 1.2 Propozycja zmian w Prisma

**Reservation** — dodać na końcu przed `@@index`:

```prisma
  /** Numer paragonu fiskalnego (gdy gość nie chce faktury) */
  receiptNumber  String?   @db.VarChar(64)
  /** Data wystawienia paragonu */
  receiptDate    DateTime? @db.Date
```

**EventOrder** — dodać przed `@@index` (np. po `notes`):

```prisma
  /** Numer paragonu fiskalnego (gdy nie wystawiano faktury) */
  receiptNumber  String?   @db.VarChar(64)
  /** Data wystawienia paragonu */
  receiptDate    DateTime? @db.Date
```

**Migracja:**

- Nazwa: `add_receipt_fields`
- Polecenie: `npx prisma migrate dev --name add_receipt_fields`
- Lokalnie: `npx prisma db push` też dopuszczalne (zgodnie z ARCHITECTURE.md w CI/CD używane jest push).

**Indeksy:** opcjonalnie `@@index([receiptNumber])` na Reservation jeśli planowane wyszukiwanie po numerze paragonu; na start można pominąć.

---

## 2. API / backend

### 2.1 Endpointy / akcje do zmiany

| Miejsce | Funkcja / ścieżka | Zmiana |
|--------|--------------------|--------|
| `app/actions/reservations.ts` | `updateReservation` | Przyjmować `receiptNumber`, `receiptDate`. Przed zapisem: **walidacja** — jeśli `receiptNumber` lub `receiptDate` ustawione, sprawdzić że rezerwacja **nie ma** żadnej faktury (`invoices.length === 0`). W przeciwnym razie błąd: *"Nie można ustawić paragonu — rezerwacja ma już wystawioną fakturę. Wybierz: faktura lub paragon."* |
| `app/actions/reservations.ts` | `getReservationEditData` | Zwracać `receiptNumber`, `receiptDate` (z Reservation) — żeby zakładka Dokumenty mogła je wyświetlić i edytować. |
| `app/actions/reservations.ts` | `toUiReservation` + select w zapytaniach | Dodać `receiptNumber`, `receiptDate` do zwracanego obiektu rezerwacji (tape chart, formularz). |
| `app/actions/mice.ts` | `updateEventOrder` | Przyjmować `receiptNumber`, `receiptDate`. Walidacja: jeśli ustawione — sprawdzić że nie ma faktury dla tego EventOrder (`Invoice` z `sourceType: "EVENT"`, `sourceId: eventOrder.id`). Komunikat: *"Nie można ustawić paragonu — do imprezy jest już wystawiona faktura."* |
| `app/actions/finance.ts` | `createVatInvoice` (rezerwacja) | Na początku (po pobraniu rezerwacji): jeśli `reservation.receiptNumber != null` → zwrócić błąd: *"Do tej rezerwacji jest już przypisany paragon (nr …). Nie można wystawić faktury — wybierz: faktura lub paragon."* |
| `app/actions/finance.ts` | Tworzenie faktury dla EVENT (np. createSalesInvoice / faktura na produkty ze sourceType EVENT) | Przed utworzeniem faktury z `sourceType: "EVENT"` sprawdzić EventOrder po `sourceId`; jeśli `eventOrder.receiptNumber != null` → błąd analogiczny. |
| `app/actions/tape-chart.ts` | `fetchTapeChartDataUncached` / `mapReservationToTapeChart` | Pobierać z Reservation `receiptNumber`; mieć informację czy są faktury (już jest `invoiceReservations` / faktury po reservationId). Dodać do `TapeChartReservation` pole np. `documentStatus: "invoice" | "receipt" | "none"` oraz opcjonalnie `receiptNumber?: string | null` (do tooltipu). |

### 2.2 Reguła biznesowa (walidacja)

- Dla **jednej rezerwacji** / **jednego wydarzenia**: **albo** faktura (dowolna z `Invoice` powiązana z tą rezerwacją/wydarzeniem), **albo** paragon (`receiptNumber` ustawiony). Nie oba jednocześnie.
- Komunikaty po polsku, czytelne dla użytkownika.
- Przy zapisie rezerwacji/wydarzenia: jeśli użytkownik czyści paragon (ustawia `receiptNumber` na null), nie blokować — wtedy można potem wystawić fakturę.

---

## 3. UI — formularz tworzenia/edycji dokumentu

### 3.1 Miejsce

- **Zakładka „Dokumenty”** w `components/tape-chart/tabs/documents-tab.tsx` (rezerwacja) oraz ewentualnie w widoku szczegółów EventOrder (patrz p. 4).

### 3.2 Zachowanie

- Sekcja **„Dokument kasowy”** (zawsze widoczna):
  - **Przełącznik (radio):** „Faktura” | „Paragon”.
  - Stan przełącznika:
    - **Faktura** — gdy rezerwacja ma jakąkolwiek fakturę (`invoices.length > 0`) → pokazać dotychczasową listę faktur (obecna sekcja „Faktury VAT”).
    - **Paragon** — gdy `receiptNumber` jest ustawiony lub użytkownik wybrał „Paragon” → pokazać pola:
      - **Numer paragonu** (input tekst, wymagany przy wyborze Paragon),
      - **Data paragonu** (input date, opcjonalna).
  - Gdy rezerwacja ma i faktury, i `receiptNumber` (stan niespójny — nie powinien występować po wdrożeniu walidacji): traktować jak „Faktura” i wyświetlić listę faktur; ewentualnie komunikat „Skoryguj: wybierz fakturę lub paragon”.
- Zapis:
  - Przy wyborze „Paragon” i wypełnionym numerze: wywołać `updateReservation(reservationId, { receiptNumber, receiptDate })`. Po stronie serwera walidacja (brak faktur).
  - Przy przełączeniu na „Faktura” i chęci „skasowania” paragonu: wywołać `updateReservation(reservationId, { receiptNumber: null, receiptDate: null })`.
- Styl: biały, czysty, spójny z Tape Chart / formularzem wydarzeń (shadcn/ui, Tailwind).

### 3.3 Dane wejściowe dla DocumentsTab

- DocumentsTab musi dostawać `receiptNumber`, `receiptDate` oraz mieć callback do zapisu (np. `onReceiptSave`) lub wywoływać `updateReservation` z rodzica. Możliwe opcje:
  - **A)** Parent (UnifiedReservationDialog) przekazuje `receiptNumber`, `receiptDate` z obiektu `reservation` oraz `onReceiptSave(reservationId, { receiptNumber, receiptDate })` — wtedy DocumentsTab nie ładuje osobno getReservationEditData.
  - **B)** DocumentsTab przy mount dla `reservationId` wywołuje rozszerzone `getReservationEditData` (z receiptNumber, receiptDate) i sam wywołuje `updateReservation`.

Rekomendacja: **A** — reservation w edit mode i tak ma te pola po rozszerzeniu `toUiReservation` i selectu w getReservationEditData; parent przekazuje je do DocumentsTab.

---

## 4. UI — widok podglądu rezerwacji / wydarzenia

### 4.1 Rezerwacja

- W **DocumentsTab** (używanym w UnifiedReservationDialog):
  - Sekcja **„Dokument kasowy”** widoczna **zawsze** (nawet gdy pusty).
  - Gdy **brak faktur i brak receiptNumber**: tekst szary „Brak dokumentu finansowego”.
  - Gdy **receiptNumber** jest ustawiony: badge/chip z numerem paragonu i ewentualnie datą (np. „Paragon nr 123/2025 z dnia 14.03.2025”).
  - Gdy są **faktury** (i brak paragonu): wyświetlać jak dotąd listę faktur.
- Kolejność bloków w DocumentsTab: np. Druki → Transakcje KP/KW → Proformy → **Dokument kasowy** (nowa) → Faktury VAT.

### 4.2 Wydarzenie (EventOrder)

- **app/events/[id]/page.tsx** (lub odpowiedni widok MICE dla jednego zlecenia): dodać sekcję **„Dokument kasowy”**:
  - Zawsze widoczna.
  - Gdy brak faktury (Invoice z sourceType=EVENT, sourceId=id) i brak `eventOrder.receiptNumber`: „Brak dokumentu finansowego”.
  - Gdy `receiptNumber`: badge z numerem i datą paragonu.
  - Gdy jest faktura: np. link do faktury lub numer faktury.
- Jeśli w MICE jest osobny widok „szczegóły zlecenia” z zakładkami — tam dodać zakładkę lub blok „Dokumenty” z tą samą logiką.

---

## 5. UI — lista rezerwacji / lista wydarzeń (Centrum Sprzedaży)

### 5.1 Tape Chart (lista rezerwacji na grafiku)

- **TapeChartReservation** (app/actions/tape-chart.ts): dodać pola:
  - `documentStatus?: "invoice" | "receipt" | "none"`
  - `receiptNumber?: string | null` (do tooltipu).
- W **mapReservationToTapeChart**:  
  - jeśli rezerwacja ma jakąkolwiek fakturę (np. przez `invoices` — trzeba dołączyć `invoices: { take: 1, select: { id: true, number: true } }` w include, albo użyć istniejącego `invoiceReservations` tylko dla faktury zbiorczej; dla zwykłej faktury rezerwacja ma `invoices` bezpośrednio) → `documentStatus: "invoice"`.  
  - jeśli `receiptNumber` → `documentStatus: "receipt"`.  
  - w przeciwnym razie → `documentStatus: "none"`.
- W zapytaniu `prisma.reservation.findMany` w tape-chart: dołączyć `invoices: { take: 1, select: { id: true } }` (wystarczy czy są) oraz `receiptNumber`, `receiptDate` (już na Reservation).
- **ReservationBar** lub **ReservationBarWithMenu** (components/tape-chart): na pasku rezerwacji (np. w rogu) ikona:
  - paragon: ikona (np. Receipt) + tooltip „Paragon nr &lt;numer&gt;”,
  - faktura: ikona (np. FileText) + tooltip „Faktura”,
  - brak: ikona (np. kółko) lub brak ikony + tooltip „Brak dokumentu”.
- Kolumna w „liście” rezerwacji: Tape Chart to siatka pokój×czas; ewentualna tabela rezerwacji (jeśli jest) — dodać kolumnę „Dokument” z ikoną i tooltipem. Sortowanie/filtrowanie po statusie dokumentu — jeśli w UI jest filtrowanie rezerwacji, dodać filtr „Dokument: Faktura / Paragon / Brak”.

### 5.2 Lista wydarzeń (MICE)

- **mice/zlecenia** (ZlecenieForm) / **mice/eventy** (EventyClient): lista EventOrder.
- W zapytaniu ładowania listy: pobrać dla każdego EventOrder `receiptNumber`, `receiptDate` oraz czy istnieje faktura (np. `Invoice.count` gdzie sourceType=EVENT i sourceId=eventOrder.id, albo include z Prisma).
- Dodać kolumnę **„Dokument”** (lub ikonę w wierszu):
  - paragon + tooltip z numerem,
  - faktura + tooltip,
  - brak dokumentu.
- Kolumna sortowalna/filtrowalna jeśli komponent tabeli to umożliwia.

---

## 6. Pliki do zmiany (podsumowanie)

| # | Plik | Zmiana |
|---|------|--------|
| 1 | prisma/schema.prisma | Pola receiptNumber, receiptDate na Reservation i EventOrder |
| 2 | app/actions/reservations.ts | updateReservation: przyjmować i walidować receiptNumber/receiptDate; getReservationEditData + toUiReservation + selecty: receiptNumber, receiptDate |
| 3 | app/actions/mice.ts | updateEventOrder: przyjmować receiptNumber, receiptDate; walidacja vs Invoice EVENT |
| 4 | app/actions/finance.ts | createVatInvoice (i ewent. inne tworzenie faktury): sprawdzenie reservation.receiptNumber / event.receiptNumber, czytelny błąd |
| 5 | app/actions/tape-chart.ts | TapeChartReservation + mapReservationToTapeChart + include invoices (take 1), receiptNumber, receiptDate → documentStatus, receiptNumber |
| 6 | lib/tape-chart-types.ts | Reservation: receiptNumber?, receiptDate?, documentStatus? |
| 7 | components/tape-chart/tabs/documents-tab.tsx | Sekcja „Dokument kasowy”, przełącznik Faktura/Paragon, pola numer + data, zapis przez updateReservation |
| 8 | components/tape-chart/unified-reservation-dialog.tsx | Przekazać do DocumentsTab receiptNumber, receiptDate z reservation, callback onReceiptSave (lub DocumentsTab wywołuje updateReservation) |
| 9 | components/tape-chart/reservation-bar-with-menu.tsx lub reservation-bar.tsx | Ikona dokumentu (paragon/faktura/brak) + tooltip |
| 10 | app/events/[id]/page.tsx | Sekcja „Dokument kasowy” (pobranie EventOrder z receiptNumber, receiptDate; sprawdzenie Invoice EVENT) |
| 11 | app/mice/zlecenia/page.tsx lub ZlecenieForm / eventy-client | Kolumna/ikonka statusu dokumentu na liście EventOrder (ładowanie receiptNumber + czy jest faktura) |

---

## 7. Pliki do reużycia

- `updateReservation`, `getReservationEditData` (reservations.ts)
- `getInvoicesForReservation`, `getInvoicesForReservations` (finance.ts)
- `DocumentsTab`, `UnifiedReservationDialog` (istniejące)
- Komponenty UI: Button, Input, Label, RadioGroup (shadcn), Badge
- Typy: Reservation (tape-chart-types), ActionResult

---

## 8. Zależności

- Prisma Client po migracji (prisma generate).
- Brak nowych pakietów npm.
- Typy TypeScript: rozszerzenie Reservation (tape-chart-types), TapeChartReservation (tape-chart.ts), getReservationEditData return type, updateReservation input type (Partial<ReservationInput> + receiptNumber, receiptDate).

---

## 9. Kolejność zadań (plan implementacji)

1. **Migracja Prisma**: dodać pola do schema, uruchomić `npx prisma migrate dev --name add_receipt_fields` (lub db push).
2. **Backend – rezerwacje**: updateReservation (receiptNumber, receiptDate + walidacja), getReservationEditData, toUiReservation + wszystkie miejsca zwracające rezerwację (select/include).
3. **Backend – wydarzenia**: updateEventOrder (receiptNumber, receiptDate + walidacja); w finance createVatInvoice (i ewent. createSalesInvoice dla EVENT) — sprawdzenie receiptNumber.
4. **Backend – tape chart**: include invoices (take 1), receiptNumber/receiptDate; mapReservationToTapeChart → documentStatus, receiptNumber.
5. **Typy**: tape-chart-types Reservation (receiptNumber, receiptDate, documentStatus).
6. **UI – DocumentsTab**: sekcja Dokument kasowy, radio Faktura/Paragon, pola, zapis.
7. **UI – UnifiedReservationDialog**: przekazanie receiptNumber, receiptDate, callback do DocumentsTab.
8. **UI – pasek rezerwacji**: ikona + tooltip dokumentu.
9. **UI – szczegóły wydarzenia**: sekcja Dokument kasowy na stronie events/[id] (i ewent. MICE).
10. **UI – lista wydarzeń**: kolumna/ikonka dokumentu (mice/zlecenia, eventy).

---

## 10. Edge case’y i obsługa

| # | Scenariusz | Co się stanie | Obsługa |
|---|------------|----------------|---------|
| 1 | Użytkownik ustawia paragon, a rezerwacja ma już fakturę | Zapis odrzucony | Walidacja w updateReservation: jeśli invoices.length > 0 → błąd z komunikatem. |
| 2 | Użytkownik wystawia fakturę, a na rezerwacji jest receiptNumber | Tworzenie faktury odrzucone | W createVatInvoice na początku: if (reservation.receiptNumber) return error. |
| 3 | Istniejące rezerwacje z fakturami — dodanie pól nullable | Brak wpływu | receiptNumber/receiptDate null; documentStatus = "invoice". |
| 4 | Użytkownik kasuje paragon (ustawia null) — potem wystawia fakturę | Dozwolone | Walidacja tylko w drugą stronę (paragon gdy jest faktura) i przy tworzeniu faktury (gdy jest paragon). |
| 5 | Faktura zbiorcza (InvoiceReservation) | Rezerwacja ma invoiceReservations | Dla documentStatus: „faktura” jeśli invoices.length > 0 LUB invoiceReservations.length > 0 (obecnie tape-chart bierze hasConsolidatedInvoice z invoiceReservations). Spójność: zwykła faktura = reservation.invoices, zbiorcza = invoiceReservations. |

---

## 11. Pytania / ustalenia

- **Receipt vs paragon:** W systemie „paragon” = dokument kasowy (fiskalny) bez rejestracji numeru; „Receipt” (model) = rachunek nie-VAT. Numer paragonu fiskalnego trafia do nowych pól Reservation/EventOrder — bez zmiany modelu Receipt.
- **Faktura na wydarzenie:** Faktury dla EventOrder są w Invoice (sourceType=EVENT, sourceId=eventOrderId). Wszystkie miejsca tworzące taką fakturę muszą sprawdzać eventOrder.receiptNumber przed utworzeniem.
- **Definicja ukończenia** (z zadania): migracja, formularz (Faktura/Paragon + zapis), widok szczegółów (Dokument kasowy), lista (status dokumentu), walidacja wzajemnego wykluczania, brak regresji — spec powyżej to pokrywa.

---

**Koniec Fazy 1.** Czekam na potwierdzenie planu przed przejściem do Fazy 2 (implementacja).
