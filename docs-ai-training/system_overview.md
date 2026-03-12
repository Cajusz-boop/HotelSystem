# Przegląd systemu hotelowego (PMS)

**Dokument:** system_overview.md  
**Przeznaczenie:** Materiał szkoleniowy AI — opis zachowania systemu, bez szczegółów implementacji.

---

## 1. Do czego służy system

System Zarządzania Hotelem (PMS — Property Management System) to kompleksowe narzędzie do prowadzenia operacji hotelowych. Obejmuje:

- **Rezerwacje** — tworzenie, modyfikacja, anulowanie, zmiana pokoju i dat
- **Front Office** — grafik pokojów (tape chart), meldowanie i wymeldowanie gości
- **Housekeeping** — statusy pokojów, sprzątanie, minibar, pralnia
- **Finanse** — faktury, proformy, paragony, rozliczenia, windykacja, audyt nocny
- **Usługi dodatkowe** — SPA, gastronomia, room service, transfery, atrakcje, wypożyczenia
- **MICE** — konferencje, wesela, eventy (imprezy okolicznościowe)
- **Raporty** — statystyki, raporty GUS, policyjne, finansowe, audyt działań
- **Integracje** — Channel Manager (Booking.com, Expedia), drukarka fiskalna, KSeF

System wspiera obiekty typu hotel, pensjonat, karczma z noclegami, a także multi-property (wiele obiektów w jednej instancji).

---

## 2. Role użytkowników

| Rola | Opis | Typowe zadania |
|------|------|----------------|
| **RECEPTION** | Recepcjonista | Rezerwacje, check-in/out, płatności, księga meldunkowa, tape chart |
| **MANAGER** | Kierownik | Pełny dostęp do modułów, raporty, finanse, audyt nocny, ustawienia |
| **HOUSEKEEPING** | Gospodarstwo pokojowe | Statusy pokojów, sprzątanie, minibar, pralnia, posiłki |
| **OWNER** | Właściciel | Panel właściciela, przegląd wyników, dostęp ograniczony do wybranych widoków |

Uprawnienia są konfigurowalne per rola — każda rola ma przyporządkowany zestaw uprawnień (np. `module.front_office`, `reservation.create`, `finance.post`). Menu w aplikacji jest filtrowane według uprawnień użytkownika.

**Autentykacja:** logowanie loginem i hasłem, opcjonalnie PIN (4–6 cyfr), opcjonalnie 2FA (TOTP).

---

## 3. Główne moduły

### 3.1 Recepcja (Front Office)
- **Tape Chart (grafik rezerwacji)** — wykres Gantta: wiersze = pokoje, kolumny = dni, paski = rezerwacje; drag & drop (przenoszenie rezerwacji, zmiana dat), tworzenie rezerwacji przez zaznaczenie obszaru
- **Check-in** — formularz meldunkowy (MRZ, Parse & Forget), meldowanie z rezerwacją lub bez (walk-in)
- **Zmiana zmiany** — podsumowanie zmiany kasowej, przekazanie informacji
- **Księga meldunkowa** — lista rezerwacji z filtrami, kolumny konfigurowalne, eksport CSV/Excel, druk

### 3.2 Sprzedaż i kontrahenci
- **Centrum sprzedaży** — sprzedaż noclegów, usług, imprez (MICE)
- **Kontrahenci** — baza gości i firm (CRM), karty gości, historia pobytów
- **Biura podróży** — baza agentów
- **Channel Manager** — integracja z kanałami dystrybucji (Booking.com itp.)

### 3.3 Pokoje i cennik
- **Pokoje** — lista pokoi, typy, statusy (CLEAN, DIRTY, OOO, MAINTENANCE), piętra
- **Cennik** — plany cenowe, stawki za typ pokoju i okres, sezony, reguły pochodne

### 3.4 Housekeeping
- **Statusy pokojów** — clean/dirty/OOO/inspection/maintenance
- **Minibar** — zużycie, rozliczenie
- **Pralnia** — zamówienia prania
- **Posiłki** — śledzenie posiłków gości

### 3.5 Finanse
- **Transakcje** — wpłaty, obciążenia, zwroty, unieważnienia
- **Dokumenty** — faktury, proformy, paragony, rachunki
- **Windykacja** — przypomnienia, windykacja
- **Integracje** — księgowość, KSeF, drukarka fiskalna

### 3.6 MICE (konferencje i eventy)
- **Imprezy** — wesela, komunie, urodziny, eventy firmowe
- **Kosztorysy** — GroupQuote
- **Zlecenia** — EventOrder
- **Grafik** — planowanie sal i imprez

### 3.7 Usługi dodatkowe
- **SPA** — rezerwacje zabiegów
- **Gastronomia** — restauracja
- **Room service** — usługa pokojowa
- **Transfery** — transport
- **Atrakcje** — wycieczki, wypożyczenia
- **Parking** — miejsca parkingowe
- **Camping** — miejsca campingowe

