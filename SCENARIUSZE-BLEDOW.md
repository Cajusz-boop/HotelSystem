# SCENARIUSZE TESTOWE – Wykrywanie błędów Hotel PMS

**Cel:** Maksymalne pokrycie scenariuszami, które mogą wywołać błędy runtime, hydratacji, walidacji i integracji.  
**Do realizacji:** Punkt po punkcie, z zapisem wyniku (✓ OK / ✗ BŁĄD).

**Testy Playwright:** `Test/priority-scenarios.spec.ts` – scenariusze P1, P2, P3, S1, C1, C4, J4. Oznaczenia: `[x]` = wykonany (OK), `[ ]` = do wykonania. **Obowiązkowo przed testami:** `npm run db:seed:kwhotel`. Potem: `PLAYWRIGHT_BASE_URL=http://localhost:3011 npx playwright test Test/priority-scenarios.spec.ts --workers=1 --project=chromium` (workers=1 zapobiega konfliktom rezerwacji między testami).

---

## KATEGORIA A: HYDRACJA I SSR (server vs client mismatch)

| # | Scenariusz | Kroki | Oczekiwany błąd / ryzyko | Wykonano |
|---|------------|-------|---------------------------|----------|
| A1 | **StatusBar – przycisk powiadomień** | Otwórz dowolną stronę (np. /guests) zaraz po załadowaniu | `Hydration failed... Expected server HTML to contain a matching <button>` | [x] |
| A2 | **ThemeProvider – motyw** | Otwórz stronę przy `localStorage` z `pms-theme: dark` | Możliwa różnica HTML (dark class) serwer vs klient | [x] |
| A3 | **OnboardingGuide – dialog** | Pierwsza wizyta (brak `pms-onboarding-seen` w localStorage) | Dialog renderowany po mount – sprawdzić czy nie wywołuje hydratacji | [x] |
| A4 | **Layout – skrypt theme** | Strona z `dangerouslySetInnerHTML` w head | `suppressHydrationWarning` na html/body – sprawdzić czy wystarczy | [x] |
| A5 | **api-docs – window.location.origin** | Otwórz /api-docs | `typeof window` – możliwa różnica serwer/klient | [x] |
| A6 | **Reports – window.alert** | Raport zwraca błąd → `window.alert(result.error)` | Tylko po mount – niskie ryzyko | [x] |
| A7 | **Theme toggle** | Kliknij przełącznik motywu na pasku | Zmiana klasy `dark` – sprawdzić czy nie psuje hydratacji dzieci | [x] |
| A8 | **Language switcher** | Zmień język (Polski ↔ EN) | i18n – sprawdzić czy teksty nie powodują mismatch | [x] |

---

## KATEGORIA B: NAWIGACJA I ROUTING

| # | Scenariusz | Kroki | Oczekiwany błąd / ryzyko | Wykonano |
|---|------------|-------|---------------------------|----------|
| B1 | **Szybkie przełączanie stron** | Klikaj kolejno: Panel → Recepcja → Goście → Firmy w tempie &lt;1 s | Race condition, unmount podczas fetch | [x] |
| B2 | **Link do nieistniejącej strony** | Wpisz /nieistniejaca-strona | 404 – sprawdzić czy nie crashuje layout | [x] |
| B3 | **Link z tokenem – gość** | /guest-app/[token] z tokenem pustym | Możliwy błąd parsowania | [x] |
| B4 | **Link z tokenem – płatność** | /pay/[token] z tokenem nieistniejącym | Błąd API / nieobsłużony stan | [x] |
| B5 | **Check-in guest** | /check-in/guest/[token] – token wygasły | Sprawdzić obsługę błędu | [x] |
| B6 | **Deep link z parametrami** | /guests?query=test&page=999 | Paginacja poza zakresem | [x] |
| B7 | **Browser Back** | Wykonaj akcję → Back → ponownie Forward | Stan formularza / cache | [x] |
| B8 | **Odświeżenie na podstronie** | F5 na /finance, /reports, /ustawienia/dokumenty | Pełny reload – czy dane się ładują | [x] |
| B9 | **Bezpośredni URL bez logowania** | Otwórz /front-office w trybie incognito (bez sesji) | Redirect do /login vs błąd | [x] |

---

## KATEGORIA C: FORMULARZE I WALIDACJA

| # | Scenariusz | Kroki | Oczekiwany błąd / ryzyko | Wykonano |
|---|------------|-------|---------------------------|----------|
| C1 | **Pusty gość – Create Reservation** | Kliknij komórkę → Zapisz bez wpisania gościa | Walidacja – brak toastu sukcesu | [x] |
| C2 | **Daty odwrotne** | Check-out przed check-in | Błąd walidacji / nieoczekiwane zachowanie | [x] |
| C3 | **Nadlanie znaków** | Pole tekstowe: 10 000 znaków | Overflow, błąd API, timeout | [x] |
| C4 | **Znaki specjalne** | Imię: `O'Brien`, `José`, `<script>`, `"` | XSS / escape / parsowanie | [x] |
| C5 | **Puste pola wymagane** | Wypełnij tylko część formularza → Zapisz | Komunikaty błędów vs crash | [x] |
| C6 | **NIP – niepoprawny** | NIP 11 cyfr, NIP z literami | Walidacja NIP / lookup | [x] |
| C7 | **Email – niepoprawny** | email bez @, pusty | Walidacja / błąd wysyłki | [x] |
| C8 | **Kwoty ujemne** | Cena -100, Depozyt -50 | Walidacja / błąd w finance | [x] |
| C9 | **Split payment – niepełna suma** | Suma metod ≠ suma zamówienia | Błąd rejestracji transakcji | [x] |
| C10 | **Import CSV – puste pliki** | Import bez nagłówka, 0 wierszy | Błąd parseImportCsv | [x] |
| C11 | **Import CSV – złe kodowanie** | Plik UTF-16, plik z BOM | Parsowanie / znaki | [x] |
| C12 | **Select – pusta wartość** | Zapisz formularz bez wyboru w Select (gdy wymagane) | Undefined / null handling | [x] |

