# Logika Tape Chart (grafik rezerwacji)

**Dokument:** tape_chart_logic.md  
**Przeznaczenie:** Materiał szkoleniowy AI — opis zachowania grafiku pokojów, przeciągania, dostępności, kolorów i konfliktów.

---

## 1. Widok kalendarza pokoi

### Czym jest Tape Chart

Tape Chart to **wykres Gantta** — kalendarz pokoi w formie siatki:

- **Oś Y (pionowa)** — wiersze = pokoje (numer, typ, status),
- **Oś X (pozioma)** — kolumny = dni (daty),
- **Paski** — rezerwacje (każdy pasek = jedna rezerwacja w danym pokoju i terminie).

### Skala widoku (View Scale)

| Widok | Zakres | Szerokość kolumny | Użycie |
|-------|--------|-------------------|--------|
| **Dzień** | 1 dzień | ~480 px | Szczegółowy plan na dziś |
| **Tydzień** | 42 dni (~6 tygodni) | ~100 px | Standardowa praca recepcji |
| **Miesiąc** | ~93 dni (~3 miesiące) | ~48 px | Przegląd obłożenia |
| **Rok** | 365 dni | ~12 px | Planowanie długoterminowe |

Domyślny widok to **Tydzień**. Użytkownik przełącza widok przyciskami (Dzień / Tydzień / Miesiąc / Rok).

### Nawigacja w czasie

- **Poprzedni / Następny** — przesunięcie widoku o kilka dni (zależnie od skali),
- **Dziś** — powrót do bieżącej daty,
- **Przejdź do daty** — wybór konkretnej daty.

### Oznaczenia dni

- **DZIŚ** — wyróżniona kolumna (np. pogrubiona),
- **Dni przeszłe** — inny styl (np. wyszarzone),
- **Sobota / niedziela** — opcjonalnie odmienne tło (np. weekend).

### Dodatkowe widoki

- **Plan pięter** — graficzny plan hotelu (pokoje jako bloki na planie piętra),
- **KWHotel** — widok tabelaryczny (alternatywny styl),
- **Wydarzenia** — pasek nad siatką z wydarzeniami (np. konferencje, wesela).

### Filtry

- **Typ pokoju** — pokaż tylko wybrane typy (Standard, Deluxe, Suite itd.),
- **Piętro** — pokaż tylko wybrane piętro,
- **Status pokoju** — CLEAN, DIRTY, OOO itd.,
- **Tylko wolne pokoje** — ukryj pokoje zajęte w widocznym okresie,
- **Pokaż tylko ten pokój** — skupienie na jednym pokoju (np. z menu kontekstowego).

### Przewijanie

- **Scroll poziomy** — przesuwanie w czasie,
- **Scroll pionowy** — przewijanie listy pokoi,
- **Pan** — przeciąganie siatki myszką (gdy kliknięto w pustą komórkę i przeciągnięto).

---

## 2. Przesuwanie rezerwacji (drag & drop)

### Które rezerwacje można przeciągać

Tylko rezerwacje ze statusem **CONFIRMED** lub **CHECKED_IN**.  
Rezerwacje PENDING, CHECKED_OUT, CANCELLED, NO_SHOW nie są przeciągalne.

### Tryb przeciągania

- **Drag bez Shift** (domyślnie) — przeciąganie od razu po chwyceniu paska,
- **Z Shift** — przeciąganie dopiero po naciśnięciu Shift (zapobiega przypadkowemu przesunięciu).

### Strefy upuszczenia

1. **Komórka (cell)** — konkretna para: pokój + data.
   - Id: `cell-{roomNumber}__{dateStr}`
   - Upuszczenie na komórkę → zmiana pokoju i/lub dat (zachowanie liczby nocy).

2. **Wiersz pokoju (room)** — cały wiersz pokoju.
   - Id: `room-{roomNumber}`
   - Upuszczenie na wiersz → zmiana tylko pokoju, daty bez zmian.

