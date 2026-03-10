# Audyt Centrum Sprzedaży — perspektywa sprzedawcy

**Data audytu:** 2026-03-09  
**Cel:** Ocena Centrum Sprzedaży z punktu widzenia codziennej pracy osoby sprzedającej imprezy (wesela, komunie, urodziny, bankiety).

---

## Streszczenie wykonawcze

Centrum Sprzedaży ma **solidne podstawy** (lista, kalendarze, szczegóły imprezy, zadatek, GCal), ale brakuje wielu **codziennych narzędzi sprzedawcy**: e-mail klienta, przypomnienia o zadatku, szybki SMS/WhatsApp, eksport do PDF, powiązanie kosztorys↔impreza w jednym miejscu, checklisty przed imprezą. Poniżej lista konkretnych braków i sugestie rozwiązań.

---

## 1. Co działa dobrze ✅

| Element | Opis | Użyteczność |
|---------|------|-------------|
| **Lista imprez** | Sortowanie po dacie/kliencie/typie, filtry statusu (Aktywne, Szkice, Zakończone, Anulowane), archiwum | ⭐⭐⭐ |
| **Widoki** | Lista, Kalendarz, Oś czasu, Sale×Dni, Tydzień, Gantt, Kosztorysy | ⭐⭐⭐ |
| **Szukanie** | Klient, telefon, data, sala, notatki | ⭐⭐⭐ |
| **Pasek "Ten tydzień"** | Szybki dostęp do najbliższych imprez | ⭐⭐⭐ |
| **Szczegóły imprezy** | Modal z danymi, statusem, zadatkiem, notatką, menu, GCal | ⭐⭐⭐ |
| **Zadatek** | Toggle opłacony/nieopłacony, dodanie kwoty z listy | ⭐⭐⭐ |
| **Zadzwoń** | Przycisk `tel:` z numerem | ⭐⭐⭐ |
| **Kopiuj numer** | Skrót do wklejenia w WhatsApp | ⭐⭐ |
| **Nowa impreza** | Modal z danymi, gośćmi, menu, szczegółami | ⭐⭐⭐ |
| **Edycja** | Pełna edycja imprezy z poziomu modala | ⭐⭐⭐ |
| **Google Calendar** | Sync, przycisk "Otwórz w GCal" | ⭐⭐⭐ |
| **Kolory** | Typ imprezy i sala – szybka orientacja | ⭐⭐⭐ |

---

## 2. Braki krytyczne (blokujące codzienną pracę)

### 2.1 Brak e-mailu klienta

**Problem:** EventOrder ma tylko `clientName` i `clientPhone`. Brak pola `clientEmail`.

**Skutki dla sprzedawcy:**
- Nie można wysłać kosztorysu mailem
- Nie można wysłać potwierdzenia rezerwacji
- Nie można wysłać przypomnienia o zadatku e-mailem
- Trzeba ręcznie szukać e-maila w notatkach albo poza systemem

**Sugestia:** Dodać pole `clientEmail` w schema.prisma, w formularzu i w widoku szczegółów. W szczegółach: przycisk "Wyślij e-mail" (`mailto:`) + "Skopiuj adres".

---

### 2.2 Brak szybkiej komunikacji z klientem

**Problem:** Jest tylko `tel:` – brak skrótów do WhatsApp / SMS.

**Skutki:**
- Sprzedawca musi ręcznie otwierać WhatsApp, wpisywać numer, wklejać wiadomość
- Brak gotowych szablonów (np. "Potwierdzenie rezerwacji", "Przypomnienie o zadatku")

**Sugestia:**
- Przycisk **WhatsApp** (`https://wa.me/48XXX?text=...`) – szablon z nazwą klienta i datą imprezy
- Opcjonalnie: **SMS** (`sms:48XXX?body=...`) – dla starych telefonów
- W przyszłości: szablony wiadomości (np. "Potwierdzenie rezerwacji wesela 15.06.2026, Sala Złota")

---

### 2.3 Brak przypomnień o zadatku

**Problem:** Stats pokazują "X nieopł. (Y zł)", ale nikt nie przypomina klientowi.

**Skutki:**
- Sprzedawca musi pamiętać, kto nie zapłacił
- Brak automatycznego maila/SMS w stylu: "Przypominamy o wpłacie zadatku 2000 zł do dnia X"