### 3.8 Raporty i audyt
- **Raporty** — statystyki, obłożenie, przychody
- **Audit trail** — historia zmian
- **Logi logowań** — kto i kiedy się logował
- **Logi działań** — szczegóły operacji użytkowników

### 3.9 Ustawienia
- Użytkownicy, uprawnienia, role
- Dane hotelu, piętra, numeracja dokumentów
- Kasa fiskalna, KSeF, szablony e-mail, SMS
- Channel Manager, sezony, słowniki
- Polityka anulacji, pola formularzy

---

## 4. Problemy, które system rozwiązuje

| Problem | Rozwiązanie w systemie |
|---------|------------------------|
| Chaos w rezerwacjach | Tape chart — wizualizacja zajętości, szybkie tworzenie i edycja rezerwacji |
| Brak widoczności obłożenia | Grafik pokojów, widoki dzienny/tygodniowy/miesięczny, plan pięter |
| Ręczne rozliczanie gości | Folio rezerwacji — obciążenia, wpłaty, rabaty, faktury, paragony |
| Utrata kontroli nad stanem pokoi | Housekeeping — statusy pokojów, harmonogram sprzątań |
| Rozproszone dane o gościach | Baza kontrahentów (goście, firmy) z historią pobytów |
| Brak integracji z kanałami | Channel Manager — synchronizacja z Booking.com, Expedia |
| Problemy z fakturowaniem | Integracja z KSeF, drukarka fiskalna, faktury zbiorcze |
| Brak audytu działań | Audit trail, logi logowań, śledzenie zmian |
| Utrudnione meldowanie | Formularz check-in z MRZ (dowód/paszport), web check-in |
| Brak narzędzi dla eventów | MICE — imprezy okolicznościowe, kosztorysy, grafik sal |

---

## 5. Ogólny flow pracy z gościem

### 5.1 Przed przyjazdem

1. **Rezerwacja** — gość rezerwuje przez:
   - **Booking engine** (publiczny `/booking`) — rezerwacja online
   - **Recepcję** — ręczne utworzenie w tape chart lub z kontrahenta
   - **Channel Manager** — rezerwacja z Booking.com, Expedia itp.

2. **Status rezerwacji** — np. PENDING (oczekująca), CONFIRMED (potwierdzona)

3. **Opcjonalnie:**
   - **Web check-in** — gość wypełnia dane przez link `/check-in/guest/[token]`
   - **Link do płatności** — gość płaci zaliczkę przez `/pay/[token]`

### 5.2 Przyjazd i meldunek

1. **Check-in** — recepcjonista melduje gościa:
   - Z rezerwacją — wyszukanie rezerwacji, uzupełnienie danych
   - Bez rezerwacji (walk-in) — nowa rezerwacja + meldunek
   - Opcjonalnie: skan MRZ (dowód, paszport) — automatyczne uzupełnienie danych

2. **Status → CHECKED_IN** — rezerwacja oznaczana jako zameldowana

3. **Przekazanie informacji** — klucz, pokój, godziny posiłków, zasady

### 5.3 Pobyt

1. **Obciążenia folio** — wpisywanie do rezerwacji:
   - Nocleg (z cennika)
   - Minibar, SPA, gastronomia, room service
   - Parking, transfery, atrakcje
   - Inne usługi

2. **Płatności na bieżąco** — wpłaty, zaliczki, preautoryzacja karty

3. **Aplikacja gościa** (`/guest-app/[token]`) — gość widzi rezerwacje, cyfrowy klucz, informacje o hotelu

### 5.4 Wyjazd i wymeldowanie

1. **Check-out** — recepcjonista wymeldowuje gościa:
   - Sprawdzenie folio (obciążenia vs wpłaty)
   - Opcjonalnie: dodatkowe wpłaty
   - Zwolnienie kaucji (jeśli była pobrana)

2. **Status → CHECKED_OUT**

3. **Dokumenty:**
   - Faktura (dla firm, na życzenie)
   - Proforma
   - Paragon / rachunek

4. **Zmiana statusu pokoju** — pokój → DIRTY (do sprzątania)

### 5.5 Po wyjeździe

1. **Housekeeping** — sprzątanie pokoju, status → CLEAN

2. **Windykacja** — jeśli gość ma zaległości, system generuje przypomnienia, prowadzi windykację

3. **Historia** — rezerwacja i gość pozostają w bazie (CRM, historia pobytów)

---

## 6. Strony publiczne (bez logowania)

- **Booking** — publiczny silnik rezerwacji online
- **Guest app** — aplikacja gościa (po tokenie): rezerwacje, cyfrowy klucz
- **Web check-in** — meldunek online (po tokenie)
- **Pay** — link do płatności (po tokenie)

---

## 7. Skróty i narzędzia

- **Ctrl+K** — paleta komend (szybkie wyszukiwanie funkcji, rezerwacji, gości)
- **Ctrl+Z / Ctrl+Y** — cofnij / ponów (w tape chart, do 5 kroków)
- **Multi-property** — przełącznik obiektu (gdy system obsługuje wiele hoteli)
- **Tryb ciemny/jasny** — przełącznik motywu w interfejsie
