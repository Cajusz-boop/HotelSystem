# Specyfikacja rozszerzenia faktury zbiorczej

Dokument opisuje planowane funkcje do dodania do modułu faktury zbiorczej w systemie Hotel PMS.

---

## Stan obecny (bez zmian)

| Funkcja | Status |
|---------|--------|
| Tworzenie faktury zbiorczej z wybranych rezerwacji | ✅ Istnieje |
| Lista faktur (nr, okres, pozycje, kwota, termin, status) | ✅ Istnieje |
| Oznacz jako opłaconą | ✅ Istnieje |

### Reguła doboru kontrahenta (Tape Chart)

- **Implementacja:** `lib/utils/consolidated-invoice-company.ts` → `resolveConsolidatedInvoiceCompany(reservations)`.
- Brak firmy w żadnej rezerwacji → blokada + komunikat.
- Jedna lub więcej rezerwacji z tą samą firmą (po `companyId`) → dane tej firmy, kwota = suma wszystkich wybranych.
- Różne firmy → modal z ostrzeżeniem; po „Kontynuuj” używane są dane pierwszej rezerwacji z firmą (kolejność tablicy), kwota = suma wszystkich wybranych.

---

## 1. Podgląd i zarządzanie

### 1.1 Szczegóły faktury
- **Opis:** Kliknięcie w wiersz faktury lub przycisk „Szczegóły” otwiera widok ze wszystkimi pozycjami.
- **Zawartość:** Nr potwierdzenia rezerwacji, gość, pokój, daty, kwota brutto per pozycja, suma.
- **Forma:** Modal lub rozwijany panel pod wierszem; ewentualnie dedykowana strona `/kontrahenci/faktura-zbiorcza/[id]`.

### 1.2 Edytuj
- **Opis:** Możliwość zmiany pozycji, kwot, uwag – tylko gdy status ≠ PAID.
- **Zakres:** Dodanie/usunięcie pozycji (rezerwacji), ręczna korekta kwoty, uwagi.
- **Ograniczenie:** Blokada edycji po oznaczeniu jako opłacona.

### 1.3 Anuluj
- **Opis:** Anulowanie faktury zbiorczej (status CANCELLED).
- **Zachowanie:** Przycisk „Anuluj fakturę” + potwierdzenie; zwolnienie rezerwacji spod powiązania z tą fakturą (opcjonalnie).
- **Ograniczenie:** Brak anulowania dla faktur już opłaconych (lub wymaganie osobnej procedury storno).

---

## 2. Wydawanie dokumentów (analogicznie do rezerwacji)

### 2.1 Dialog „Wystawić dokument?” (identyczny jak na zdjęciu)

- **Tytuł:** „Wystawić dokument?”
- **Instrukcja:** „Wybierz jaki dokument wystawić:”

**Pola (1:1 jak przy rezerwacji):**
- **Kwota noclegu na paragonie/fakturze [PLN]** – pole numeryczne, domyślnie suma wszystkich pozycji; możliwość ręcznej korekty.
- **Aktualna suma noclegu: X PLN** – tekst pod polem, pokazuje aktualną sumę pozycji.
- **Podział na fakturę i paragon:**
  - Kwota na fakturę [PLN]
  - Kwota na paragon [PLN]
  - Kwota do zapłaty: X PLN (walidacja: suma faktury + paragon = kwota do zapłaty)
- **Uwagi na fakturze (opcjonalnie)** – textarea, placeholder: „Wpisz uwagi, które pojawią się na fakturze…”

**Przyciski:**
- **Faktura (X PLN) + Paragon (Y PLN) — Wystaw oba** – wyświetlany, gdy obie kwoty > 0 i suma = kwota do zapłaty.
- **Faktura VAT (PDF) — drukuj** – generuje PDF faktury zbiorczej VAT.
- **Paragon (kasa fiskalna POSNET)** – wydaje paragon na kasie fiskalnej.
- **Bez dokumentu** – zamyka dialog bez wystawiania dokumentu.

---

## 3. PDF i pobieranie

### 3.1 Pobierz PDF
- **Opis:** Link/przycisk „Pobierz PDF” przy każdej fakturze zbiorczej.
- **Działanie:** Generuje PDF faktury zbiorczej i pozwala pobrać lub otworzyć w nowej karcie.
- **Logika:** Wykorzystanie istniejącego API/akcji generującej PDF dla dokumentów (rozszerzenie o typ CONSOLIDATED_INVOICE, jeśli jeszcze brak).

---

## 4. Plan implementacji (kolejność)

| # | Funkcja | Zależności | Priorytet |
|---|---------|------------|-----------|
| 1 | Szczegóły faktury | getConsolidatedInvoiceById (już istnieje) | Wysoki |
| 2 | Pobierz PDF | Szczegóły / dane faktury, generator PDF | Wysoki |
| 3 | Anuluj | updateConsolidatedInvoiceStatus (status CANCELLED) | Wysoki |
| 4 | Dialog „Wystawić dokument?” | Akcje generowania PDF/paragonu dla faktury zbiorczej | Wysoki |
| 5 | Faktura VAT (PDF) | Endpoint/akcja generująca PDF FVZ | Wysoki |
| 6 | Paragon (kasa fiskalna) | Integracja z kasą dla kwoty zbiorczej | Średni |
| 7 | Edytuj | Logika dodawania/usuwania pozycji, walidacja | Średni |

---

## 5. Pliki do modyfikacji / utworzenia

- `app/kontrahenci/page.tsx` – UI szczegółów, przyciski (Szczegóły, Edytuj, Anuluj, Wystaw dokument, Pobierz PDF)
- `app/actions/companies.ts` – ewentualne nowe/rozszerzone akcje (anulowanie, generowanie PDF)
- `app/api/` – endpoint do generowania PDF faktury zbiorczej (analogicznie do zwykłej faktury)
- Komponent dialogu – reuse lub wariant `unified-reservation-dialog` dla faktury zbiorczej
- Schemat Prisma – sprawdzenie, czy ConsolidatedInvoice ma pole `notes` / `invoiceNotes`

---

## 6. Dokument końcowy (przed implementacją)

Ten plik służy jako specyfikacja. Po zatwierdzeniu można przystąpić do implementacji zgodnie z powyższym planem.