**Sugestia:**
- Lista "Do przypomnienia" – imprezy z `depositAmount > 0`, `depositPaid = 0`, `dateFrom` za np. 14–60 dni
- Przycisk "Wyślij przypomnienie" → szablon maila/SMS (po dodaniu `clientEmail`)
- Opcjonalnie: cron job (jak dla rezerwacji) – automatyczne przypomnienia X dni przed imprezą

---

### 2.4 Brak powiązania kosztorys → impreza (w jednym miejscu)

**Problem:** Kosztorysy są w `/mice/kosztorysy`, imprezy w Centrum Sprzedaży. Powiązanie przez `quoteId` istnieje, ale:
- Nie można utworzyć imprezy "z kosztorysu" jednym kliknięciem
- Nie można z imprezy utworzyć kosztorysu i od razu go powiązać
- Widok "Kosztorysy" w Centrum to lista kosztorysów – bez podpięcia do imprezy w flow

**Skutki:**
- Sprzedawca skacze między modułami
- Ryzyko duplikatów (kosztorys bez imprezy, impreza bez kosztorysu)

**Sugestia:**
- W modalu imprezy: przycisk "Utwórz kosztorys" → nowy kosztorys z nazwą klienta + data, auto `quoteId` po zapisie
- Przy "Nowa impreza": opcja "Z kosztorysu" – wybór kosztorysu z listy, podciągnięcie nazwy, kwoty (jeśli API to wspiera)

---

## 3. Braki ważne (utrudniające pracę)

### 3.1 Brak eksportu / druku

**Problem:** Nie ma eksportu listy imprez do CSV/Excel ani PDF (np. "Graficzek na miesiąc").

**Skutki:**
- Trzeba robić screenshoty lub ręcznie przepisywać do Excel
- Brak możliwości wydrukowania zestawienia na spotkanie / dla kierownika

**Sugestia:**
- "Eksport CSV" – lista filtrowanych imprez (data, klient, sala, typ, goście, zadatek)
- "Drukuj widok" – drukowalna wersja kalendarza miesiąca / listy

---

### 3.2 Brak widocznego terminu zadatku

**Problem:** Jest kwota i flaga opłacony/nieopłacony, ale nie ma "zadatek do zapłaty do dnia X".

**Skutki:**
- Nie wiadomo, czy np. 14 dni przed imprezą to już opóźnienie
- Brak jasnej informacji dla sprzedawcy: "zadatek przeterminowany"

**Sugestia:**
- Pole `depositDueDate` (opcjonalne) w EventOrder
- W widoku: etykieta "Zadatek do X" lub "Zadatek przeterminowany (od Y)"

---

### 3.3 Brak checklisty przed imprezą

**Problem:** Formularz ma dużo pól (godzina kościoła, tort, napoje, dekoracje), ale brak widoku "Co jeszcze trzeba zrobić przed imprezą X".

**Skutki:**
- Sprzedawca musi pamiętać, że trzeba dopisać menu, potwierdzić gości, zamówić tort itd.

**Sugestia:**
- Sekcja "Do zrobienia" w modalu imprezy: lista rzeczy (np. menu uzupełnione, zadatek opłacony, tort zamówiony) z checkboxami
- Można zacząć od kilku stałych pozycji + notatki

---

### 3.4 Dokumenty Google Docs – niejasny dostęp

**Problem:** Przycisk "Dokumenty" otwiera `menuDocId` lub `checklistDocId`. Jeśli brak – toast "Dokumenty Google Docs — w przygotowaniu".

**Skutki:**
- Nie wiadomo, czy dokument nie istnieje, czy jest błąd integracji
- Sprzedawca nie wie, czy checklista/menu w Google Docs jest aktualna

**Sugestia:**
- Pokazać jasno: "Checklista" / "Menu" – z linkiem albo "Brak dokumentu"
- Informacja "Utworzono przy zapisie imprezy" – żeby było wiadomo, skąd się wziął

---

### 3.5 Brak informacji "kto dodał / kto ostatnio edytował"

**Problem:** EventOrder nie ma pól `createdBy`, `updatedBy`, `assignedTo`.

**Skutki:**
- Przy kilku sprzedawcach nie wiadomo, kto prowadzi daną imprezę
- Brak rozliczalności

**Sugestia:** Dodać `assignedTo` (userId) i pokazywać "Opiekun: Jan Kowalski" w szczegółach imprezy.

---

## 4. Braki mniejsze (nice-to-have)

### 4.1 Kolory sal złożonych

