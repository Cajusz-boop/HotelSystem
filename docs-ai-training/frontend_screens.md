# Ekrany systemu — przewodnik dla pracownika

**Dokument:** frontend_screens.md  
**Przeznaczenie:** Materiał szkoleniowy AI — opis każdego ekranu: co widzi pracownik, gdzie klika, co się stanie, jakie mogą być błędy.

---

## 1. Login (`/login`)

### Co widzi pracownik

- Logo hotelu (lub fallback tekstowy),
- Tytuł „Karczma Łabędź — logowanie”,
- Siatka przycisków z **imionami użytkowników** (np. Recepcja, Kierownik),
- Opcję „— lub —” oraz przycisk **Zaloguj przez Google**.

### Gdzie klika

- **Przycisk z imieniem użytkownika** — otwiera okno dialogowe z polem PIN,
- **Cyfry 0–9** (klawiatura numeryczna w oknie) — wpisanie PIN (4 cyfry),
- **Usuń (⌫)** — usuwa ostatnią cyfrę,
- **C** — czyści cały PIN,
- **Zaloguj przez Google** — przekierowanie do logowania OAuth Google.

### Co się stanie

- **Po wpisaniu 4 cyfr** — automatyczna weryfikacja (jeśli włączone); sukces → toast „Zalogowano jako…”, przekierowanie na `/front-office`,
- **Enter** przy 4 cyfrach — ten sam efekt co auto-submit,
- **Escape** — zamknięcie okna PIN bez logowania.

### Możliwe błędy

| Błąd | Opis | Reakcja systemu |
|------|------|-----------------|
| Nieprawidłowy PIN | Błędne 4 cyfry | Czerwony komunikat „Wpisz 4 cyfry PIN” lub „Błąd logowania”, pole PIN zostaje wyczyszczone |
| Nie załadowano użytkowników | Błąd API / sieci | Komunikat „Nie można załadować użytkowników” + przycisk „Ponów” |
| Timeout | Przekroczony czas oczekiwania | „Przekroczono czas oczekiwania. Sprawdź połączenie.” |
| Brak użytkowników z PIN | Pusta lista | „Brak użytkowników z ustawionym PIN.” |
| Błąd OAuth (Google) | np. anulowano, brak konta | Toast z komunikatem (no_account, config, google_denied, invalid_state) |

---

## 2. Dashboard (`/dashboard`)

### Co widzi pracownik

- Nagłówek „Centrum Dowodzenia” z datą,
- Przycisk **Otwórz grafik** (przejście do Front Office),
- **KPI:** Obłożenie dziś, ADR dziś, RevPAR dziś (z trendami vs wczoraj),
- **Sytuacja dnia:** meldunki, wyjazdy, VIP, do sprzątania, OOO,
- **Mapa funkcji systemu** — kafelek z ikonami (Recepcja, Finanse, Housekeeping itd.),
- **Wykresy** obłożenia i przychodów,
- **KPI ostatnie 30 dni** — obłożenie, ADR, RevPAR,
- **Widgety:** Przyjazdy VIP, Pokoje do sprzątania, OOO, Dzisiejsze meldunki, Wyjazdy, Restauracja.

### Gdzie klika

- **Otwórz grafik** — przejście do `/front-office`,
- **Kafelek w mapie funkcji** — przejście do odpowiedniego modułu (np. Grafik, Meldunek, Kontrahenci),
- **Rząd na liście VIP / meldunków / wyjazdów** — może prowadzić do rezerwacji (zależnie od implementacji).

### Co się stanie

- Klik w kafelek → nawigacja do wybranej strony,
- Odświeżenie strony → ponowne ładowanie danych z serwera.

### Możliwe błędy

| Błąd | Opis | Reakcja systemu |
|------|------|-----------------|
| Błąd ładowania danych | np. baza niedostępna | Brak KPI / pusty widok; zależnie od implementacji komunikat błędu |
| Brak uprawnień | Użytkownik nie ma dostępu do części modułów | Kafelki mogą być ukryte (menu filtrowane) |

---

## 3. Tape Chart (`/front-office`)

### Co widzi pracownik

- **Siatka Gantta:** wiersze = pokoje, kolumny = dni,
- **Paski rezerwacji** (kolory wg statusu i płatności),
- **Pasek narzędzi:** widok (Dzień/Tydzień/Miesiąc/Rok), filtry, Konflikty, Podział dni, Drag bez Shift,
- **Menu boczne** (sidebar) z nawigacją,
- **Lista pokoi** po lewej z numerem, typem, statusem.

### Gdzie klika