### Co się dzieje przy upuszczeniu

- **Na komórkę** — system wylicza nowe `checkIn` i `checkOut` (zachowując liczbę nocy) i wywołuje `updateReservation` lub `moveReservation`.
- **Na wiersz pokoju** — zmiana pokoju przez `moveReservation` (daty bez zmian).

### Zmiana długości pobytu (resize)

- **Lewy uchwyt** — przeciągnięcie zmienia datę przyjazdu (check-in).
- **Prawy uchwyt** — przeciągnięcie zmienia datę wyjazdu (check-out).
- Walidacja: data wyjazdu musi być po dacie przyjazdu.

### Ograniczenia przy upuszczeniu

- **Pokój OOO** — całkowita blokada; system zwraca błąd.
- **Room Block** — pokój zablokowany w danym terminie; komórka ma styl „zablokowana”, klik pokazuje komunikat.
- **Inna rezerwacja** — nakładanie się na inną rezerwację w tym samym pokoju: blokada (chyba że dozwolony overbooking).

### Auto-przewijanie

Podczas przeciągania przy krawędziach siatki — automatyczne przewijanie w kierunku krawędzi.

### Cofnij / Ponów

- **Ctrl+Z** — cofnij ostatnią operację (do 5 kroków),
- **Ctrl+Y** — ponów cofniętą operację.

---

## 3. Sprawdzanie dostępności

### Z grafiku (komórki)

- **Pusta komórka** — brak rezerwacji w tym pokoju na ten dzień.
- **Klik w pustą komórkę** (lub zaznaczenie obszaru) — otwiera formularz nowej rezerwacji z wstępnie ustawionym pokojem i datami.
- **Komórka z paskiem** — pokój zajęty; klik otwiera istniejącą rezerwację.

### Wyszukiwarka pokoi (searchAvailableRooms)

Funkcja sprawdza dostępność dla podanego okresu i kryteriów:

- **Parametry:** check-in, check-out, liczba osób (dorośli + dzieci), typ pokoju, piętro, cechy, maks. cena.
- **Wynik:** lista `available` (wolne) i `unavailable` (zajęte) z powodem (`conflictReason`: np. „Zajęty w wybranym okresie”).

### Zasada nakładania się

Pokój jest **zajęty**, jeśli istnieje rezerwacja o statusie CONFIRMED lub CHECKED_IN, która nachodzi na okres:

- `checkIn_rezerwacji < checkOut_zapytania` AND `checkOut_rezerwacji > checkIn_zapytania`

### Pokoje ukryte

- **activeForSale = false** — pokój nie jest brany pod uwagę w wyszukiwaniu dostępności (np. remont).
- **OOO** — pokój wyłączony; nie może przyjąć nowej rezerwacji.

### Status CLEAN vs DIRTY

- Dla **dostępności** liczy się tylko brak konfliktów rezerwacyjnych.
- Pokój DIRTY może być technicznie wolny (brak rezerwacji), ale niegotowy na meldunek — recepcja widzi status i decyduje.

---

## 4. Kolory pasków

### Status rezerwacji (bazowe kolory)

| Status | Kolor (domyślny) | Znaczenie |
|--------|------------------|-----------|
| **PENDING** | Szary / cynk | Oczekuje na potwierdzenie |
| **CONFIRMED** | Zielony | Potwierdzona, oczekuje na przyjazd |
| **CHECKED_IN** | Niebieski | Zameldowany, gość w hotelu |
| **CHECKED_OUT** | Szary | Wymeldowany |
| **CANCELLED** | Czerwony | Anulowana |
| **NO_SHOW** | Pomarańczowy | Gość nie przyjechał |

### Kombinacja: status × płatność

Faktyczny kolor paska może być **kombinacją** statusu rezerwacji i statusu płatności:

- **PAID** — opłacona (np. turkusowy odcień),
- **PARTIAL** — częściowo opłacona (np. żółty),
- **UNPAID** — nieopłacona (np. fioletowy).

