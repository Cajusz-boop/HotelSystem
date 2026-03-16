# Faza 3 — Self-check: Dobór kontrahenta FVZ

## Odpowiedzi na pytania

### 1. Czy helper `resolveConsolidatedInvoiceCompany` jest przetestowany dla wszystkich 4 przypadków?

**Nie.** Nie dodano testów jednostkowych. Brakuje:
- testu: żadna rezerwacja bez firmy → rzuca błąd z oczekiwanym komunikatem;
- testu: dokładnie jedna rezerwacja z firmą → zwraca tę firmę, `warning === null`;
- testu: wiele rezerwacji, ta sama firma (po `companyId`) → zwraca tę firmę, `warning === null`;
- testu: wiele rezerwacji, różne firmy → zwraca pierwszą z firmą (kolejność tablicy), `warning` niepusty.

Rekomendacja: dodać plik `__tests__/lib/utils/consolidated-invoice-company.test.ts` i pokryć te 4 przypadki.

---

### 2. Czy modal potwierdzenia przy różnych firmach blokuje faktyczne wywołanie akcji serwerowej do momentu kliknięcia „Kontynuuj"?

**Tak.** Wywołanie akcji serwerowej (`createConsolidatedInvoiceFromReservationIds` / `createConsolidatedVatInvoice`) następuje dopiero w **UnifiedReservationDialog**, gdy użytkownik wybierze „Faktura VAT” w dialogu „Wystawić dokument?”. Do tego momentu musi najpierw zamknąć modal („Kontynuuj” lub „Anuluj”). Po „Kontynuuj” ustawiane jest `consolidatedInvoicePending`, otwiera się dialog rezerwacji z zakładką dokumentów; dopiero tam użytkownik potwierdza wystawienie FVZ. Modal więc blokuje **otwarcie** dialogu z FVZ do momentu świadomego „Kontynuuj”.

---

### 3. Czy kwota FVZ zawsze zawiera WSZYSTKIE wybrane rezerwacje, również te bez firmy?

**Tak.** Do `setConsolidatedInvoicePending` i dalej do dialogu przekazywane jest `idsToInclude` = wszystkie zaznaczone ID rezerwacji **minus** te już powiązane z fakturą zbiorczą (`hasConsolidatedInvoice`). Nie ma filtrowania po `companyId`. Backend `createConsolidatedInvoice` przyjmuje `reservationIds` i sumuje kwoty dla **wszystkich** tych rezerwacji (komentarz w kodzie: „companyId = dane nabywcy, nie filtr”). Rezerwacje bez firmy są więc wliczane w kwotę FVZ.

---

### 4. Czy w przypadku „ta sama firma” sprawdzasz po ID firmy (nie po nazwie)?

**Tak.** W `resolveConsolidatedInvoiceCompany` używane jest `new Set(withCompany.map((r) => r.companyId))` i `companyIds.size === 1`. Porównanie jest po `companyId`. Nazwa firmy służy tylko do komunikatu i zwracanego `companyName`.

---

### 5. Co się dzieje, jeśli firma jest załadowana jako null na obiekcie rezerwacji, ale companyId jest ustawione (lazy load)?

W **Tape Chart** rezerwacje pochodzą z `getTapeChartData`, gdzie relacja `company` jest **eager-loaded** (`include: { company: { select: { id: true, name: true } } }`), a `mapReservationToTapeChart` ustawia `companyId` i `companyName`. Na froncie mamy więc oba pola; **doładowywanie firmy nie jest potrzebne** w tym przepływie.

Gdyby w innym kontekście przekazano rezerwacje z `companyId` ustawionym, ale bez `company` (np. inny endpoint bez include), helper i tak działa: wybór „pierwszej z firmą” jest po `companyId != null`. Zwracane `companyName` wtedy pochodzi z `first.companyName`; jeśli brak, w helperze jest fallback `"Firma"`. **Nie ma** wywołania API po firmę po `companyId` w helperze — więc przy samym `companyId` i bez `companyName` użytkownik zobaczy „Firma” w ostrzeżeniu, a backend i tak pobiera firmę po `companyId` przy tworzeniu FVZ. Jedyna luka: w modalu/UI nazwa pierwszej firmy może być wtedy mało czytelna.

---

## Honest gaps (luki)

| Luka | Opis |
|------|------|
| **Brak testów jednostkowych** | Helper nie jest pokryty testami; wszystkie 4 przypadki wymagają ręcznego sprawdzenia lub dopisania testów. |
| **Strona Kontrahenci** | Reguła doboru kontrahenta **nie** jest używana na `/kontrahenci` — tam kontekst to zawsze jedna firma, lista rezerwacji jest po `companyId`. Celowo bez zmian; gdyby w przyszłości pojawił się wybór rezerwacji spoza jednej firmy, należałoby tam też użyć `resolveConsolidatedInvoiceCompany`. |
| **E2E / ręczny test** | Nie zweryfikowano end-to-end: zaznaczenie 2 rezerwacji z różnymi firmami → „Faktura zbiorcza” → modal → „Kontynuuj” → dialog → wystawienie dokumentu i poprawność kwoty/NIP na fakturze. |
| **Skala pewności** | 4/5 — logika i przepływ są spójne z specyfikacją; brak testów i jednego pełnego przejścia E2E obniża pewność. |