- **Pusty obszar komórki** — otwiera formularz nowej rezerwacji (pokój + daty z kontekstu),
- **Pasek rezerwacji** — otwiera okno edycji rezerwacji (Sheet),
- **Przycisk + Nowa rezerwacja** — formularz nowej rezerwacji bez kontekstu,
- **Przeciągnięcie paska** — zmiana pokoju/dat (gdy CONFIRMED lub CHECKED_IN),
- **Prawy przycisk na pasku** — menu kontekstowe (Podziel, Wymelduj, Anuluj itd.),
- **DZIŚ / Poprzedni / Następny** — zmiana widocznego zakresu dat,
- **Konflikty (Switch)** — włącza/wyłącza podświetlanie konfliktów.

### Co się stanie

- Klik w pustą komórkę → otwarcie formularza z wstępnym pokojem i datami,
- Klik w pasek → otwarcie okna rezerwacji (zakładki: Rozliczenie, Dokumenty, Posiłki itd.),
- Przeciągnięcie → `moveReservation` lub `updateReservation`; sukces → toast, odświeżenie; błąd → toast z komunikatem.

### Możliwe błędy

| Błąd | Opis | Reakcja systemu |
|------|------|-----------------|
| Pokój zajęty | Przeciągnięcie na zajęty pokój/termin | Toast: „Pokój X jest zajęty w podanym terminie” |
| Pokój OOO | Przeciągnięcie na OOO | „Pokój X jest wyłączony ze sprzedaży (OOO)” |
| Room Block | Klik w zablokowaną komórkę | Toast: „Pokój zablokowany w tym terminie (Room Block)” |
| Limit overbookingu | Przekroczony limit | „Pokój X przekracza limit overbookingu…” |
| Błąd ładowania | Nie udało się załadować danych | Ekran błędu z komunikatem i wskazówką (sprawdź połączenie, migracje) |

---

## 4. Formularz rezerwacji (okno w Tape Chart)

### Co widzi pracownik

- **Lewa kolumna:** dane pokoju (grupa, numer), okres pobytu (check-in/out, noce, dorośli/dzieci), dane gościa (wyszukiwanie, imię, email, telefon, firma),
- **Prawa kolumna — zakładki:** Rozliczenie, Dokumenty, Posiłki, Grafik sprzątań, Parking, Pozostałe, Usługi, Meldunek,
- **Stopka:** Towary, Wystaw dok., Ceny/dni, Usuń rez., Płatności, Historia, **Zapisz**.

### Gdzie klika

- **Pole Gość** — wyszukiwanie; wybór z listy sugerowanych gości,
- **Pole Pokój** — zmiana pokoju,
- **Zakładki** — przełączenie widoku (Rozliczenie, Dokumenty itd.),
- **Melduj gościa** — zmiana statusu na CHECKED_IN (gdy CONFIRMED),
- **Wymelduj i zapisz** — zmiana statusu na CHECKED_OUT,
- **Zapisz** — zapisanie zmian w rezerwacji,
- **Usuń rez.** — otwarcie dialogu anulowania z powodem.

### Co się stanie

- **Zapisz** — `updateReservation`; sukces → toast, zamknięcie lub pozostanie w oknie (w zależności od konfiguracji),
- **Melduj** — `updateReservationStatus(…, "CHECKED_IN")`; toast „Zameldowano”,
- **Wymelduj** — `updateReservationStatus(…, "CHECKED_OUT")`; toast „Wymeldowano”; pokój → DIRTY,
- **Usuń** — po potwierdzeniu i podaniu powodu → `deleteReservation`; status CANCELLED.

### Możliwe błędy

| Błąd | Opis | Reakcja systemu |
|------|------|-----------------|
| Błąd walidacji | np. brak imienia, złe daty | Czerwony komunikat nad formularzem lub przy polu |
| Pokój zajęty | Edycja dat/pokoju na zajęty termin | „Pokój X jest zajęty w wybranym terminie” |
| Konflikt zapisu | Rezerwacja zmieniona w innej karcie | „Rezerwacja została zmieniona w międzyczasie (np. w innej karcie). Odśwież i zapisz ponownie.” |
| Gość na czarnej liście | Zapis z gościem isBlacklisted | Toast ostrzegawczy: „Uwaga: gość jest na czarnej liście” (rezerwacja zapisana) |

---

## 5. Check-in (`/check-in`)

### Co widzi pracownik