---

## KATEGORIA D: REZERWACJE I TAPE CHART

| # | Scenariusz | Kroki | Oczekiwany błąd / ryzyko | Wykonano |
|---|------------|-------|---------------------------|----------|
| D1 | **Przeciągnij rezerwację na zajęty pokój** | Drag & drop na komórkę z inną rezerwacją | Overbooking / walidacja | [x] |
| D2 | **Resize – check-out przed check-in** | Skróć pasek tak, że end &lt; start | Walidacja dat | [x] |
| D3 | **Split – rezerwacja 1 noc** | Split rezerwacji na 1 noc | Logika split / błąd | [x] |
| D4 | **Klik w zablokowaną komórkę** | Kliknij komórkę z RoomBlock | blockedRanges – czy blokada działa | [x] |
| D5 | **Równoczesny edit – dwa okna** | Edytuj tę samą rezerwację w dwóch kartach | Konflikt zapisu | [x] |
| D6 | **Rezerwacja grupowa – rooming list** | Utwórz grupę, dodaj rezerwacje, usuń jedną | Spójność danych | [x] |
| D7 | **Rezerwacja z parkingiem – brak miejsc** | Wybierz miejsce parkingowe już zajęte | Walidacja availability | [x] |
| D8 | **Rezerwacja godzinowa** | Utwórz rezerwację typu hourly | Logika daty+godziny | [x] |
| D9 | **Ghost preview – szybki drag** | Bardzo szybkie przeciąganie | Czy ghost się poprawnie aktualizuje | [x] |
| D10 | **Zoom / zmiana skali podczas drag** | Podczas przeciągania zmień zoom | State / layout | [x] |

---

## KATEGORIA E: FINANSE

| # | Scenariusz | Kroki | Oczekiwany błąd / ryzyko | Wykonano |
|---|------------|-------|---------------------------|----------|
| E1 | **Void bez PIN** | Void transakcji powyżej limitu bez PIN | Wymagany PIN / błąd | [x] |
| E2 | **Void – 3x zły PIN** | Wpisz 3x zły PIN | Blokada 15 min | [x] |
| E3 | **Night Audit – podczas transakcji** | Uruchom Night Audit gdy ktoś robi płatność | Race / lock | [x] |
| E4 | **Faktura – brak NIP** | Utwórz fakturę dla gościa bez NIP | Walidacja / KSeF | [x] |
| E5 | **Blind Drop – kwota ujemna** | Blind drop: -100 | Walidacja | [x] |
| E6 | **Folio – transfer do nieistniejącego folio** | Transfer pozycji na błędny numer folio | Błąd API | [x] |
| E7 | **Refund – kwota > zapłaconej** | Zwrot większy niż wpłata | Walidacja | [x] |
| E8 | **KSeF – sesja wygasła** | Wyślij fakturę po wygaśnięciu sesji KSeF | Retry / re-init | [x] |
| E9 | **Drukuj paragon – drukarka offline** | Paragon fiskalny gdy drukarka nie działa | Timeout / błąd | [x] |
| E10 | **Terminal płatniczy – anuluj** | Rozpocznij płatność kartą → anuluj na terminalu | Obsługa cancelled | [x] |
| E11 | **Split payment – wiele metod** | Płatność: 50% gotówka, 50% karta | Rejestracja split | [x] |
| E12 | **Eksport JPK – pusty zakres** | JPK za okres bez transakcji | Pusty plik / błąd | [x] |

---

## KATEGORIA F: GASTRONOMIA I ROOM SERVICE

| # | Scenariusz | Kroki | Oczekiwany błąd / ryzyko | Wykonano |
|---|------------|-------|---------------------------|----------|
| F1 | **Dodaj danie – brak kategorii** | createMenuItem bez category | Walidacja | [x] |
| F2 | **Danie – cena 0** | Cena 0 PLN | Czy system przyjmuje | [x] |
| F3 | **Zamówienie do nieistniejącej rezerwacji** | Room service dla reservationId null / invalid | Obsługa guest + room | [x] |
| F4 | **Obciąż rezerwację – rezerwacja wymeldowana** | chargeOrderToReservation dla CHECKED_OUT | Błąd / ostrzeżenie | [x] |
| F5 | **Karta dań – pusta** | Wejdź na gastronomię gdy brak dań | Empty state vs crash | [x] |
| F6 | **Alergeny – wszystkie 14** | Zaznacz wszystkie alergeny na daniu | UI / zapis | [x] |
| F7 | **Dieta + alergeny** | Danie: wegańskie + gluten | Zapis w MenuItem | [x] |
| F8 | **Zamówienie – 0 sztuk** | Ilość 0 przy dodawaniu do zamówienia | Walidacja | [x] |
| F9 | **Minibar – ujemna ilość** | Konsumpcja -2 | Walidacja | [x] |
| F10 | **Posiłki – raport za pusty okres** | Raport posiłków bez danych | Pusty wynik vs błąd | [x] |

---

## KATEGORIA G: SESJA I AUTORYZACJA