- Sale typu "Sala Złota, Restauracja" mają fallback `#94a3b8`
- Można poprawić: gradient lub pierwsza sala z listy

### 4.2 Brak widoku "Wolne terminy"

- Sprzedawca na telefonie chce szybko powiedzieć: "Mamy wolne w sobotę 20.06 w Sali Złotej"
- Trzeba ręcznie przejrzeć kalendarz

**Sugestia:** Widok "Dostępność" – wybór sali + miesiąc, zaznaczone dni zajęte (bez szczegółów klienta, jeśli RODO).

### 4.3 Brak podsumowania miesięcznego (przychody / liczba imprez)

- Stats: "ten tyg.", "nieopł.", "szkice" – brak np. "Maj 2026: 12 imprez, 45 000 zł zadatków"

### 4.4 Nawigacja /centrum vs /centrum-sprzedazy

- Dwa URLe – można ujednolicić i przekierować `/centrum` → `/centrum-sprzedazy`

---

## 5. Priorytety wdrożeniowe (dla sprzedawcy)

| Priorytet | Element | Efort | Wpływ |
|-----------|---------|-------|-------|
| 1 | **clientEmail** + mailto | Niski | Wysoki |
| 2 | Przycisk WhatsApp (z numerem + szablon) | Niski | Wysoki |
| 3 | "Do przypomnienia" (lista nieopłaconych z datą) | Średni | Wysoki |
| 4 | Eksport CSV listy imprez | Niski | Średni |
| 5 | Flow "Kosztorys → impreza" / "Impreza → kosztorys" | Średni | Wysoki |
| 6 | depositDueDate + "Zadatek do X" | Niski | Średni |
| 7 | assignedTo (opiekun imprezy) | Średni | Średni |
| 8 | Checklista przed imprezą | Średni | Średni |
| 9 | Widok "Wolne terminy" | Średni | Średni |
| 10 | Automatyczne przypomnienia (cron) | Wysoki | Wysoki |

---

## 6. Dzienny flow sprzedawcy – co jest, czego brakuje

| Etap | Co sprzedawca robi | Dostępne | Brakuje |
|------|--------------------|----------|---------|
| Rano – co dzisiaj | Zerknąć na "Ten tydzień", przygotować się | ✅ Pasek "Ten tydzień" | Lista "do zrobienia dziś" (zadatek, menu, potwierdzenie) |
| Telefon od klienta | Sprawdzić dostępność, dane, zadatek | ✅ Szukanie, lista, szczegóły | Wolne terminy (szybki widok), clientEmail |
| Po rozmowie | Zapisać notatkę, zmienić status | ✅ Notatka, status | Przypomnienie "oddzwoń za X dni" |
| Wysyłka kosztorysu | Wysłać kosztorys mailem | ❌ | clientEmail, mailto, PDF kosztorysu |
| Przypomnienie o zadatku | Sprawdzić kto nie zapłacił, zadzwonić/napisać | ✅ Stats "X nieopł." | Lista "do przypomnienia", WhatsApp, szablon SMS |
| Przed imprezą | Upewnić się: menu, tort, goście | ✅ Szczegóły, menu | Checklista "do zrobienia", depositDueDate |
| Po imprezie | Oznaczyć DONE, notatka | ✅ Status DONE | — |
| Raport dla szefa | "Ile imprez w maju, ile zadatków" | ❌ | Eksport CSV, podsumowanie miesięczne |

---

## 7. Rekomendacje natychmiastowe

1. **Dodaj clientEmail** – pole w schema, formularzu, API i widoku. To otwiera drogę do maili, przypomnień i lepszej komunikacji.
2. **Dodaj przycisk WhatsApp** – obok "Zadzwoń", z szablonem typu: "Dzień dobry, [clientName]. W sprawie rezerwacji na [date]..."
3. **Wykorzystaj stats "nieopł."** – zrób z tego klikalną listę filtrów: "Pokaż tylko nieopłacone zadatki" (już częściowo jest przez filtry – można dodać szybki przycisk).
4. **Eksport CSV** – prosta funkcja: bieżąca lista (po filtrach) → CSV do pobrania.

---

*Audyt przygotowany na podstawie analizy `components/centrum-sprzedazy.tsx`, `app/api/event-orders/`, `prisma/schema.prisma` oraz dokumentacji CENTRUM-SPRZEDAZY-AUDYT-FULL.md.*
