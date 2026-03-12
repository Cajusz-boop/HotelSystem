# Flow rezerwacji — krok po kroku

**Dokument:** reservation_flow.md  
**Przeznaczenie:** Materiał szkoleniowy AI — opis zachowania systemu przy obsłudze rezerwacji.

---

## 1. Rezerwacja telefoniczna

### Przebieg krok po kroku

1. **Odbieranie telefonu** — recepcjonista rozmawia z gościem, ustala:
   - termin przyjazdu i wyjazdu,
   - typ pokoju (Standard, Deluxe, Suite itd.),
   - liczbę osób (dorośli, dzieci),
   - dane gościa: imię i nazwisko, telefon, email.

2. **Sprawdzenie dostępności** — recepcjonista otwiera Front Office (Tape Chart) lub formularz nowej rezerwacji:
   - wybiera daty,
   - sprawdza wolne pokoje w wybranym typie,
   - jeśli brak pokoju — informuje gościa o alternatywach lub innych terminach.

3. **Utworzenie rezerwacji** — recepcjonista tworzy rezerwację:
   - **Źródło:** PHONE,
   - **Kanał:** DIRECT (lub inny zgodny z polityką hotelu),
   - wyszukuje gościa w bazie lub dodaje nowego,
   - wybiera pokój (ręcznie lub auto-przypisanie),
   - ustawia plan cenowy, opcjonalnie uwagi i życzenia.

4. **Potwierdzenie** — status rezerwacji: **CONFIRMED** (potwierdzona).

5. **Wysłanie potwierdzenia** — recepcjonista generuje potwierdzenie (PDF) i wysyła gościowi emailem (jeśli system to wspiera).

6. **Zadatek / gwarancja** — w zależności od polityki hotelu:
   - pobranie zaliczki przez link do płatności,
   - gwarancja kartą kredytową,
   - zapisanie informacji o planowanej płatności.

### Typowe problemy

- Gość nie podaje emaila → zapisać telefon, potwierdzić SMS-em lub pocztą.
- Brak wolnego pokoju → zaproponować inny typ, daty lub wpisać gościa na waitlist.
- Niepewna data → rezerwacja PENDING z prośbą o potwierdzenie.

---

## 2. Rezerwacja na miejscu (walk-in)

### Przebieg krok po kroku

1. **Przyjazd gościa bez rezerwacji** — gość wchodzi do recepcji i prosi o pokój.

2. **Sprawdzenie dostępności** — recepcjonista:
   - sprawdza listę dostępnych pokoi na dziś (np. widok „Dziś” w Tape Chart),
   - uwzględnia statusy: CLEAN (gotowy) vs DIRTY/OOO (niedostępny).

3. **Wywołanie flow Walk-in** — recepcjonista używa funkcji **Walk-in**:
   - wybiera numer pokoju,
   - podaje liczbę nocy (lub datę wyjazdu),
   - wpisuje imię i nazwisko gościa,
   - opcjonalnie: email, telefon, liczbę osób.

4. **Automatyczne meldowanie** — system:
   - tworzy rezerwację,
   - od razu ustawia status **CHECKED_IN**,
   - opcjonalnie zapisuje godzinę check-inu,
   - **Źródło:** WALK_IN, **Kanał:** DIRECT.

5. **Płatność** — recepcjonista przyjmuje płatność (gotówka, karta) i rejestruje ją w folio rezerwacji.

6. **Wydanie klucza** — recepcjonista przekazuje klucz i informacje o pokoju.

### Różnice względem rezerwacji z wyprzedzeniem

- Brak etapu „oczekiwanie na potwierdzenie” — od razu meldunek.
- Rezerwacja tworzona na bieżąco, bez wcześniejszego planowania.
- Pokój musi być dostępny w dniu przyjazdu (status CLEAN).

---

## 3. Edycja rezerwacji

### Co można edytować

- Daty przyjazdu i wyjazdu (przedłużenie/skrócenie pobytu),
- Pokój (przeniesienie),
- Gość (zmiana osoby, dodanie gości do pokoju),
- Liczba osób (dorośli, dzieci),
- Plan cenowy / cena za dobę,
- Źródło, kanał, segment,
- Uwagi, życzenia, notatki wewnętrzne,
- Dane do faktury (firma, NIP).