Klucz kombinacji: `{status}_{paymentStatus}` (np. `CONFIRMED_UNPAID`, `CHECKED_IN_PAID`).

### Konfiguracja per obiekt

Kolory można nadpisać w ustawieniach obiektu (Property):

- `reservationStatusColors` — kolory statusów,
- `statusCombinationColors` — macierz status × płatność.

### Oznaczenia dodatkowe na pasku

- **Czarna ramka** — standardowo dla wszystkich pasków.
- **Czerwona obwódka (ring)** — rezerwacja w konflikcie (gdy włączone „Konflikty”).
- **Ikona / badge** — np. zaległa zaliczka (`advanceDueDate` przekroczona), VIP.

### Tryb prywatności

Gdy włączony — nazwisko gościa jest ukryte na pasku; widoczne po najechaniu myszką.

---

## 5. Konflikty

### Co to jest konflikt

**Konflikt** = dwie lub więcej rezerwacji aktywnych (CONFIRMED, CHECKED_IN) w **tym samym pokoju** w **nakładających się terminach**.

Wzór nakładania: `a.checkIn < b.checkOut && a.checkOut > b.checkIn`.

### Wizualizacja konfliktów

- Przełącznik **„Konflikty”** — włącza/wyłącza podświetlanie.
- Gdy włączone — paski z konfliktami mają **czerwoną obwódkę** (ring).
- Licznik konfliktów — np. badge „3” przy przełączniku, gdy są 3 rezerwacje w konflikcie.

### Skutki konfliktów

- **Overbooking** — fizycznie ten sam pokój przypisany dwóm gościom w tym samym czasie.
- **Przy tworzeniu/edycji** — system **blokuje** nową rezerwację, jeśli pokój jest zajęty (chyba że dozwolony overbooking).
- **Przy przeciąganiu** — `moveReservation` / `updateReservation` zwracają błąd: „Pokój X jest zajęty w podanym terminie”.

### Overbooking

- Limit overbookingu (np. 10%) jest ustawiany per obiekt.
- Gdy limit > 0 — system może pozwolić na przekroczenie dostępności; wyświetla ostrzeżenie „Rezerwacja utworzona w trybie overbooking”.
- Konflikty nadal są liczone i podświetlane — hotel świadomie akceptuje nadrezerwację.

### Typowe przyczyny konfliktów

- **Błąd recepcji** — podwójna rezerwacja (duplikat),
- **Import z zewnątrz** — niespójność danych (np. Channel Manager),
- **Równoczesna edycja** — dwie osoby zapisują w tym samym czasie (optymistyczna blokada: „Rezerwacja została zmieniona w międzyczasie”),
- **Celowy overbooking** — limit > 0.

### Jak rozwiązać konflikt

1. **Odnaleźć** — włączyć „Konflikty”, zobaczyć podświetlone paski.
2. **Ustalić** — która rezerwacja jest ważna (np. starsza, z płatnością).
3. **Działanie** — anulować duplikat, przenieść jedną rezerwację do innego pokoju lub innego terminu.

---

## 6. Inne zachowania

### Room Block (blokada pokoju)

- Pokój może być zablokowany na okres (np. remont, wydarzenie).
- Komórki w zablokowanym okresie: styl „zablokowana”, `cursor: not-allowed`, klik → toast „Pokój zablokowany w tym terminie (Room Block)”.

### Klik vs Double-click

- **Pojedynczy klik** — otwiera okno edycji rezerwacji.
- **Double-click** — otwiera okno z zakładką Rozliczenie.
- **Ctrl+klik** — zaznaczenie wielu rezerwacji (np. do faktury zbiorczej).

### Statystyki na grafiku

- **Obłożenie** — procent zajętych pokoi w widocznym okresie.
- **Dzisiejsze przyjazdy / wyjazdy** — liczba rezerwacji.
- **Brudne pokoje** — liczba pokoi ze statusem DIRTY.