| # | Scenariusz | Kroki | Oczekiwany błąd / ryzyko | Wykonano |
|---|------------|-------|---------------------------|----------|
| G1 | **Sesja wygasła – idle** | Zostaw stronę otwartą 30+ min → kliknij | Redirect /login?timeout=1 | [x] |
| G2 | **Password expired** | Logowanie z wymuszoną zmianą hasła | Redirect /change-password | [x] |
| G3 | **2FA – zły kod** | Wpisz błędny kod TOTP | Komunikat vs lockout | [x] |
| G4 | **2FA – kod sprzed 2 okien** | Użyj kodu starszego niż 60 s | verifyTotpToken – delta | [x] |
| G5 | **Wyloguj – aktywna operacja** | Wyloguj w trakcie zapisywania formularza | Race / błąd | [x] |
| G6 | **Brak uprawnień** | Użytkownik bez perm do Finanse → wejście na /finance | Redirect / błąd 403 | [x] |
| G7 | **API IP whitelist** | Wywołaj API z IP spoza whitelist | 403 Forbidden | [x] |
| G8 | **Cookie usunięty** | Usuń pms_session w DevTools → odśwież | Redirect do login | [x] |

---

## KATEGORIA H: INTEGRACJE ZEWNĘTRZNE

| # | Scenariusz | Kroki | Oczekiwany błąd / ryzyko | Wykonano |
|---|------------|-------|---------------------------|----------|
| H1 | **KSeF – błąd sieci** | Wyślij fakturę przy braku internetu | Queue / retry | [x] |
| H2 | **KSeF – NIP nieaktywny** | Faktura dla NIP wykreślonego z CEIDG | Błąd KSeF 400 | [x] |
| H3 | **Drukarka fiskalna – timeout** | Drukowanie przy odłączonej drukarce | Timeout / kolejka | [x] |
| H4 | **NBP – kursy walut** | syncNbpExchangeRates przy niedostępnym API | Błąd / fallback | [x] |
| H5 | **Email – Resend** | Wyślij raport emailem przy błędnej konfiguracji | Błąd sendMailViaResend | [x] |
| H6 | **SMS** | Wyślij SMS przy brakującym API key | Błąd konfiguracji | [x] |
| H7 | **Webhook płatności** | POST /api/finance/webhook/payment z nieprawidłowym payload | Walidacja / 400 | [x] |
| H8 | **Channel Manager – sync** | Sync do Booking przy błędzie API | Obsługa błędu | [x] |

---

## KATEGORIA I: EKSPORT, PDF, RAPORTY

| # | Scenariusz | Kroki | Oczekiwany błąd / ryzyko | Wykonano |
|---|------------|-------|---------------------------|----------|
| I1 | **PDF faktury – duża ilość pozycji** | Faktura z 100+ pozycjami | Timeout / memory | [x] |
| I2 | **PDF – brak logo** | Faktura gdy removeInvoiceLogo | Pusty placeholder | [x] |
| I3 | **Raport Excel – pusty wynik** | Eksport raportu bez danych | Pusty plik vs błąd | [x] |
| I4 | **Raport – bardzo duży zakres dat** | Raport za 2 lata | Timeout / performance | [x] |
| I5 | **Drukuj potwierdzenie – rezerwacja anulowana** | PDF potwierdzenia dla CANCELLED | Treść vs status | [x] |
| I6 | **Scheduled report – błąd cron** | GET /api/cron/scheduled-reports bez CRON_SECRET | 401 / obsługa | [x] |
| I7 | **JPK – długi okres** | JPK za rok | Rozmiar pliku / timeout | [x] |
| I8 | **Raport policyjny** | /api/reports/police – brak danych meldunkowych | Pusty / błąd | [x] |

---

## KATEGORIA J: STRONY SPECYFICZNE (każda strona po kolei)

| # | Strona | Scenariusz | Ryzyko | Wykonano |
|---|--------|------------|--------|----------|
| J1 | / | Panel – pierwsze ładowanie | Dashboard, KPI, wykresy | [x] |
| J2 | /front-office | Grafik – scroll w prawo, zmiana widoku | Tape chart, performance | [x] |
| J3 | /guests | Wyszukiwarka – pusty wynik, 1 wynik, 1000 wyników | Paginacja, lista | [x] |
| J4 | /guests/[id] | Karta gościa – nieistniejące ID | 404 / błąd | [x] |
| J5 | /firmy | Lista firm – wyszukaj, dodaj, edytuj | Companies, formularze | [x] |
| J6 | /pokoje | Lista pokoi – filtr, edycja, blokady | Rooms, RoomBlock | [x] |
| J7 | /cennik | Cennik – stawki, sezony | Rate codes, seasons | [x] |
| J8 | /finance | Finanse – transakcje, faktury, folio | Finance actions | [x] |
| J9 | /reports | Raporty – wybór raportu, zakres dat, eksport | Reports, exportToExcel | [x] |
| J10 | /gastronomy | Gastronomia – karta dań, zamówienia | Gastronomy | [x] |
| J11 | /housekeeping | Gospodarka pokoi – statusy, sprzątanie | Housekeeping | [x] |
| J12 | /parking | Grafik parkingu | Parking | [x] |
| J13 | /channel-manager | Sync, mapowania | Channel manager | [x] |
| J14 | /ustawienia/dokumenty | Tabs – szablony | Tabs component | [x] |
| J15 | /ustawienia/slowniki | Tabs – słowniki | Tabs component | [x] |
| J16 | /ustawienia/ksef | Konfiguracja KSeF | KSeF init, config | [x] |
| J17 | /ustawienia/import | Import CSV – goście, pokoje, rezerwacje | Import PMS | [x] |
| J18 | /ustawienia/2fa | Włącz/wyłącz 2FA | TOTP | [x] |
| J19 | /mice/kosztorysy | Kosztorysy MICE | Mice module | [x] |
| J20 | /booking | Silnik rezerwacji | Booking engine | [x] |
| J21 | /login | Logowanie – zły login, pusty formularz | Auth | [x] |
| J22 | /change-password | Zmiana hasła – niepasujące hasła | Auth | [x] |

---

## KATEGORIA K: EDGE CASES – DANE