### Przebieg krok po kroku

1. **Otwarcie rezerwacji** — kliknięcie w pasek rezerwacji na Tape Chart albo wyszukanie w księdze meldunkowej.

2. **Modyfikacja pól** — recepcjonista zmienia wybrane pola w formularzu.

3. **Walidacja** — system sprawdza:
   - dostępność pokoju w nowym terminie (gdy zmiana dat lub pokoju),
   - brak konfliktu z innymi rezerwacjami,
   - limit overbookingu (jeśli ustawiony).

4. **Zapis** — recepcjonista klika **Zapisz**; system aktualizuje rezerwację i loguje zmianę w audit trail.

5. **Skutki zmian**:
   - **Zmiana dat** — może wymagać przeliczenia ceny (np. inna stawka za nowe daty),
   - **Zmiana pokoju** — patrz sekcja „Zmiana pokoju”,
   - **Zmiana gościa** — aktualizacja profilu gościa w rezerwacji.

### Edycja przez Tape Chart (drag & drop)

- **Przenoszenie paska** — przeciągnięcie paska na inny pokój lub datę → automatyczna zmiana pokoju/dat.
- **Zmiana długości pobytu** — przeciągnięcie lewej lub prawej krawędzi paska → zmiana daty przyjazdu lub wyjazdu.
- **Undo (Ctrl+Z)** — cofnięcie ostatniej operacji (do 5 kroków wstecz).

---

## 4. Anulowanie rezerwacji

### Przebieg krok po kroku

1. **Otwarcie rezerwacji** — wybór rezerwacji do anulowania (Tape Chart lub księga meldunkowa).

2. **Wybór opcji Anuluj** — np. z menu kontekstowego (prawy przycisk) lub przycisku w oknie rezerwacji.

3. **Podanie powodu** — system może wymagać:
   - powód anulowania (np. „Gość zrezygnował”, „Błąd recepcji”),
   - kod anulowania (jeśli skonfigurowany).

4. **Potwierdzenie** — recepcjonista potwierdza anulowanie.

5. **Zmiana statusu** — rezerwacja otrzymuje status **CANCELLED**, zapisywana jest data i powód anulowania.

6. **Zwrot środków** — jeśli była wpłata:
   - sprawdzenie polityki anulowania,
   - zwrot przez system (refund) lub ręczne rozliczenie,
   - odnotowanie w folio.

7. **Audit** — zmiana jest zapisywana w audit trail.

### Kiedy anulować

- Gość rezygnuje z pobytu,
- Błąd przy tworzeniu (np. zła data),
- No-show po ustalonym czasie (często osobna ścieżka → status NO_SHOW),
- Niestawienie się na rezerwację PENDING bez potwierdzenia.

### Polityka anulowania

Hotel może mieć ustawione opłaty za anulowanie w zależności od terminu (np. darmowe do 24 h przed przyjazdem). Informacja ta jest wykorzystywana przy windykacji i rozliczeniach.

---

## 5. Zmiana pokoju

### Przebieg krok po kroku

1. **Otwarcie rezerwacji** — wybór rezerwacji do przeniesienia.

2. **Sposób zmiany:**
   - **A) Przeciągnięcie na Tape Chart** — chwycenie paska i przeciągnięcie na inny pokój (ten sam lub inny termin),
   - **B) Edycja w formularzu** — zmiana pola „Pokój” i zapis,
   - **C) Auto-przypisanie** — system sam dobiera dostępny pokój tego samego typu.

3. **Walidacja** — system sprawdza:
   - czy docelowy pokój istnieje,
   - czy nie jest OOO (Out of Order),
   - czy w nowym terminie nie ma konfliktu z inną rezerwacją,
   - limit overbookingu (jeśli włączony).

4. **Potwierdzenie** — po poprawnej walidacji rezerwacja jest przenoszona.

5. **Komunikat dla gościa** — recepcjonista informuje gościa o nowym numerze pokoju i ewentualnie o przyczynie (np. usterka, upgrade).

### Ograniczenia