- Nagłówek „Meldunek gościa”,
- Formularz: **Imię i nazwisko**, Email, Telefon, Data urodzenia,
- **Zakres dat:** Check-in, Check-out,
- **Pokój** — lista dostępnych pokoi (wg dat),
- **Dorośli / Dzieci**,
- **Zdjęcie dowodu (Parse & Forget)** — przycisk wgrania pliku,
- **Pole MRZ** — ręczne wklejenie paska MRZ,
- **NIP** (opcjonalnie) — wyszukiwanie firmy,
- **Pola niestandardowe** (np. zgody),
- Przycisk **Utwórz rezerwację** (lub podobny).

### Gdzie klika

- **Pole Imię** — wpisanie; po 2+ znakach pojawia się lista sugerowanych gości; klik w sugestię → uzupełnienie danych,
- **Wybierz zdjęcie** — wgranie zdjęcia dowodu; OCR wypełnia pola; plik nie jest zapisywany,
- **Pole MRZ** — wklejenie tekstu z paska MRZ; blur → parsowanie i uzupełnienie imienia,
- **Pokój** — wybór z listy dostępnych,
- **Utwórz rezerwację** — zapis nowej rezerwacji (status CONFIRMED).

### Co się stanie

- **Wybór gościa z listy** — uzupełnienie imienia, emaila, telefonu, daty urodzenia,
- **OCR z pliku** — uzupełnienie imienia (i MRZ, jeśli wykryto),
- **MRZ blur** — parsowanie → uzupełnienie imienia,
- **Utwórz** — `createReservation`; sukces → toast „Rezerwacja utworzona”, wyczyszczenie formularza.

### Możliwe błędy

| Błąd | Opis | Reakcja systemu |
|------|------|-----------------|
| Brak imienia | Pole puste | Błąd walidacji przy zapisie |
| Pokój niedostępny | Brak wolnych pokoi na daty | Lista pokoi pusta; błąd przy zapisie |
| Błąd OCR | Nie odczytano dokumentu | Toast: „Nie udało się odczytać dokumentu” |
| Błąd parsowania MRZ | Nieprawidłowy format MRZ | Brak automatycznego uzupełnienia |

---

## 6. Check-out (w oknie rezerwacji)

### Co widzi pracownik

- W **zakładce Rozliczenie** (w oknie rezerwacji otwartym z Tape Chart):
  - Status rezerwacji (dropdown),
  - Przycisk **Melduj gościa** (gdy CONFIRMED),
  - Przycisk **Wymelduj i zapisz** (gdy CHECKED_IN),
- **Folio** — lista obciążeń i wpłat, saldo,
- **Dodaj wpłatę** — przycisk do rejestracji płatności.

### Gdzie klika

- **Wymelduj i zapisz** — wymeldowanie gościa,
- **Wymelduj** (w menu kontekstowym paska) — alternatywna ścieżka,
- **Dodaj wpłatę** — przed wymeldowaniem, gdy saldo > 0.

### Co się stanie

- **Wymelduj** — `updateReservationStatus(…, "CHECKED_OUT")`; pokój → DIRTY; statystyki gościa zaktualizowane; ewentualna faktura VAT; zwolnienie kaucji,
- Gdy **saldo > 0** — system może pokazać ostrzeżenie „Wymelduj mimo salda” (decyzja recepcji).

### Możliwe błędy

| Błąd | Opis | Reakcja systemu |
|------|------|-----------------|
| Błąd wymeldowania | np. błąd serwera | Toast z komunikatem błędu |
| Nieopłacone saldo | Gość ma dług | Ostrzeżenie; wymeldowanie możliwe, ale zalecane pobranie płatności |

---

## 7. Płatności (w oknie rezerwacji — zakładka Rozliczenie)

### Co widzi pracownik

- **Folio** — tabela obciążeń (ROOM, MINIBAR itd.) i wpłat (PAYMENT, DEPOSIT),
- **Saldo** — suma do zapłaty (ujemne = nadpłata),
- **Metoda płatności** — CASH, CARD, TRANSFER, PREPAID itd.,
- **Przyciski:** Dodaj wpłatę, Zaliczka, Kaucja (pobierz/zwolnij), Rabat, Dodaj obciążenie.

### Gdzie klika

- **Dodaj wpłatę** — wpisanie kwoty + metoda; zapis → transakcja PAYMENT w folio,
- **Zaliczka** — wpłata zaliczki (DEPOSIT),
- **Kaucja** — pobranie kaucji (`collectSecurityDeposit`) lub zwolnienie (`refundSecurityDeposit`),
- **Rabat** — dodanie rabatu (może wymagać PIN kierownika),
- **Dodaj obciążenie** — np. minibar, SPA (dialog AddCharge).

### Co się stanie

