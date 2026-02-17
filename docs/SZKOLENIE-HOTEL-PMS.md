# Podręcznik szkoleniowy — System Zarządzania Hotelem (PMS)

**Wersja:** 1.0  
**Data:** Luty 2026  
**Adres systemu:** https://hotel.karczma-labedz.pl  

---

## Spis treści

1. [Wprowadzenie](#1-wprowadzenie)
2. [Logowanie i nawigacja](#2-logowanie-i-nawigacja)
3. [Dashboard — Pulpit główny](#3-dashboard--pulpit-główny)
4. [Front Office — Tape Chart (Grafik rezerwacji)](#4-front-office--tape-chart)
5. [Rezerwacje — tworzenie i zarządzanie](#5-rezerwacje--tworzenie-i-zarządzanie)
6. [Check-in i Check-out](#6-check-in-i-check-out)
7. [Goście i kontrahenci](#7-goście-i-kontrahenci)
8. [Pokoje](#8-pokoje)
9. [Cennik i plany taryfowe](#9-cennik-i-plany-taryfowe)
10. [Housekeeping — Gospodarstwo pokojowe](#10-housekeeping--gospodarstwo-pokojowe)
11. [Finanse](#11-finanse)
12. [Usługi dodatkowe](#12-usługi-dodatkowe)
13. [MICE — Konferencje i eventy](#13-mice--konferencje-i-eventy)
14. [Raporty](#14-raporty)
15. [Channel Manager](#15-channel-manager)
16. [Aplikacja gościa i Web Check-in](#16-aplikacja-gościa-i-web-check-in)
17. [Ustawienia systemu](#17-ustawienia-systemu)
18. [Skróty klawiaturowe](#18-skróty-klawiaturowe)
19. [Najczęstsze pytania (FAQ)](#19-najczęstsze-pytania-faq)
20. [Słownik pojęć](#20-słownik-pojęć)

---

## 1. Wprowadzenie

### Czym jest ten system?

System Zarządzania Hotelem (PMS — Property Management System) to kompleksowe narzędzie do prowadzenia hotelu. Obejmuje wszystkie aspekty operacji hotelowej:

- **Rezerwacje** — tworzenie, modyfikacja, anulowanie
- **Front Office** — grafik pokojów (tape chart), meldowanie gości
- **Housekeeping** — statusy pokojów, sprzątanie, minibar
- **Finanse** — faktury, paragony, rozliczenia, audyt nocny
- **Usługi** — SPA, gastronomia, room service, transfery, atrakcje
- **Raporty** — statystyki, raporty GUS, policyjne, finansowe
- **Integracje** — Channel Manager (Booking.com, Expedia), drukarka fiskalna, KSeF

### Dla kogo jest ten podręcznik?

- **Recepcjoniści** — codzienne operacje: rezerwacje, check-in/out, płatności
- **Housekeeping** — zarządzanie statusami pokojów, sprzątanie
- **Kierownicy** — raporty, finanse, audyt nocny
- **Administracja** — ustawienia systemu, użytkownicy, uprawnienia

### Wymagania techniczne

- Przeglądarka: Chrome, Firefox, Edge (najnowsza wersja)
- Połączenie z internetem
- Rozdzielczość ekranu: minimum 1280×720 (zalecane 1920×1080)

---

## 2. Logowanie i nawigacja

### Logowanie

1. Otwórz przeglądarkę i wejdź na adres systemu
2. Wpisz **login** (nazwa użytkownika) i **hasło**
3. Jeśli masz włączone **2FA** (uwierzytelnianie dwuskładnikowe), wpisz kod z aplikacji authenticator
4. Kliknij **Zaloguj**

### Zmiana hasła

- Wejdź w menu użytkownika (prawy górny róg) → **Zmień hasło**
- Podaj stare hasło i dwukrotnie nowe hasło
- Hasło musi spełniać wymagania bezpieczeństwa

### Nawigacja — Menu boczne (Sidebar)

Po lewej stronie ekranu znajduje się **menu boczne** z głównymi sekcjami:

| Ikona | Sekcja | Opis |
|-------|--------|------|
| 🏠 | Dashboard | Pulpit główny z KPI |
| 📅 | Front Office | Grafik rezerwacji (Tape Chart) |
| 🛏️ | Pokoje | Zarządzanie pokojami |
| 👥 | Goście | Baza gości i kontrahentów |
| 💰 | Finanse | Faktury, płatności, audyt |
| 🧹 | Housekeeping | Statusy pokojów |
| 🍽️ | Gastronomia | Restauracja i room service |
| 💆 | SPA | Rezerwacje SPA |
| 📊 | Raporty | Wszystkie raporty |
| ⚙️ | Ustawienia | Konfiguracja systemu |

### Paleta komend (Ctrl+K)

Naciśnij **Ctrl+K** w dowolnym momencie, aby otworzyć paletę komend — szybkie wyszukiwanie funkcji, rezerwacji, gości.

### Przełączanie obiektów (Multi-property)

Jeśli system obsługuje wiele obiektów, w lewym górnym rogu znajduje się **przełącznik obiektów** — kliknij, aby zmienić aktywny hotel.

### Tryb ciemny/jasny

W prawym górnym rogu kliknij ikonę motywu, aby przełączyć między trybem jasnym a ciemnym.

---

## 3. Dashboard — Pulpit główny

Dashboard to pierwsza strona po zalogowaniu. Pokazuje najważniejsze informacje na dany dzień:

### Wskaźniki KPI (Key Performance Indicators)

- **Occupancy (Obłożenie)** — procent zajętych pokojów
- **ADR (Average Daily Rate)** — średnia cena za pokój/noc
- **RevPAR (Revenue Per Available Room)** — przychód na dostępny pokój
- **Przychód dzienny** — łączny przychód z dnia

### Sekcje informacyjne

- **Przyjazdy VIP** — lista gości VIP przyjeżdżających dziś
- **Brudne pokoje** — pokoje wymagające sprzątania
- **Pokoje OOO (Out of Order)** — pokoje wyłączone z użytku
- **Dzisiejsze check-iny** — lista oczekiwanych meldunków
- **Dzisiejsze check-outy** — lista oczekiwanych wymeldowań

### Wykresy

- Wykres obłożenia (ostatnie 30 dni)
- Wykres przychodów
- Porównanie rok do roku (YoY)

---

## 4. Front Office — Tape Chart

### Czym jest Tape Chart?

Tape Chart (grafik rezerwacji) to główne narzędzie pracy recepcji. Jest to **kalendarz w formie wykresu Gantta**:

- **Oś X (pozioma)** — daty (dni)
- **Oś Y (pionowa)** — pokoje
- **Kolorowe paski** — rezerwacje

### Widoki

System oferuje kilka widoków:

| Widok | Opis |
|-------|------|
| **Dzienny** | Jeden dzień, szczegółowy |
| **Tygodniowy** | 7 dni, standardowy widok pracy |
| **Miesięczny** | 30 dni, przegląd obłożenia |
| **Roczny** | 365 dni, planowanie długoterminowe |
| **Plan pięter** | Graficzny plan pięter hotelu |
| **KWHotel** | Alternatywny widok tabelaryczny |

### Kolory rezerwacji

Kolory pasków oznaczają status rezerwacji:

| Kolor | Status |
|-------|--------|
| Niebieski | Potwierdzona (Confirmed) |
| Zielony | Zameldowana (Checked-in) |
| Szary | Wymeldowana (Checked-out) |
| Żółty | Oczekująca (Pending) |
| Czerwony | Anulowana (Cancelled) |
| Fioletowy | No-show |

### Operacje na Tape Chart

#### Tworzenie rezerwacji
1. **Kliknij i przeciągnij** na wolnym polu — zaznacz pokój i daty
2. Otworzy się formularz nowej rezerwacji
3. Wypełnij dane i zapisz

#### Przenoszenie rezerwacji (zmiana pokoju/dat)
1. **Chwyć pasek rezerwacji** i przeciągnij na inny pokój lub datę
2. System sprawdzi dostępność i potwierdzi zmianę

#### Zmiana długości pobytu
1. **Chwyć krawędź paska** (lewą lub prawą) i przeciągnij
2. System zmieni datę przyjazdu lub wyjazdu

#### Podział rezerwacji (Split)
1. Kliknij prawym przyciskiem na rezerwację
2. Wybierz **Podziel rezerwację**
3. Wybierz datę podziału — system stworzy dwie osobne rezerwacje

#### Cofnij/Ponów (Undo/Redo)
- **Ctrl+Z** — cofnij ostatnią operację (do 5 kroków wstecz)
- **Ctrl+Y** — ponów cofniętą operację

### Filtry

Na górze Tape Chart dostępne są filtry:
- **Typ pokoju** — filtruj po typach (Standard, Deluxe, Suite, itp.)
- **Piętro** — pokaż tylko wybrane piętro
- **Cechy pokoju** — filtruj po cechach (balkon, widok na morze, itp.)
- **Status** — pokaż tylko pokoje o danym statusie

### Room Guard

System automatycznie blokuje przypisanie gościa do pokoju, który jest:
- **DIRTY** (brudny) — wymaga sprzątania
- **OOO** (Out of Order) — wyłączony z użytku
- **MAINTENANCE** — w trakcie naprawy

Recepcjonista może wymusić przypisanie, ale system wyświetli ostrzeżenie.

### Tryb prywatności

Kliknij ikonę oka na pasku narzędzi, aby włączyć **tryb prywatności** — nazwiska gości będą ukryte na Tape Chart (widoczne dopiero po najechaniu myszką).

---

## 5. Rezerwacje — tworzenie i zarządzanie

### Tworzenie nowej rezerwacji

#### Metoda 1: Z Tape Chart
1. Kliknij i przeciągnij na wolnym polu
2. Wypełnij formularz

#### Metoda 2: Z formularza
1. Kliknij przycisk **+ Nowa rezerwacja** (lub użyj Ctrl+K → "Nowa rezerwacja")
2. Wypełnij formularz:

**Dane podstawowe:**
- **Gość** — wyszukaj istniejącego lub dodaj nowego
- **Pokój** — wybierz z dostępnych (lub użyj auto-przypisania)
- **Data przyjazdu** i **Data wyjazdu**
- **Liczba dorosłych** i **Liczba dzieci**
- **Plan taryfowy** — wybierz cennik

**Dane dodatkowe:**
- **Źródło rezerwacji** — Direct, Booking.com, telefon, email, itp.
- **Segment** — Business, Leisure, Group, itp.
- **Uwagi** — notatki wewnętrzne
- **Życzenia gościa** — specjalne prośby

3. Kliknij **Zapisz**

### Rezerwacja grupowa

1. Kliknij **+ Rezerwacja grupowa**
2. Podaj nazwę grupy i dane organizatora
3. Dodaj pokoje (możesz zaznaczyć wiele na Tape Chart)
4. System stworzy jedną rezerwację grupową z wieloma pokojami

### Walk-in (gość bez rezerwacji)

1. Kliknij **Walk-in** na pasku narzędzi
2. Wybierz dostępny pokój
3. Wypełnij dane gościa
4. System automatycznie zamelduje gościa

### Statusy rezerwacji

| Status | Opis |
|--------|------|
| **Request** | Zapytanie — oczekuje na potwierdzenie |
| **Confirmed** | Potwierdzona — gość przyjedzie |
| **Checked-in** | Zameldowany — gość jest w hotelu |
| **Checked-out** | Wymeldowany — gość wyjechał |
| **Cancelled** | Anulowana |
| **No-show** | Gość nie przyjechał |

### Folio (konto gościa)

Każda rezerwacja ma jedno lub więcej **folio** (kont rozliczeniowych):
- **Folio główne** — opłaty za pokój, podatek lokalny
- **Folio dodatkowe** — np. osobne konto firmowe, konto za usługi

Na folio widoczne są:
- Obciążenia (charges) — pokój, minibar, SPA, restauracja
- Płatności (payments) — gotówka, karta, przelew
- Saldo — kwota do zapłaty

### Potwierdzenie rezerwacji (PDF)

1. Otwórz rezerwację
2. Kliknij **Wydruk potwierdzenia**
3. System wygeneruje PDF z danymi rezerwacji
4. Możesz wysłać go emailem do gościa

### Lista oczekujących (Waitlist)

Gdy hotel jest pełny, możesz dodać gościa na **listę oczekujących**:
1. Kliknij **Dodaj do waitlist**
2. Gdy pokój się zwolni, system powiadomi o możliwości rezerwacji

### Overbooking

System wyświetla ostrzeżenie, gdy liczba rezerwacji przekracza liczbę dostępnych pokojów. Kierownik może zdecydować o akceptacji overbookingu.

---

## 6. Check-in i Check-out

### Check-in (meldowanie)

#### Standardowy check-in

1. Otwórz rezerwację (z Tape Chart lub listy przyjazdów)
2. Kliknij **Check-in**
3. Wypełnij formularz meldunkowy:
   - **Dane osobowe** — imię, nazwisko, data urodzenia
   - **Dokument tożsamości** — typ, numer, data ważności
   - **Adres zamieszkania**
   - **Obywatelstwo**
   - **Cel pobytu**
4. Opcjonalnie: **Skan MRZ** — przyłóż dokument do kamery, system automatycznie odczyta dane z paska MRZ (Machine Readable Zone)
5. Kliknij **Zamelduj**

#### Skan MRZ (Machine Readable Zone)

System posiada wbudowany skaner MRZ oparty na technologii OCR (Tesseract.js):
1. Kliknij ikonę aparatu przy formularzu check-in
2. Przyłóż dokument (dowód osobisty lub paszport) do kamery
3. System automatycznie odczyta:
   - Imię i nazwisko
   - Numer dokumentu
   - Data urodzenia
   - Obywatelstwo
   - Data ważności dokumentu
4. Dane zostaną automatycznie wypełnione w formularzu

#### Web Check-in (samodzielny check-in gościa)

Gość może zameldować się samodzielnie przed przyjazdem:
1. System wysyła email z linkiem do web check-in
2. Gość wypełnia formularz online (dane osobowe, dokument)
3. Recepcja weryfikuje dane i wydaje klucz

### Check-out (wymeldowanie)

1. Otwórz rezerwację zameldowanego gościa
2. Sprawdź **saldo folio** — czy wszystkie opłaty zostały uregulowane
3. Jeśli saldo > 0, przyjmij płatność
4. Kliknij **Check-out**
5. System:
   - Zmieni status rezerwacji na "Checked-out"
   - Zmieni status pokoju na "DIRTY" (do sprzątania)
   - Wygeneruje fakturę/paragon (jeśli skonfigurowano)

### Express Check-out

Dla gości z kartą kredytową:
1. Gość zostawia kartę przy check-in
2. Przy check-out system automatycznie obciąża kartę
3. Faktura wysyłana emailem

---

## 7. Goście i kontrahenci

### Baza gości

System przechowuje profile gości z pełnymi danymi:

- **Dane osobowe** — imię, nazwisko, data urodzenia, obywatelstwo
- **Kontakt** — telefon, email, adres
- **Dokument** — typ, numer, data ważności, dane MRZ
- **Preferencje** — typ pokoju, piętro, poduszka, temperatura
- **Alergie** — informacje o alergiach pokarmowych i innych
- **Status VIP** — poziom VIP (1-5)
- **Historia pobytów** — wszystkie poprzednie rezerwacje
- **Notatki** — uwagi wewnętrzne

### Wyszukiwanie gościa

Możesz wyszukać gościa po:
- Imieniu i nazwisku
- Numerze telefonu
- Adresie email
- Numerze dokumentu

### Firmy (kontrahenci)

- **Nazwa firmy**, NIP, adres
- **Kontrakty korporacyjne** — specjalne ceny dla firm
- **Historia rezerwacji firmowych**
- **Dane do faktury**

### Biura podróży

- **Nazwa biura**, dane kontaktowe
- **Allotmenty** — zarezerwowane pule pokojów
- **Prowizje**

### RODO (GDPR)

System wspiera zgodność z RODO:
- **Zgody** — rejestracja zgód marketingowych
- **Eksport danych** — eksport wszystkich danych gościa
- **Anonimizacja** — usunięcie danych osobowych po upływie okresu retencji
- **Prawo do bycia zapomnianym** — pełne usunięcie profilu

### Czarna lista

Możesz dodać gościa na **czarną listę** — system wyświetli ostrzeżenie przy próbie rezerwacji.

---

## 8. Pokoje

### Zarządzanie pokojami

Sekcja **Pokoje** (`/pokoje`) pozwala zarządzać bazą pokojową:

- **Numer pokoju**
- **Typ pokoju** — Standard, Deluxe, Suite, Apartament, itp.
- **Piętro**
- **Cechy** — balkon, widok, klimatyzacja, sejf, minibar, itp.
- **Udogodnienia** — WiFi, TV, czajnik, itp.
- **Zdjęcia** — galeria zdjęć pokoju
- **Status** — CLEAN, DIRTY, OOO, MAINTENANCE
- **Maksymalna liczba gości**

### Typy pokojów

Każdy typ pokoju definiuje:
- Nazwę (np. "Standard Double")
- Opis
- Bazową cenę
- Maksymalną liczbę gości
- Zdjęcia

### Grupy pokojów (Connected Rooms)

Pokoje mogą być łączone w grupy — np. dwa pokoje sąsiadujące z drzwiami łączącymi, tworzące apartament rodzinny.

### Blokady pokojów (Room Block)

Możesz zablokować pokój na określony czas:
- **OOO (Out of Order)** — pokój niesprawny (awaria, remont)
- **OOS (Out of Service)** — pokój tymczasowo wyłączony
- **Maintenance** — planowana konserwacja

---

## 9. Cennik i plany taryfowe

### Plany taryfowe (Rate Plans)

System obsługuje elastyczne cenniki:

- **Plan bazowy** — główny cennik hotelu
- **Plany sezonowe** — różne ceny w zależności od sezonu
- **Plany korporacyjne** — specjalne ceny dla firm
- **Plany pakietowe** — cena z dodatkowymi usługami (np. śniadanie, SPA)

### Konfiguracja cennika

1. Wejdź w **Cennik** (`/cennik`)
2. Wybierz plan taryfowy
3. Ustaw ceny dla każdego typu pokoju i okresu
4. Możesz ustawić:
   - Cenę za pokój/noc
   - Cenę za osobę/noc
   - Dopłatę za dodatkową osobę
   - Dopłatę za dziecko
   - Minimalny pobyt

### Reguły pochodne (Derived Rate Rules)

Zamiast ręcznie ustawiać ceny dla każdego planu, możesz tworzyć **reguły pochodne**:
- "Plan korporacyjny = Plan bazowy - 15%"
- "Plan last-minute = Plan bazowy - 20 PLN"

### Sezony

Definiuj sezony w ustawieniach:
- **Niski sezon** — np. styczeń-marzec
- **Średni sezon** — np. kwiecień-czerwiec
- **Wysoki sezon** — np. lipiec-sierpień
- **Szczyt** — np. Sylwester, długie weekendy

### Wydruk cennika

Wejdź w **Cennik → Wydruk** (`/cennik/wydruk`), aby wygenerować cennik do wydruku lub PDF.

---

## 10. Housekeeping — Gospodarstwo pokojowe

### Statusy pokojów

| Status | Opis | Kolor |
|--------|------|-------|
| **CLEAN** | Czysty, gotowy dla gościa | Zielony |
| **DIRTY** | Brudny, wymaga sprzątania | Czerwony |
| **INSPECTION** | Posprzątany, czeka na inspekcję | Żółty |
| **INSPECTED** | Sprawdzony, gotowy | Zielony (ciemny) |
| **CHECKOUT_PENDING** | Gość się wymeldowuje | Pomarańczowy |
| **OOO** | Out of Order — niesprawny | Szary |
| **MAINTENANCE** | W trakcie naprawy | Szary |

### Panel Housekeeping

1. Wejdź w **Housekeeping** (`/housekeeping`)
2. Widzisz listę wszystkich pokojów z ich statusami
3. Kliknij pokój, aby zmienić status
4. Możesz filtrować po piętrze, statusie, typie pokoju

### Zmiana statusu pokoju

1. Kliknij pokój na liście
2. Wybierz nowy status (np. DIRTY → CLEAN)
3. Opcjonalnie dodaj notatkę (np. "Wymieniono ręczniki")
4. Zapisz

### Tryb offline

Panel Housekeeping działa **offline** — dane są zapisywane lokalnie (IndexedDB) i synchronizowane po powrocie do sieci. Idealne dla pokojówek z tabletem.

### Minibar

1. Wejdź w **Housekeeping → Minibar** (`/housekeeping/minibar`)
2. Wybierz pokój
3. Zaznacz zużyte produkty i ilości
4. System automatycznie doliczy opłaty do folio gościa

### Pranie (Laundry)

1. Wejdź w **Housekeeping → Pranie** (`/housekeeping/laundry`)
2. Utwórz zlecenie prania
3. Wybierz pokój, rodzaj prania, ilość
4. Opłata zostanie doliczona do folio

### Zgłoszenia usterek (Maintenance)

1. Na panelu Housekeeping kliknij **Zgłoś usterkę**
2. Wybierz pokój, kategorię usterki, opis
3. Zgłoszenie trafia do działu technicznego
4. Po naprawie technik zmienia status na "Naprawione"

---

## 11. Finanse

### Audyt nocny (Night Audit)

**Audyt nocny** to najważniejsza operacja finansowa dnia. Wykonywany jest codziennie po zamknięciu recepcji (zwykle o północy lub nad ranem):

1. Wejdź w **Finanse** (`/finance`)
2. Kliknij **Audyt nocny**
3. System automatycznie:
   - Naliczy opłaty za pokój za bieżący dzień
   - Naliczy podatek lokalny (opłatę klimatyczną)
   - Zamknie dzień finansowy
   - Wygeneruje raport dzienny
4. Sprawdź raport i potwierdź

**WAŻNE:** Audyt nocny można wykonać tylko raz dziennie. Po wykonaniu nie można cofnąć operacji.

### Zmiana kasowa (Cash Shift)

1. Na początku zmiany: **Otwórz zmianę kasową** — podaj stan początkowy kasy
2. W trakcie zmiany: system rejestruje wszystkie operacje gotówkowe
3. Na koniec zmiany: **Zamknij zmianę kasową** — podaj stan końcowy kasy
4. System porówna stan rzeczywisty z oczekiwanym i wykaże różnice

### Blind Drop (odprowadzenie gotówki)

Gdy w kasie jest za dużo gotówki:
1. Kliknij **Blind Drop**
2. Podaj kwotę odprowadzaną do sejfu
3. System zarejestruje operację

### Transakcje

Każda operacja finansowa to **transakcja**:

| Typ | Opis |
|-----|------|
| **Charge** | Obciążenie (opłata za pokój, minibar, SPA) |
| **Payment** | Płatność (gotówka, karta, przelew) |
| **Refund** | Zwrot |
| **Void** | Anulowanie transakcji (wymaga PIN kierownika) |
| **Deposit** | Kaucja/depozyt |

### Metody płatności

- Gotówka (PLN, EUR, USD, GBP)
- Karta płatnicza (terminal)
- Przelew bankowy
- Link płatniczy (online)
- Voucher/bon podarunkowy
- Konto firmowe (faktura z odroczonym terminem)

### Faktury

1. Otwórz folio rezerwacji
2. Kliknij **Wystaw fakturę**
3. Wybierz:
   - **Faktura VAT** — standardowa faktura
   - **Faktura korygująca** — korekta do istniejącej faktury
   - **Proforma** — faktura pro forma (przed płatnością)
4. Podaj dane nabywcy (lub wybierz z bazy firm)
5. System wygeneruje fakturę w PDF

### Paragony

- System może drukować paragony na **drukarce fiskalnej POSNET**
- Konfiguracja w **Ustawienia → Paragon**
- Integracja przez POSNET Bridge (lokalna aplikacja)

### Linki płatnicze

1. Otwórz folio
2. Kliknij **Wyślij link płatniczy**
3. System wygeneruje link do płatności online
4. Link zostanie wysłany emailem do gościa
5. Po opłaceniu system automatycznie zarejestruje płatność

### Preautoryzacja karty

1. Przy check-in: **Preautoryzuj kartę** — zablokuj kwotę na karcie gościa
2. Przy check-out: **Rozlicz preautoryzację** — obciąż kartę faktyczną kwotą
3. Lub **Zwolnij preautoryzację** — odblokuj środki

### Przewalutowanie

System obsługuje operacje w różnych walutach:
- PLN, EUR, USD, GBP
- Automatyczne przeliczanie po aktualnym kursie
- Rejestracja kursu wymiany

---

## 12. Usługi dodatkowe

### SPA

1. Wejdź w **SPA** (`/spa`)
2. Widzisz grafik zasobów SPA (gabinety, terapeuci)
3. **Nowa rezerwacja SPA:**
   - Wybierz zabieg, terapeuta, godzinę
   - Przypisz do gościa hotelowego lub zewnętrznego
   - Opłata zostanie doliczona do folio (gość hotelowy) lub pobrana na miejscu

### Gastronomia

1. Wejdź w **Gastronomia** (`/gastronomy`)
2. Zarządzaj menu restauracji
3. Twórz zamówienia
4. Obciążaj folio gościa za posiłki

### Room Service

1. Wejdź w **Room Service** (`/room-service`)
2. Przyjmij zamówienie od gościa
3. Wybierz pokój i pozycje z menu
4. Opłata zostanie doliczona do folio

### Posiłki (Meal Consumption)

1. Wejdź w **Posiłki** (`/meals`)
2. Rejestruj zużycie posiłków (śniadanie, obiad, kolacja)
3. System śledzi, którzy goście skorzystali z posiłków wliczonych w cenę

### Transfery

1. Wejdź w **Transfery** (`/transfers`)
2. Zarezerwuj transfer (lotnisko, dworzec)
3. Podaj: gość, data, godzina, trasa, pojazd
4. Opłata zostanie doliczona do folio

### Atrakcje

1. Wejdź w **Atrakcje** (`/attractions`)
2. Przeglądaj dostępne atrakcje
3. Zarezerwuj dla gościa
4. Opłata zostanie doliczona do folio

### Wypożyczalnia

1. Wejdź w **Wypożyczalnia** (`/rentals`)
2. Wypożycz sprzęt (rowery, kajaki, itp.)
3. Rejestruj wydanie i zwrot
4. Opłata zostanie doliczona do folio

### Parking

1. Wejdź w **Parking** (`/parking`)
2. Przypisz miejsce parkingowe do gościa
3. Rejestruj wjazd i wyjazd
4. Opłata zostanie doliczona do folio

### Camping

1. Wejdź w **Camping** (`/camping`)
2. Zarządzaj miejscami kempingowymi
3. Rezerwuj miejsca dla gości

---

## 13. MICE — Konferencje i eventy

### Czym jest MICE?

MICE = Meetings, Incentives, Conferences, Events — moduł do zarządzania wydarzeniami grupowymi.

### Funkcje

1. **Eventy** (`/mice/eventy`) — tworzenie i zarządzanie wydarzeniami
2. **Kosztorysy** (`/mice/kosztorysy`) — wyceny dla klientów grupowych
3. **Zlecenia** (`/mice/zlecenia`) — zlecenia realizacji
4. **Grafik** (`/mice/grafik`) — kalendarz sal konferencyjnych

### Tworzenie eventu

1. Kliknij **+ Nowy event**
2. Podaj:
   - Nazwa wydarzenia
   - Organizator (firma/osoba)
   - Daty
   - Liczba uczestników
   - Sale konferencyjne
   - Wymagania techniczne (projektor, nagłośnienie, itp.)
   - Catering
3. Wygeneruj kosztorys
4. Po akceptacji — utwórz zlecenie

---

## 14. Raporty

### Dostępne raporty

System oferuje bogaty zestaw raportów:

#### Raporty operacyjne
- **Raport dzienny (Management Report)** — podsumowanie dnia
- **Lista przyjazdów/wyjazdów** — kto przyjeżdża/wyjeżdża dziś
- **Goście in-house** — kto aktualnie przebywa w hotelu
- **Raport no-show** — goście, którzy nie przyjechali
- **Raport anulacji** — anulowane rezerwacje

#### Raporty finansowe
- **Raport KPI** — Occupancy, ADR, RevPAR
- **Raport przychodów** — przychody wg kategorii
- **Przychody wg segmentu** — Business, Leisure, Group
- **Przychody wg typu pokoju**
- **Przychody wg źródła rezerwacji**
- **Przychody wg kanału**
- **Raport zmiany kasowej**
- **Uzgodnienie bankowe**

#### Raporty statystyczne
- **Raport obłożenia** — procent zajętości
- **Prognoza obłożenia** — przewidywane obłożenie
- **Porównanie rok do roku (YoY)**
- **Porównanie miesiąc do miesiąca (MoM)**

#### Raporty dla gości
- **Goście VIP** — lista gości VIP
- **Urodziny** — goście obchodzący urodziny
- **Obciążenie Housekeeping** — ile pokojów do sprzątania

#### Raporty urzędowe (Polska)
- **Raport GUS** — statystyki dla Głównego Urzędu Statystycznego
- **Raport policyjny** — dane meldunkowe dla policji
- **JPK-VAT** — Jednolity Plik Kontrolny (VAT)
- **JPK-FA** — Jednolity Plik Kontrolny (Faktury)

#### Raporty bezpieczeństwa
- **Audit Trail** — ślad audytowy (kto co zmienił)
- **Logi logowań** — historia logowań użytkowników
- **Akcje użytkowników** — szczegółowy log operacji

### Eksport raportów

Raporty można eksportować do:
- **PDF** — do wydruku
- **Excel (XLSX)** — do dalszej analizy
- **Email** — automatyczna wysyłka zaplanowanych raportów

### Zaplanowane raporty

Możesz ustawić automatyczną wysyłkę raportów:
1. Wejdź w **Raporty → Zaplanowane**
2. Wybierz raport, częstotliwość (dziennie/tygodniowo/miesięcznie)
3. Podaj adresy email odbiorców

---

## 15. Channel Manager

### Czym jest Channel Manager?

Channel Manager synchronizuje dostępność i ceny z zewnętrznymi portalami rezerwacyjnymi:
- **Booking.com**
- **Expedia**
- Inne kanały OTA (Online Travel Agency)

### Konfiguracja

1. Wejdź w **Channel Manager** (`/channel-manager`)
2. Skonfiguruj połączenie z kanałami
3. Zmapuj typy pokojów i plany taryfowe
4. Włącz synchronizację

### Jak to działa?

- **Dostępność** — gdy rezerwacja jest tworzona/anulowana w PMS, system automatycznie aktualizuje dostępność na portalach
- **Ceny** — zmiany cen w PMS są automatycznie wysyłane do kanałów
- **Rezerwacje** — rezerwacje z portali są automatycznie importowane do PMS

---

## 16. Aplikacja gościa i Web Check-in

### Aplikacja gościa (Guest App)

Każdy gość otrzymuje **link do portalu gościa** (token-based):
- Podgląd rezerwacji
- Informacje o hotelu
- Zamawianie usług
- Cyfrowy klucz (jeśli skonfigurowano)

### Web Check-in

1. System wysyła email z linkiem do web check-in
2. Gość wypełnia formularz online:
   - Dane osobowe
   - Skan dokumentu
   - Preferencje pokoju
   - Godzina przyjazdu
3. Recepcja weryfikuje dane
4. Przy przyjeździe gość odbiera tylko klucz

### Link płatniczy

Gość może opłacić rezerwację online:
1. System generuje link płatniczy
2. Link wysyłany emailem/SMS
3. Gość płaci kartą online
4. System automatycznie rejestruje płatność

---

## 17. Ustawienia systemu

### Dane hotelu

**Ustawienia → Dane hotelu** (`/ustawienia/dane-hotelu`):
- Nazwa hotelu, adres, NIP
- Logo
- Dane kontaktowe
- Numer konta bankowego

### Użytkownicy

**Ustawienia → Użytkownicy** (`/ustawienia/uzytkownicy`):
- Dodawanie/edycja użytkowników
- Przypisywanie ról (Recepcjonista, Kierownik, Admin, Housekeeping)
- Resetowanie haseł
- Włączanie/wyłączanie 2FA

### Uprawnienia (Role-based)

System posiada **role z uprawnieniami**:

| Rola | Opis |
|------|------|
| **Admin** | Pełny dostęp do wszystkiego |
| **Kierownik** | Finanse, raporty, zarządzanie |
| **Recepcjonista** | Rezerwacje, check-in/out, płatności |
| **Housekeeping** | Statusy pokojów, sprzątanie |
| **Księgowość** | Faktury, raporty finansowe |
| **Tylko odczyt** | Podgląd bez możliwości edycji |

### Szablony dokumentów

**Ustawienia → Szablony** (`/ustawienia/szablony`):
- Szablony faktur
- Szablony potwierdzeń rezerwacji
- Szablony kart meldunkowych

### Szablony email

**Ustawienia → Szablony email** (`/ustawienia/szablony-email`):
- Potwierdzenie rezerwacji
- Przypomnienie o przyjeździe
- Podziękowanie po pobycie
- Link do web check-in
- Link płatniczy

### Numeracja dokumentów

**Ustawienia → Numeracja** (`/ustawienia/numeracja`):
- Format numeracji faktur (np. FV/2026/02/001)
- Format numeracji paragonów
- Automatyczna numeracja

### Sezony

**Ustawienia → Sezony** (`/ustawienia/sezony`):
- Definiowanie okresów sezonowych
- Przypisywanie dat do sezonów

### Piętra

**Ustawienia → Piętra** (`/ustawienia/pietra`):
- Definiowanie pięter budynku
- Przypisywanie pokojów do pięter

### Słowniki

**Ustawienia → Słowniki** (`/ustawienia/slowniki`):
- Źródła rezerwacji
- Segmenty rynku
- Typy dokumentów
- Kategorie usterek
- I inne listy wyboru

### Polityka anulacji

**Ustawienia → Polityka anulacji** (`/ustawienia/polityka-anulacji`):
- Definiowanie zasad anulacji
- Opłaty za anulację
- Terminy bezpłatnej anulacji

### KSeF (Krajowy System e-Faktur)

**Ustawienia → KSeF** (`/ustawienia/ksef`):
- Konfiguracja połączenia z KSeF
- Automatyczne wysyłanie faktur do KSeF
- Pobieranie UPO (Urzędowe Poświadczenie Odbioru)

### SMS

**Ustawienia → SMS** (`/ustawienia/sms`):
- Konfiguracja bramki SMS (Twilio)
- Szablony wiadomości SMS
- Automatyczne przypomnienia

### Import danych

**Ustawienia → Import** (`/ustawienia/import`):
- Import gości z pliku CSV/Excel
- Import rezerwacji
- Import cenników

---

## 18. Skróty klawiaturowe

| Skrót | Akcja |
|-------|-------|
| **Ctrl+K** | Paleta komend (szybkie wyszukiwanie) |
| **Ctrl+Z** | Cofnij (na Tape Chart) |
| **Ctrl+Y** | Ponów (na Tape Chart) |
| **Ctrl+N** | Nowa rezerwacja |
| **Esc** | Zamknij okno/panel |
| **←/→** | Nawigacja po datach (Tape Chart) |
| **+/-** | Zoom (Tape Chart) |

---

## 19. Najczęstsze pytania (FAQ)

### Jak zmienić pokój gościowi?

1. Na Tape Chart chwyć pasek rezerwacji i przeciągnij na inny pokój
2. Lub: otwórz rezerwację → Edytuj → zmień pokój → Zapisz

### Jak anulować rezerwację?

1. Otwórz rezerwację
2. Kliknij **Anuluj rezerwację**
3. Podaj powód anulacji
4. System naliczy opłatę za anulację (jeśli dotyczy)

### Jak wystawić fakturę?

1. Otwórz folio rezerwacji
2. Kliknij **Wystaw fakturę**
3. Wybierz typ faktury i dane nabywcy
4. Pobierz PDF

### Jak dodać opłatę do folio gościa?

1. Otwórz folio rezerwacji
2. Kliknij **+ Dodaj obciążenie**
3. Wybierz kategorię (minibar, SPA, restauracja, itp.)
4. Podaj kwotę i opis
5. Zapisz

### Jak wykonać audyt nocny?

1. Wejdź w **Finanse**
2. Kliknij **Audyt nocny**
3. Sprawdź podsumowanie
4. Potwierdź wykonanie

### Jak zmienić status pokoju?

1. Wejdź w **Housekeeping**
2. Znajdź pokój na liście
3. Kliknij i wybierz nowy status
4. Zapisz

### Co zrobić gdy system nie działa?

1. Odśwież stronę (F5)
2. Wyczyść cache przeglądarki (Ctrl+Shift+Delete)
3. Spróbuj innej przeglądarki
4. Skontaktuj się z administratorem

### Jak dodać nowego użytkownika?

1. Wejdź w **Ustawienia → Użytkownicy**
2. Kliknij **+ Nowy użytkownik**
3. Podaj dane: login, hasło, imię, rola
4. Zapisz

---

## 20. Słownik pojęć

| Pojęcie | Definicja |
|---------|-----------|
| **PMS** | Property Management System — system zarządzania hotelem |
| **Tape Chart** | Grafik rezerwacji w formie wykresu Gantta |
| **Folio** | Konto rozliczeniowe gościa (lista obciążeń i płatności) |
| **ADR** | Average Daily Rate — średnia cena za pokój/noc |
| **RevPAR** | Revenue Per Available Room — przychód na dostępny pokój |
| **Occupancy** | Obłożenie — procent zajętych pokojów |
| **OOO** | Out of Order — pokój wyłączony z użytku (awaria) |
| **OOS** | Out of Service — pokój tymczasowo niedostępny |
| **Walk-in** | Gość bez rezerwacji, meldujący się na miejscu |
| **No-show** | Gość z rezerwacją, który nie przyjechał |
| **Night Audit** | Audyt nocny — zamknięcie dnia finansowego |
| **Blind Drop** | Odprowadzenie nadwyżki gotówki do sejfu |
| **Cash Shift** | Zmiana kasowa — okres pracy kasjera |
| **Preautoryzacja** | Blokada środków na karcie płatniczej |
| **MRZ** | Machine Readable Zone — strefa do odczytu maszynowego na dokumencie |
| **KSeF** | Krajowy System e-Faktur |
| **JPK** | Jednolity Plik Kontrolny |
| **GUS** | Główny Urząd Statystyczny |
| **MICE** | Meetings, Incentives, Conferences, Events |
| **OTA** | Online Travel Agency (np. Booking.com, Expedia) |
| **Channel Manager** | System synchronizujący dostępność z portalami OTA |
| **Allotment** | Pula pokojów zarezerwowana dla biura podróży |
| **VIP** | Very Important Person — gość o specjalnym statusie |
| **RODO/GDPR** | Rozporządzenie o ochronie danych osobowych |
| **2FA** | Two-Factor Authentication — uwierzytelnianie dwuskładnikowe |

---

## Informacje techniczne (dla administratorów)

### Stack technologiczny

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS, Shadcn/UI
- **Backend:** Next.js Server Actions, Prisma ORM
- **Baza danych:** MySQL 8 (MariaDB)
- **Hosting:** MyDevil (FreeBSD 14), Phusion Passenger
- **Integracje:** POSNET Bridge, Symplex Bridge, KSeF, Twilio SMS

### Baza danych

System wykorzystuje ponad 80 tabel w bazie MySQL, obejmujących:
- Pokoje i typy pokojów
- Rezerwacje i grupy rezerwacji
- Goście, firmy, biura podróży
- Transakcje, faktury, paragony
- Housekeeping, minibar, pranie
- SPA, gastronomia, usługi
- Raporty, logi, audyt
- Konfiguracja, szablony, uprawnienia

### Bezpieczeństwo

- Hasła hashowane (bcryptjs)
- Sesje JWT
- Opcjonalne 2FA (TOTP)
- Audit trail — każda zmiana jest logowana
- Role-based access control (RBAC)
- HTTPS (SSL)

---

*Dokument wygenerowany automatycznie na podstawie analizy kodu źródłowego systemu.*
*Wersja systemu: Hotel PMS v1.0 | Luty 2026*