- Pokój **OOO** nie może przyjąć rezerwacji (pełna blokada).
- Pokój **DIRTY** może przyjąć rezerwację, ale system może ostrzegać (zależnie od konfiguracji).
- Nakładanie się rezerwacji w tym samym pokoju jest blokowane, chyba że dozwolony jest overbooking.

---

## 6. Overbooking

### Co to jest overbooking

Nadrezerwacja — świadome przyjęcie większej liczby rezerwacji niż wynika z dostępności pokojów/łóżek, w oparciu o historyczne no-show i anulowania.

### Konfiguracja w systemie

- **Limit overbookingu** — procent nad dostępnością (np. 10% = można zarezerwować 10% więcej łóżek niż fizycznie dostępnych).
- Ustawiany per obiekt (Property) w ustawieniach.
- Domyślnie **0%** — overbooking wyłączony.

### Przebieg przy włączonym overbookingu

1. **Próba rezerwacji** — recepcjonista tworzy rezerwację lub przenosi istniejącą na zajęty pokój/termin.

2. **Wykrycie przekroczenia** — system liczy:
   - liczbę łóżek zajętych w okresie,
   - liczbę łóżek w pokoju,
   - czy suma przekracza limit (np. 100% + 10%).

3. **Decyzja:**
   - **Limit nieprzekroczony** — system tworzy rezerwację i wyświetla **ostrzeżenie** „Rezerwacja utworzona w trybie overbooking”.
   - **Limit przekroczony** — system **blokuje** operację i informuje, ile łóżek jest dostępnych.

4. **Obsługa nadrezerwacji** — przed przyjazdem hotel:
   - monitoruje listy przyjazdów,
   - w razie pełnego obłożenia szuka alternatyw (np. przeniesienie do innego obiektu, ugoda z gościem),
   - w skrajnych przypadkach stosuje procedury relokacji.

### Zalecenia

- Overbooking zwykle wymaga decyzji kierownika.
- Powinien być używany świadomie, z uwzględnieniem ryzyka no-show.
- Raporty anulowań i no-show pomagają w szacowaniu bezpiecznego limitu.

---

## 7. Realistyczne scenariusze pracy hotelu

### Scenariusz 1: Piątkowy wieczór — gorączka ostatniej chwili

**Sytuacja:** O 18:00 dzwoni gość, chce pokój na dziś na 1 noc. Hotel ma jeszcze 2 wolne pokoje.

**Działania:**
1. Recepcjonista sprawdza dostępność w Tape Chart (widok dzienny).
2. Wybiera wolny pokój, tworzy rezerwację z Źródłem PHONE.
3. Prosi o dane i potwierdza rezerwację.
4. Proponuje zaliczkę lub płatność przy przyjeździe (w zależności od polityki).
5. Gdy gość przyjeżdża — meldunek z okna rezerwacji (Check-in), pobranie płatności, wydanie klucza.

---

### Scenariusz 2: Gość bez rezerwacji wchodzi do lobby

**Sytuacja:** O 14:00 do recepcji podchodzi para z walizkami, pyta o pokój na 2 noce.

**Działania:**
1. Recepcjonista używa **Walk-in**.
2. Sprawdza wolne pokoje (np. lista „Dostępne na dziś”).
3. Wybiera pokój, wpisuje dane, liczbę nocy.
4. System od razu tworzy rezerwację i melduje gościa (CHECKED_IN).
5. Pobiera płatność, wydaje klucz.
6. Opcjonalnie — drukuje potwierdzenie na prośbę gościa.

---

### Scenariusz 3: Gość chce przedłużyć pobyt o 2 noce

**Sytuacja:** Gość zameldowany w pokoju 101 (check-out za 2 dni) prosi o przedłużenie o 2 noce.

**Działania:**
1. Recepcjonista otwiera rezerwację (klik w pasek na Tape Chart).
2. W formularzu zmienia datę wyjazdu (check-out) na +2 dni.
3. System sprawdza, czy pokój 101 jest wolny w nowym terminie.
4. Jeśli wolny — zapis. System przelicza cenę (nowe noce).
5. Recepcjonista informuje gościa o nowej sumie i ewentualnej dopłacie.

**Alternatywa:** Przeciągnięcie prawej krawędzi paska na Tape Chart o 2 dni w prawo.

---