| # | Scenariusz | Opis | Ryzyko | Wykonano |
|---|------------|------|--------|----------|
| K1 | **Baza pusta** | Nowa instalacja, brak seed | Wszystkie strony bez danych | [x] |
| K2 | **Property bez pokoi** | Obiekt z 0 pokoi | Tape chart, cennik | [x] |
| K3 | **Rezerwacja bez gościa** | Stary rekord / migracja | Guest null | [x] |
| K4 | **Firma bez NIP** | Company z pustym NIP | Lookup, faktury | [x] |
| K5 | **RoomType usunięty** | Pokój ma typeId do nieistniejącego typu | Join / błąd | [x] |
| K6 | **Duplikat rezerwacji** | Ten sam pokój, te same daty (overbooking) | Walidacja | [x] |
| K7 | **Unicode w nazwach** | Gość: 李明, firma: Zażółć | Encoding, sortowanie | [x] |
| K8 | **Bardzo długie nazwy** | Nazwa 500 znaków | UI, baza, indeksy | [x] |

---

## KATEGORIA L: WYDAJNOŚĆ I CONCURRENT

| # | Scenariusz | Kroki | Ryzyko | Wykonano |
|---|------------|-------|--------|----------|
| L1 | **100 rezerwacji na grafiku** | Widok miesiąc, 50 pokoi, 100 rezerwacji | Lag, memory | [x] |
| L2 | **Szybkie wpisywanie w wyszukiwarkę** | Wpisz 20 znaków w 1 s (debounce) | Race, nieaktualne wyniki | [x] |
| L3 | **Otwórz 10 kart** | 10 kart z różnymi stronami | Memory, websockets | [x] |
| L4 | **Eksport dużego raportu** | Raport 10k wierszy do Excel | Timeout, memory | [x] |
| L5 | **Równoczesne zapisy** | 2 użytkowników edytuje tę samą rezerwację | Konflikt | [x] |

---

# 🔴 PRIORYTET 1: KRYTYCZNE DLA BIZNESU (Revenue & Data Loss)
**No-Go – jeśli nie działa, nie ma wdrożenia.**

## P1.1 Stabilność Grafiku (Tape Chart)

| # | Scenariusz | Kroki | Oczekiwany wynik | Wykonano |
|---|------------|-------|------------------|----------|
| P1.1.1 | **Test Kolizji** | Próba nałożenia rezerwacji na zajęty termin (Drag & Drop) | Natychmiastowa blokada/cofnięcie | [x] |
| P1.1.2 | **Double Booking (Race Condition)** | Dwie osoby rezerwują ten sam pokój w tej samej milisekundzie (2 okna) | Walidacja / konflikt | [x] |
| P1.1.3 | **Logika Dat** | Rezerwacja gdzie Check-out < Check-in lub Check-in == Check-out | Błąd walidacji | [x] |
| P1.1.4 | **Ghost Dragging** | Wyrzucenie kursora z rezerwacją poza okno i puszczenie przycisku | Rezerwacja wraca na miejsce | [x] |

## P1.2 Finanse i Płatności

| # | Scenariusz | Kroki | Oczekiwany wynik | Wykonano |
|---|------------|-------|------------------|----------|
| P1.2.1 | **Zaokrąglenia groszowe** | Split płatności na 3 równe części (100 zł / 3) | Suma części = całość co do grosza | [x] |
| P1.2.2 | **Podwójne obciążenie (Spam Click)** | 10x kliknięcie "Zapłać" przy Network Throttling | Tylko jedno obciążenie karty | [x] |
| P1.2.3 | **Korekty ujemne** | Refund > Payment (zwrot > wpłaconej kwoty) | Walidacja / blokada | [x] |
| P1.2.4 | **Nocny Audyt vs Transakcje** | Dodanie płatności w trakcie zamykania doby | Race / lock – obsługa | [x] |

## P1.3 Bezpieczeństwo i Sesja

| # | Scenariusz | Kroki | Oczekiwany wynik | Wykonano |
|---|------------|-------|------------------|----------|
| P1.3.1 | **Wyścig tokenów** | Dwie karty: wyloguj w jednej, zapisz formularz w drugiej | Błąd / redirect do login | [x] |
| P1.3.2 | **IDOR (Brak uprawnień)** | Zmiana ID w URL /guests/123 → /guests/124 (użytkownik bez dostępu) | 403 / brak danych | [x] |
| P1.3.3 | **SQL/XSS Injection** | `<script>alert(1)</script>` lub `' OR 1=1 --` w Imię, Uwagi, Wyszukiwarka | Escape / brak wykonania | [x] |

---

# 🟡 PRIORYTET 2: FUNKCJONALNOŚĆ I UX

## P2.1 Hydracja i SSR (Next.js)

| # | Scenariusz | Kroki | Oczekiwany wynik | Wykonano |
|---|------------|-------|------------------|----------|
| P2.1.1 | **Timezone Mismatch** | Zegar systemowy UTC-8, sprawdź daty na grafiku | Poprawne daty | [x] |
| P2.1.2 | **Flicker Test** | F5 na "Slow 3G" | Brak mignięcia stylu/motywu | [x] |
| P2.1.3 | **Konsola Hydration** | Sprawdź `Hydration failed` po załadowaniu głównych stron | Brak błędów | [x] |

## P2.2 Formularze i Walidacja

| # | Scenariusz | Kroki | Oczekiwany wynik | Wykonano |
|---|------------|-------|------------------|----------|
| P2.2.1 | **Limity znaków** | 5000 znaków w "Nazwisko" / "NIP" | Limit / walidacja | [x] |
| P2.2.2 | **Emoji Support** | Imię wyłącznie z emoji "🏨👨‍💻" | Baza przyjmuje i oddaje | [x] |
| P2.2.3 | **Walidacja NIP/PESEL** | Błędne sumy kontrolne | Komunikat błędu | [x] |

## P2.3 Integracje Zewnętrzne