- **Wpłata** — `addFolioPayment` lub `registerTransaction`; nowa transakcja w folio; odświeżenie salda,
- **Kaucja** — obciążenie typu DEPOSIT; przy zwolnieniu — REFUND,
- **Rabat** — `addFolioDiscount`; może wymagać potwierdzenia PIN.

### Możliwe błędy

| Błąd | Opis | Reakcja systemu |
|------|------|-----------------|
| Nieprawidłowa metoda | Niewłaściwy kod metody | Walidacja: dozwolone CASH, CARD, TRANSFER itd. |
| SPLIT — suma nie zgadza się | Suma części ≠ kwota | „Suma metod nie zgadza się z kwotą transakcji” |
| Brak uprawnień do rabatu | Recepcja bez prawa | Wymóg PIN kierownika lub błąd |
| Błąd rejestracji | Serwer / baza | Toast z komunikatem |

---

## 8. Lista gości (`/kontrahenci` — zakładka Goście)

### Co widzi pracownik

- **Zakładki:** Goście | Firmy,
- **Filtry:** Szukaj (nazwisko, email, telefon, NIP), Segment, Kraj, Narodowość, VIP, Czarna lista, Ostatni pobyt, Liczba pobytów, Wiek, Sortowanie,
- **Tabela gości:** Imię i nazwisko, Email, Telefon, Kraj, Segment, VIP, Czarna lista, Liczba pobytów, Ostatni pobyt,
- **Paginacja** (strony),
- **Eksport** — CSV, Excel.

### Gdzie klika

- **Pole Szukaj** — wpisanie zapytania; po debounce (ok. 300 ms) wyszukiwanie,
- **Filtry** — zmiana kryteriów; automatyczne ponowne wyszukiwanie,
- **Wiersz gościa** — przejście do karty gościa (`/guests/[id]`),
- **Eksport CSV / Excel** — pobranie pliku z danymi gości,
- **Ponów** (przy błędzie) — ponowne załadowanie.

### Co się stanie

- **Wyszukiwanie** — `getFilteredGuests`; aktualizacja listy i total,
- **Klik w gościa** — nawigacja do karty gościa (historia pobytów, edycja, czarna lista),
- **Eksport** — `getGuestsForExport`; generacja CSV/Excel; pobranie pliku.

### Możliwe błędy

| Błąd | Opis | Reakcja systemu |
|------|------|-----------------|
| Błąd ładowania | API / sieć | Komunikat błędu; przycisk „Ponów” |
| Brak wyników | Filtry zbyt restrykcyjne | Pusta tabela; informacja „Brak gości” |
| Błąd eksportu | np. przekroczony limit | Toast z komunikatem |

---

## 9. Finanse (`/finance`) — ekran główny

### Co widzi pracownik

- **Audyt nocny** — przycisk do uruchomienia audytu,
- **Kasa** — otwarcie/zamknięcie zmiany kasowej, Blind Drop,
- **Transakcje dnia** — lista z filtrem typu,
- **Rachunki (nie-VAT)** — lista rachunków, opłacenie, usunięcie,
- **Noty księgowe** — lista, anulowanie,
- **Raporty** — prowizje, PKPiR, rejestry VAT, JPK,
- **KSeF** — konfiguracja, wysyłka faktur.

### Gdzie klika

- **Audyt nocny** — uruchomienie audytu; potwierdzenie; naliczenia, zamknięcie dnia,
- **Otwórz zmianę** — podanie stanu początkowego kasy,
- **Zamknij zmianę** — podanie stanu końcowego; porównanie z oczekiwanym,
- **Blind Drop** — odprowadzenie gotówki; wpisanie kwoty; porównanie,
- **Unieważnij** (transakcja) — wymaga PIN; `voidTransaction`,
- **Opłać** (rachunek) — zmiana statusu na opłacony.

### Co się stanie

- **Audyt nocny** — naliczenia za noc, podatek lokalny, zamknięcie dnia; raport,
- **Zamknięcie zmiany** — porównanie stanu; różnice; zapis,
- **Blind Drop** — sprawdzenie gotówki; zapis; ewentualna różnica.

### Możliwe błędy

| Błąd | Opis | Reakcja systemu |
|------|------|-----------------|
| Audyt już wykonany | Drugi audyt w tym samym dniu | Komunikat o niemożności wykonania |
| Błędny PIN (void) | Nieprawidłowy PIN kierownika | Odrzucenie unieważnienia |
| Różnica w kasie | Stan rzeczywisty ≠ oczekiwany | Komunikat z różnicą; decyzja użytkownika |
| Timeout ładowania | Przekroczony czas (>15 s) | Komunikat błędu ładowania |