### Scenariusz 4: Reklamacja — przeniesienie do lepszego pokoju

**Sytuacja:** Gość w pokoju 205 skarży się na hałas. Kierownik decyduje o przeniesieniu do 301 (lepszy widok).

**Działania:**
1. Recepcjonista otwiera rezerwację gościa.
2. Przeciąga pasek na Tape Chart na pokój 301 (ten sam termin) LUB zmienia pokój w formularzu.
3. System przenosi rezerwację.
4. Recepcjonista informuje housekeeping o sprzątaniu 301 (jeśli wymagane) i organizuje przenosiny bagaży.
5. Po przenosinach — aktualizacja klucza, ewentualnie rabat jako przeprosiny (dodanie w folio).

---

### Scenariusz 5: Anulowanie na dzień przed przyjazdem

**Sytuacja:** Gość dzwoni i rezygnuje z rezerwacji zaplanowanej na jutro. Zaliczka 200 zł została pobrana.

**Działania:**
1. Recepcjonista wyszukuje rezerwację (po nazwisku, dacie, numerze potwierdzenia).
2. Otwiera rezerwację, klika **Anuluj**.
3. Wybiera powód (np. „Gość zrezygnował”).
4. Potwierdza anulowanie.
5. Sprawdza politykę anulowania — czy zwrot zaliczki jest możliwy.
6. Wystawia zwrot (refund) w folio lub informuje gościa o braku zwrotu (zgodnie z regulaminem).
7. Rezerwacja ma status CANCELLED; pokój znów jest wolny.

---

### Scenariusz 6: Pełny hotel — celowy overbooking

**Sytuacja:** Hotel ma 20 pokojów. Historycznie 5–8% gości nie przyjeżdża (no-show). Kierownik ustawia limit overbookingu 5%. Na piątek jest 21 potwierdzonych rezerwacji.

**Działania:**
1. 21. rezerwacja jest przyjęta — system wyświetla ostrzeżenie „Rezerwacja w trybie overbooking”.
2. Recepcja na bieżąco śledzi listę przyjazdów.
3. Jeśli wszyscy przyjadą — hotel ma plan B: kontakt z pobliskim hotelem partnerskim, upgrade do apartamentu (jeśli dostępny), ugoda (noc gratis w innym terminie).
4. Jeśli ktoś nie przyjedzie (no-show) — rezerwacja oznaczana jako NO_SHOW, overbooking się „spłaca”.
5. Raport no-show służy do korekty limitu overbookingu na przyszłość.

---

### Scenariusz 7: Błąd recepcji — podwójna rezerwacja

**Sytuacja:** Pomyłkowo utworzono dwie rezerwacje na ten sam pokój i termin (np. duplikat przez błąd zapisu).

**Działania:**
1. Recepcjonista dostrzega konflikt (np. podświetlenie na Tape Chart, raport konfliktów).
2. Sprawdza obie rezerwacje — która jest ważna (np. która ma wcześniejszą datę utworzenia, płatność).
3. Jedną rezerwację anuluje z powodem „Błąd — duplikat”.
4. Gościa z anulowanej rezerwacji kontaktuje się i proponuje alternatywę lub zwrot.

---

### Scenariusz 8: Split — gość zostaje, ale zmienia pokój w trakcie pobytu

**Sytuacja:** Gość ma rezerwację 5 nocy w pokoju 101. Po 2 nocach chce przenieść się do 205 (np. bliżej windy).

**Działania:**
1. Opcja A — **Split rezerwacji:**  
   - Prawy przycisk na pasku → „Podziel rezerwację”.  
   - Data podziału: koniec 2. nocy.  
   - System tworzy 2 rezerwacje: 101 (2 noce) + 205 (3 noce).  
   - Dla gościa to jeden pobyt, w systemie dwie rezerwacje (ułatwia rozliczenie per pokój).

2. Opcja B — **Zmiana pokoju:**  
   - Edycja rezerwacji: zmiana pokoju z 101 na 205, zmiana daty check-in na „dzień 3”.  
   - Albo dwie osobne operacje: check-out z 101, check-in do 205 (nowa rezerwacja na 3 noce).

   Wybór zależy od polityki hotelu (jedno folio vs rozdzielone).