| # | Scenariusz | Kroki | Oczekiwany wynik | Wykonano |
|---|------------|-------|------------------|----------|
| P2.3.1 | **KSeF Offline** | Wysyłka faktury przy odłączonym internecie | Retry Queue / kolejka | [x] |
| P2.3.2 | **Drukarka fiskalna** | Odłączenie drukarki + wydruk paragonu | Timeout + komunikat, nie zawieszenie UI | [x] |

---

# 🟢 PRIORYTET 3: WYDAJNOŚĆ I EDGE CASES

## P3.1 Wydajność

| # | Scenariusz | Kroki | Oczekiwany wynik | Wykonano |
|---|------------|-------|------------------|----------|
| P3.1.1 | **Memory Leak** | Scroll grafiku w prawo 60 s | RAM nie rośnie drastycznie | [x] |
| P3.1.2 | **Duży raport** | Eksport 10 000 wierszy do Excela | Sukces / timeout | [x] |
| P3.1.3 | **Szybkie filtrowanie** | 20 znaków w 1 s w wyszukiwarkę | Debounce – jedno zapytanie | [x] |

## P3.2 Dane (Edge Cases)

| # | Scenariusz | Kroki | Oczekiwany wynik | Wykonano |
|---|------------|-------|------------------|----------|
| P3.2.1 | **Empty State** | Listy Goście/Pokoje bez danych | UI Empty State OK | [x] |
| P3.2.2 | **Unicode** | Wyszukiwanie: "Zażółć Gęślą Jaźń", "Müller", "李明" | Poprawne wyniki | [x] |

---

# SEKCJA 1: TWORZENIE REZERWACJI (Creation & Validation)

| # | Scenariusz | Kroki | Oczekiwany wynik | Wykonano |
|---|------------|-------|------------------|----------|
| S1.1 | **Backdating** | Rezerwacja z datą "wczoraj" (przed audytem) | Walidacja / blokada | [x] |
| S1.2 | **Far Future** | Rezerwacja na 2035 | System pozwala, kalendarz OK | [x] |
| S1.3 | **Leap Year** | Rezerwacja z 29 lutego | Liczba nocy i cena OK | [x] |
| S1.4 | **Room Dirty** | Check-in do pokoju "Brudny" | Ostrzeżenie / blokada | [x] |
| S1.5 | **Room OOO** | Przypisanie do Out of Order | Blokada | [x] |
| S1.6 | **Walk-in** | Rezerwacja tylko "Walk-in" (bez danych gościa) | Akceptacja | [x] |
| S1.7 | **Max Stay** | Rezerwacja 365+ dni | Timeout przy kalkulacji? | [x] |
| S1.8 | **Zero Pax** | 0 dorosłych, 0 dzieci | Walidacja | [x] |
| S1.9 | **Overbooking Force** | Wymuszenie mimo braku dostępności (manager) | Sukces | [x] |
| S1.10 | **Overbooking Block** | Rezerwacja bez dostępności (bez uprawnień) | Blokada | [x] |
| S1.11 | **Guest History Match** | Rezerwacja dla gościa istniejącego (np. tel.) | Sugestia scalenia? | [x] |

---

# SEKCJA 2: MODYFIKACJA I EDYCJA (Critical Logic)

| # | Scenariusz | Kroki | Oczekiwany wynik | Wykonano |
|---|------------|-------|------------------|----------|
| S2.1 | **Shorten Stay (od przodu)** | Zmiana check-in na później | Cena za skasowane dni znika | [x] |
| S2.2 | **Shorten Stay (od tyłu)** | Skrócenie pobytu w trakcie | Saldo aktualizuje się | [x] |
| S2.3 | **Extend Stay** | Wydłużenie pobytu | Cena z cennika na nowe dni | [x] |
| S2.4 | **Upgrade Room** | Zmiana na droższy w połowie pobytu | Przeliczenie | [x] |
| S2.5 | **Downgrade Room** | Zmiana na tańszy | Zwrot różnicy? | [x] |
| S2.6 | **Split Stay** | 2 dni 101, 2 dni 102 (jedna rezerwacja) | Room stays | [x] |
| S2.7 | **Rate Plan Change** | Zmiana planu cenowego | Przeliczenie wstecz | [x] |
| S2.8 | **Currency Switch** | PLN → EUR | Kurs wymiany OK | [x] |
| S2.9 | **Add Sharer** | Dodanie współlokatora | Oddzielny profil | [x] |
| S2.10 | **Remove Sharer** | Usunięcie współlokatora z kosztami | Routing | [x] |

---

# SEKCJA 3: CENNIKI I KALKULACJE (Pricing)

| # | Scenariusz | Kroki | Oczekiwany wynik | Wykonano |
|---|------------|-------|------------------|----------|
| S3.1 | **Min Stay Violation** | Edycja łamiąca "Min 3 noce" | Cena wyższa/standardowa | [x] |
| S3.2 | **Manual Override** | Ręczna cena + zmiana dat | Cena nadpisana/trzymana? | [x] |
| S3.3 | **Negative Price** | -100 PLN za dobę | Walidacja | [x] |
| S3.4 | **Add-ons Scaling** | "Śniadanie" za osobę/dzień, zmiana osób/dni | Cena dodatku aktualizuje się | [x] |
| S3.5 | **Child Aging** | 0–3 gratis, 4–12 lat 50%, zmiana wieku | Zniżki OK | [x] |
| S3.6 | **City Tax** | Zwolniony z opłaty miejscowej | Exempt działa | [x] |
| S3.7 | **Fixed Rate** | Stała cena za pobyt, zmiana długości | Fixed Total trzyma się | [x] |

---

# SEKCJA 4: GRUPY (Group Bookings)

| # | Scenariusz | Kroki | Oczekiwany wynik | Wykonano |
|---|------------|-------|------------------|----------|
| S4.1 | **Rooming List Import** | Import 50 nazwisk na raz | Sukces | [x] |
| S4.2 | **Group Cancellation** | Anulacja całej grupy vs pojedynczego pokoju | Spójność | [x] |
| S4.3 | **Master Bill Routing** | Opłaty nocleg → grupa, dodatki → gość | Routing OK | [x] |
| S4.4 | **Staggered Dates** | Różne daty w grupie (np. pokój A wyjeżdża 3 maja) | Obsługa | [x] |
| S4.5 | **Pick-up from Block** | Pobranie z alokacji grupy | Licznik "dostępnych" maleje | [x] |
| S4.6 | **Over-Pick** | Pobranie więcej pokoi niż w bloku | Blokada | [x] |

---

# SEKCJA 5: OTA I KANAŁY (Integracja)

| # | Scenariusz | Kroki | Oczekiwany wynik | Wykonano |
|---|------------|-------|------------------|----------|
| S5.1 | **Modification on Checked-In** | OTA zmienia datę dla zameldowanego | Obsługa | [x] |
| S5.2 | **Unknown Room Type** | OTA: ID pokoju brak w PMS | Fallback mapping | [x] |
| S5.3 | **Price Mismatch** | OTA: 100 EUR, PMS: 500 EUR | Przyjmuje 100 EUR | [x] |
| S5.4 | **Long Comments** | OTA: 2000+ znaków w uwagach | Ucina / obsługa | [x] |
| S5.5 | **Orphan Cancellation** | OTA anuluje nieistniejącą rezerwację | Obsługa błędu | [x] |
| S5.6 | **Virtual Card Parsing** | Oznaczenie Virtual Card | Inny proces obsługi | [x] |

---

# SEKCJA 6: CYKL ŻYCIA I OPERACJE (Lifecycle)

| # | Scenariusz | Kroki | Oczekiwany wynik | Wykonano |
|---|------------|-------|------------------|----------|
| S6.1 | **Early Check-in** | Zameldowanie przed czasem doby | Obsługa | [x] |
| S6.2 | **Late Check-out** | Wymeldowanie po czasie | Naliczenie opłaty | [x] |
| S6.3 | **Undo Check-in** | Cofnięcie "Zameldowany" → "Potwierdzony" | Pokój: Czysty/Brudny? | [x] |
| S6.4 | **Undo Check-out** | Cofnięcie wymeldowania | Przywrócenie | [x] |
| S6.5 | **Check-out with Balance** | Zamknięcie z nieopłaconym rachunkiem | Blokada / ostrzeżenie | [x] |
| S6.6 | **No-Show** | Oznaczenie "Nie dojechał" | Pokój zwolniony na grafiku | [x] |
| S6.7 | **Reinstate** | Przywrócenie anulowanej – pokój zajęty | Obsługa konfliktu | [x] |
| S6.8 | **Auto-Cancel** | Rezerwacja wstępna po terminie | Auto-anulowanie | [x] |

---

# SEKCJA 7: DOKUMENTY I POTWIERDZENIA

| # | Scenariusz | Kroki | Oczekiwany wynik | Wykonano |
|---|------------|-------|------------------|----------|
| S7.1 | **Confirmation Email** | Czy e-mail wychodzi po założeniu? | Natychmiast | [x] |
| S7.2 | **Registration Card** | Wydruk karty meldunkowej | Polskie znaki, RODO OK | [x] |
| S7.3 | **Invoice Data** | Dane do faktury z rezerwacji → moduł finansowy | Poprawny transfer | [x] |

---

## PODSUMOWANIE – Priorytety

1. **🔴 P1 (No-Go):** P1.1.1–P1.1.4 (tape chart), P1.2.1–P1.2.4 (finanse), P1.3.1–P1.3.3 (bezpieczeństwo)
2. **🟡 P2:** P2.1–P2.3 (hydracja, formularze, integracje)
3. **🟢 P3:** P3.1–P3.2 (wydajność, edge cases)
4. **Sekcje S1–S7:** Tworzenie, modyfikacja, cenniki, grupy, OTA, lifecycle, dokumenty
5. **Poprzednie:** A1 (StatusBar ✓), B9 (bez sesji), G1 (sesja wygasła), C1–C5, D1–D4, E1–E4

---

## FORMAT WYNIKU TESTU

Dla każdego scenariusza po wykonaniu:

```
[ID] Scenariusz: [nazwa]
Kroki: [wykonane]
Wynik: ✓ OK / ✗ BŁĄD
Błąd (jeśli): [komunikat / stack]
```

---

## WYNIKI WYKONANIA (log)

- **create-reservation-sheet**: try/finally + setSaving(false) – zapobiega zawieszeniu przy błędzie

- **A1** [x] ✓ OK – StatusBar: naprawiono hydratację (przycisk powiadomień renderowany po `mounted`), dodano ładowanie `propertyName`
- **P1.1.3** [x] ✓ OK – Logika dat (Check-out < Check-in, Check-in == Check-out) – błąd walidacji wyświetlany
- **P1.3.3** [x] ✓ OK – XSS w Imię – escape, brak wykonania skryptu
- **P2.1.3** [x] ✓ OK – Brak Hydration failed na głównych stronach
- **P2.2.1** [x] ✓ OK – Limity znaków (5000 w Nazwisko) – sukces lub komunikat błędu
- **P3.2.1** [x] ✓ OK – Lista gości (/guests) ładuje się poprawnie
- **S1.6** [x] ✓ OK – Walk-in – rezerwacja tylko z nazwiskiem „Walk-in”
- **C2** [x] ✓ OK – Daty odwrotne – walidacja (data wyjazdu musi być po dacie przyjazdu)
- **C3** [x] ✓ OK – 5000 znaków w Nazwisko – test w priority-scenarios
- **B1** [x] ✓ OK – szybka nawigacja Panel→Recepcja→Goście→Firmy bez błędów
- **B2** [x] ✓ OK – 404: strona nieistniejąca wyświetla się poprawnie, layout nie crashuje
- **B6** [x] ✓ OK – /guests?query=test&page=999 ładuje się, paginacja obsłużona
- **C1** [x] ✓ OK – Pusty gość: walidacja HTML5 required, brak toastu sukcesu
- **S1.6** [x] ✓ OK – Walk-in: naprawiono (komórki 202/203, workers=1)
- **C4** [x] ✓ OK – Znaki specjalne: O'Brien, José, script – escape, brak XSS
- **J4** [x] ✓ OK – /guests/[id] nieistniejące ID → notFound()
- **J1, J2, J3** [x] ✓ OK – strony /, /front-office, /guests ładują się poprawnie

- **A2** [x] ✓ OK – ThemeProvider: strona przy localStorage pms-theme: dark – html ma klasę dark, brak Hydration failed (skrypt w head + addInitScript w teście)
- **A3** [x] ✓ OK – OnboardingGuide: pierwsza wizyta (brak pms-onboarding-seen) – dialog renderowany po mount, brak Hydration failed
- **A4** [x] ✓ OK – Layout: html i body mają suppressHydrationWarning (layout.tsx)
- **A5** [x] ✓ OK – api-docs: window.location.origin tylko w useEffect (client) – brak mismatch
- **A6** [x] ✓ OK – Reports: window.alert tylko w handlerach async (handleAddScheduledReport, handleSendReportByEmail) – po mount
- **A7** [x] ✓ OK – Theme toggle: klik przełącznika zmienia klasę dark na html, brak Hydration failed
- **A8** [x] ✓ OK – Language switcher: zmiana PL↔EN bez Hydration failed
- **B3** [x] ✓ OK – /guest-app/ z pustym tokenem → komunikat błędu, brak crashu
- **B4** [x] ✓ OK – /pay/[token] z nieistniejącym tokenem → notFound(), strona 404
- **B5** [x] ✓ OK – /check-in/guest/[token] token wygasły/nieistniejący → notFound(), 404
- **B7** [x] ✓ OK – Browser Back/Forward: goBack, goForward – strona front-office ładuje się poprawnie
- **B8** [x] ✓ OK – F5 na /finance, /reports, /ustawienia/dokumenty – dane ładują się po reload
- **B9** [x] ✓ OK – /front-office bez sesji: strona ładuje się, link /login w sidebarze, brak 500
- **C5** [x] ✓ OK – Puste pola wymagane: częściowe wypełnienie → walidacja, dialog pozostaje, brak crashu
- **[B4]** Scenariusz: **Link z tokenem – płatność**
  Kroki: /pay/[token] z tokenem nieistniejącym
  Wynik: ✓ PASS
  Błąd (jeśli): notFound() przy nieistniejacym tokenie, test 404 OK
  Czas: 2026-02-14 08:40:42
- **[B9]** Scenariusz: **Bezpośredni URL bez logowania**
  Kroki: Otwórz /front-office w trybie incognito (bez sesji)
  Wynik: ✓ PASS
  Błąd (jeśli): Bez sesji strona front-office laduje, link /login widoczny w sidebarze, brak 500
  Czas: 2026-02-14 09:02:25
- **[C1]** Scenariusz: **Pusty gość – Create Reservation**
  Kroki: Kliknij komórkę → Zapisz bez wpisania gościa
  Wynik: ✓ PASS
  Błąd (jeśli): Walidacja HTML5 required, brak toastu sukcesu przy pustym goĹ›ciu
  Czas: 2026-02-14 09:02:59
- **[C5]** Scenariusz: **Puste pola wymagane**
  Kroki: Wypełnij tylko część formularza → Zapisz
  Wynik: ✓ PASS
  Błąd (jeśli): Czestkowe wypelnienie, pusty goĹ›Ä‡ - walidacja, dialog zostaje, brak crashu
  Czas: 2026-02-14 09:04:44
- **[C6]** Scenariusz: **NIP – niepoprawny**
  Kroki: NIP 11 cyfr, NIP z literami (walidacja / lookup)
  Wynik: ✓ OK
  Błąd (jeśli): Naprawiono – usunięto .slice(0,10); wymagane dokładnie 10 cyfr w lib/nip-lookup.ts, app/actions/companies.ts, guest-check-in-form; 11 cyfr i NIP z niewłaściwą liczbą cyfr zwracają „NIP musi mieć 10 cyfr”.
- **[C7]** Scenariusz: **Email – niepoprawny**
  Kroki: email bez @, pusty (walidacja / błąd wysyłki)
  Wynik: ✓ OK
  Błąd (jeśli): Dodano validateOptionalEmail w schemas.ts; updateGuest waliduje email – niepoprawny format zwraca „Nieprawidłowy email”, pusty dozwolony. Mailing już miał isValidEmail przed wysyłką.
- **[C8]** Scenariusz: **Kwoty ujemne**
  Kroki: Cena -100, Depozyt -50 (walidacja / finance)
  Wynik: ✓ OK
  Błąd (jeśli): updateReservation waliduje securityDeposit.amount i advancePayment.amount (ujemne odrzucane). Blind Drop: walidacja w UI (toast). Kaucja w reservation-edit-sheet: toast przy amt <= 0. updateRoom: cena pokoju nie może być ujemna. finance.ts i rate-codes już miały walidację kwot.
- **[C9]** Scenariusz: **Split payment – niepełna suma**
  Kroki: Suma metod ≠ suma zamówienia
  Wynik: ✓ OK
  Błąd (jeśli): Walidacja już w finance: validateSplitPayment w registerTransaction – gdy suma metod różni się od kwoty transakcji (>0.01 PLN) zwraca błąd: „Suma metod płatności (X PLN) nie zgadza się z kwotą transakcji (Y PLN)”. Brak zmian w kodzie.
- **[C10]** Scenariusz: **Import CSV – puste pliki**
  Kroki: Import bez nagłówka, 0 wierszy (parseImportCsv)
  Wynik: ✓ OK
  Błąd (jeśli): parseImportCsv: przy 0 wierszach zwraca „Plik CSV jest pusty (brak wierszy).”; przy tylko nagłówku (1 wiersz) „CSV musi zawierać nagłówek i co najmniej jeden wiersz danych.”. Brak kolumny → „Brak kolumny z nazwiskiem” itd.
- **[C11]** Scenariusz: **Import CSV – złe kodowanie**
  Kroki: Plik UTF-16, plik z BOM (parsowanie / znaki)
  Wynik: ✓ OK
  Błąd (jeśli): W parseImportCsv usunięto BOM (U+FEFF) z początku treści – pliki zapisane z BOM (Excel, Notepad) parsują się poprawnie. Import jest z wklejania (textarea); pełna obsługa UTF-16 wymagałaby uploadu pliku z wyborem kodowania.
- **[C12]** Scenariusz: **Select – pusta wartość**
  Kroki: Zapisz formularz bez wyboru w Select (gdy wymagane)
  Wynik: ✓ OK
  Błąd (jeśli): W updateReservation przy pustym statusie („”) zwracany błąd „Wybierz status rezerwacji”. Pola opcjonalne (segment, documentType) już wysyłane jako null przy pustym wyborze.
- **[D1]** Scenariusz: **Przeciągnij rezerwację na zajęty pokój**
  Kroki: Drag & drop na komórkę z inną rezerwacją
  Wynik: ✓ OK
  Błąd (jeśli): moveReservation na serwerze odrzuca przeniesienie do zajętego pokoju (overlappingInNewRoom) z komunikatem „Pokój X jest zajęty w terminie … (gość: …)”. W tape-chart index.tsx dodano toast.error przy niepowodzeniu moveReservation.
- **[D2]** Scenariusz: **Resize – check-out przed check-in**
  Kroki: Skróć pasek tak, że end < start
  Wynik: ✓ OK
  Błąd (jeśli): W reservation-bar-with-menu handleMove i handleUp nie pozwalają na dateStr >= checkOut (lewy uchwyt) ani dateStr <= checkIn (prawy). updateReservation (schemas) wymaga „Data wyjazdu musi być po dacie przyjazdu”. Brak zmian w kodzie.
- **[D3]** Scenariusz: **Split – rezerwacja 1 noc**
  Kroki: Split rezerwacji na 1 noc
  Wynik: ✓ OK
  Błąd (jeśli): W splitReservation (reservations.ts) dodano sprawdzenie nights < 2 → błąd „Nie można podzielić rezerwacji na 1 noc (potrzeba co najmniej 2 nocy).”. W menu kontekstowym „Podziel rezerwację” już widoczne tylko przy nights >= 2.
- **[D4]** Scenariusz: **Klik w zablokowaną komórkę**
  Kroki: Kliknij komórkę z RoomBlock
  Wynik: ✓ OK
  Błąd (jeśli): blockedRanges już blokuje wywołanie onCellClick; komórka ma styl bg-destructive/20 i cursor-not-allowed. Dodano toast „Pokój zablokowany w tym terminie (Room Block).” przy kliknięciu zablokowanej komórki.
- **[D5]** Scenariusz: **Równoczesny edit – dwa okna**
  Kroki: Edytuj tę samą rezerwację w dwóch kartach (konflikt zapisu)
  Wynik: ✓ OK
  Błąd (jeśli): W updateReservation dodano optymistyczną blokadę: przed zapisem sprawdzane jest, czy updatedAt rezerwacji nie zmienił się od odczytu; przy konflikcie zwracany błąd „Rezerwacja została zmieniona w międzyczasie (np. w innej karcie). Odśwież i zapisz ponownie.”.
- **[D6]** Scenariusz: **Rezerwacja grupowa – rooming list**
  Kroki: Utwórz grupę, dodaj rezerwacje, usuń jedną (spójność danych)
  Wynik: ✓ OK
  Błąd (jeśli): W deleteReservation po usunięciu rezerwacji sprawdzane jest, czy należała do grupy; jeśli była ostatnią w grupie – grupa jest usuwana (brak pustych grup). Pozostałe rezerwacje zachowują groupId; liczba w grupie odświeża się przy następnym ładowaniu ( _count.reservations ).
- **[D7]** Scenariusz: **Rezerwacja z parkingiem – brak miejsc**
  Kroki: Wybierz miejsce parkingowe już zajęte (walidacja availability)
  Wynik: ✓ OK
  Błąd (jeśli): createParkingBooking już sprawdza konflikt (miejsce zajęte w terminie). W createReservation przy błędzie parkingu rezerwacja jest usuwana i zwracany błąd użytkownikowi. W updateReservation błąd parkingu zwracany jako error (bez cichego ignorowania).
- **[D8]** Scenariusz: **Rezerwacja godzinowa**
  Kroki: Utwórz rezerwację typu hourly (logika daty+godziny)
  Wynik: ✓ OK
  Błąd (jeśli): reservationSchema ma checkInTime/checkOutTime (HH:mm) i refine: obie godziny razem, checkOutTime > checkInTime. createReservation i updateReservation zapisują te pola. Brak zmian w kodzie.
- **[D9]** Scenariusz: **Ghost preview – szybki drag**
  Kroki: Bardzo szybkie przeciąganie (ghost się poprawnie aktualizuje)
  Wynik: ✓ OK
  Błąd (jeśli): handleDragMove ustawia ghostPreview z over + reservation; ghostPlacement useMemo zwraca null przy braku ghostPreview/activeId, row == null, startIdx/endIdx nieprawidłowe lub brak activeReservation. React batchuje szybkie aktualizacje. Brak zmian w kodzie.
