# KOMPLETNA ARCHITEKTURA SYSTEMU PMS (Wzór KWHotel + Standardy 2026)

Szczegółowa lista modułów: `[x]` = zrobione, `[ ]` = do zrobienia. REFACTOR = naprawa istniejącej implementacji. FEATURE = nowe zadanie techniczne. SCENARIO = automatyzacja/logika biznesowa.

**Zasada:** Przy każdej nowej funkcji dodawać lub aktualizować testy (E2E, np. Playwright, lub jednostkowe – w zależności od zakresu).

---

## 1. RDZEŃ SYSTEMU (Core Module)

### 1.1 Multi-Property i Parking
- [x] Obsługa wielu obiektów (Property) – model, przełączanie obiektu, dane per obiekt.
- [x] Moduł parkingowy – grafik miejsc postojowych (oś czasu vs miejsca).
- [x] Powiązanie rezerwacji pokoju z miejscem w garażu.
- [x] REFACTOR: Parking: Dodać createAuditLog przy tworzeniu i usuwaniu ParkingBooking w app/actions/parking.ts.

### 1.2 Grafik Rezerwacji (Tape Chart)
- [x] Oś czasu (X) i zasobów (Y) – tape chart.
- [x] Interakcje: drag & drop (przenoszenie rezerwacji do innego pokoju).
- [x] Interakcje: resize (zmiana dat check-in/check-out przez przeciąganie krawędzi paska).
- [x] Interakcje: split – dzielenie rezerwacji na dwa pokoje.
- [x] Statusy wizualne i kolorowanie (CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW).
- [x] Konfigurowalne palety kolorów (np. w ustawieniach obiektu) – Property.reservationStatusColors, dialog „Kolory" na grafiku.
- [x] Filtrowanie: po typie pokoju, numerze/typie (wyszukiwarka).
- [x] Filtrowanie: piętra (grupowanie po numerze pokoju, np. front-office timeline).
- [x] Filtrowanie: cechy pokoju (np. balkon, widok) – rozszerzenie modelu Room o cechy (roomFeatures), filtr na grafiku.
- [x] REFACTOR: Tape chart: Dodać createAuditLog w moveReservation, splitReservation, changeReservationDates w app/actions/tape-chart.ts.
- [x] REFACTOR: Tape chart: Dodać walidację dat (checkOut > checkIn, brak nakładania z inną rezerwacją) przy resize i move w actions/tape-chart.ts.
- [x] FEATURE: [Grafik]: Przełącznik widoku (dzień/tydzień/miesiąc/rok) – skala osi czasu.
- [x] FEATURE: [Grafik]: Legenda kolorów statusów rezerwacji (CONFIRMED, CHECKED_IN, CANCELLED itp.) z opisami.
- [x] FEATURE: [Grafik]: Wskaźnik zajętości (occupancy %) w nagłówku.
- [x] FEATURE: [Grafik]: Podświetlenie "dziś" kolumną wertykalną.
- [x] FEATURE: [Grafik]: Zmiana „gęstości" widoku (zoom – szerokość komórek dnia).
- [x] FEATURE: [Grafik]: Widok planu piętra (floor plan view).
- [x] FEATURE: [Grafik]: Widok „dzień X – lista przyjazdów/wyjazdów" (daily arrivals/departures list).
- [x] FEATURE: [Grafik]: Opcja "pokaż tylko wolne pokoje".
- [x] FEATURE: [Grafik]: Opcja "pokaż konflikty/overbooking".
- [x] FEATURE: [Grafik]: Oznaczenie rezerwacji grupowych (np. ramka/kolor).
- [x] FEATURE: [Grafik]: "Ghost preview" przy przeciąganiu rezerwacji.
- [x] FEATURE: [Grafik]: Kolorowanie wg segmentu/kanału rezerwacji.
- [x] FEATURE: [Grafik]: Rozbudowane dymki (tooltip) z informacjami: źródło rezerwacji, uwagi, status płatności, VIP.
- [x] FEATURE: [Grafik]: Wyświetlanie liczby gości (pax) na pasku rezerwacji.
- [x] FEATURE: [Grafik]: Wyświetlanie uwag/notatek na pasku (ikona informacji).
- [x] FEATURE: [Grafik]: Nawigacja klawiaturowa (strzałki między komórkami, Enter = otwórz szczegóły).
- [x] FEATURE: [Grafik]: Skróty klawiszowe do szybkiego check-in/check-out na wybranej rezerwacji.
- [x] FEATURE: [Grafik]: Zaznaczanie wielu rezerwacji naraz (multi-select).
- [x] FEATURE: [Grafik]: Kopiowanie rezerwacji (duplicate booking).
- [x] FEATURE: [Grafik]: Funkcja „przedłuż pobyt" (extend stay) bezpośrednio z grafiku.
- [x] FEATURE: [Grafik]: Funkcja „skróć pobyt" (early checkout) bezpośrednio z grafiku.
- [x] FEATURE: [Grafik]: Eksport grafiku do PDF z wyborem zakresu dat i pokoi.
- [x] FEATURE: [Grafik]: Drukowanie grafiku z podziałem na strony.
- [x] FEATURE: [Parity]: Przycisk „Podgląd" – otwiera widok tylko do odczytu.
- [x] FEATURE: [Parity]: Komponent Legend (rozszerzona legenda statusów) z opisami i kolorami z Property.reservationStatusColors.

### 1.3 Logika Rezerwacji
- [x] Rezerwacje indywidualne.
- [x] Rezerwacje grupowe (Rooming List) – ReservationGroup, grupa rezerwacji, sheet do tworzenia.
- [x] Rezerwacje zasobowe (łóżka – sprzedaż łóżka zamiast całego pokoju).
- [x] Overbooking – kontrolowany (np. limit % ponad dostępność, ostrzeżenia).
- [x] Rezerwacje godzinowe (np. hotel na godziny przy lotnisku) – model i logika daty+godziny.
- [x] FEATURE: [Rezerwacje]: Model allotmentu (blokady pokoi dla firm/touroperatorów z release date).
- [x] FEATURE: [Rezerwacje]: Wait-lista (lista oczekujących na wolny termin).
- [x] FEATURE: [Rezerwacje]: Pole „Numer potwierdzenia" (confirmation number).
- [x] FEATURE: [Rezerwacje]: Pole „Źródło rezerwacji" (source: OTA, telefon, email, walk-in, strona WWW).
- [x] FEATURE: [Rezerwacje]: Pole „Kanał sprzedaży" (channel: Booking.com, Expedia, Airbnb, Direct).
- [x] FEATURE: [Rezerwacje]: Pole „Segment rynkowy" (Market Segment: Business, Leisure, Group, Corporate).
- [x] FEATURE: [Rezerwacje]: Pole „Uwagi wewnętrzne" (internal notes – widoczne tylko dla personelu).
- [x] FEATURE: [Rezerwacje]: Pole „Uwagi dla gościa" (guest-visible notes – drukowane na potwierdzeniu).
- [x] FEATURE: [Rezerwacje]: Pole „Specjalne życzenia" (special requests: łóżeczko dziecięce, dieta).
- [x] FEATURE: [Rezerwacje]: Pole „ETA" (szacowana godzina przyjazdu).
- [x] FEATURE: [Rezerwacje]: Pole „ETD" (szacowana godzina wyjazdu).
- [x] FEATURE: [Rezerwacje]: Pole „Rodzaj pobytu" (trip purpose: biznesowy, turystyczny, konferencja).
- [x] FEATURE: [Rezerwacje]: Pole „Meal plan" (wyżywienie: BB, HB, FB, AI).
- [x] FEATURE: [Rezerwacje]: Pola preferencji pokoju (widok, piętro, cichy, wysoki numer, blisko windy).
- [x] FEATURE: [Rezerwacje]: Pole „Typ łóżka preferowany" (double, twin, king, single).
- [x] FEATURE: [Rezerwacje]: Pole „Pokój dla palących" (smoking room).
- [x] FEATURE: [Rezerwacje]: Pole „Dostęp dla niepełnosprawnych" (wheelchair accessible).
- [x] FEATURE: [Rezerwacje]: Pole „Liczba dzieci" oddzielnie od dorosłych + wiek dzieci.
- [x] FEATURE: [Rezerwacje]: Pole „Zwierzęta" (pet-friendly, rodzaj, opłata).
- [x] FEATURE: [Rezerwacje]: Pole „Status płatności" (unpaid, partial, paid).
- [x] FEATURE: [Rezerwacje]: Pole „Kaucja/Depozyt na pokój" (security deposit).
- [x] FEATURE: [Rezerwacje]: Pole „Karta gwarancyjna" (CC guarantee – ostatnie 4 cyfry, data ważności).
- [x] FEATURE: [Rezerwacje]: Pole „Przedpłata wymagana" (advance payment required – tak/nie, kwota).
- [x] FEATURE: [Rezerwacje]: Pole „Powód anulacji" (Cancellation Reason).
- [x] FEATURE: [Rezerwacje]: Statusy dodatkowe: „Request" (oczekuje na potwierdzenie), „Guaranteed" (gwarantowana kartą), „Wait List".
- [x] FEATURE: [Rezerwacje]: Alerty/flagi (VIP, Bad Payer, Special Request, No-show history).
- [x] FEATURE: [Rezerwacje]: Powiązanie z agentem/touroperatorem (Agent/Travel Agency).
- [x] FEATURE: [Rezerwacje]: Widok historii zmian rezerwacji (viewable audit log per reservation).
- [x] FEATURE: [Rezerwacje]: Generowanie vouchera (PDF) z potwierdzeniem rezerwacji.
- [x] FEATURE: [Rezerwacje]: Łączenie rezerwacji (merge reservations).
- [x] SCENARIO: [Rezerwacje]: Automatyczna konwersja Request → Confirmed po X godzinach.
- [x] SCENARIO: [Rezerwacje]: Walk-in – szybkie tworzenie rezerwacji z natychmiastowym check-in.
- [x] SCENARIO: [Rezerwacje]: Automatyczne przypisanie pokoju (auto-assign) przy rezerwacji bez wskazania pokoju.

---

## 2. POKOJE (Inventory)

- [x] Definicje pokoi i typów (Room, RoomType).
- [x] Statusy techniczne (CLEAN, DIRTY, OOO – Out of Order).
- [x] Blokady pokoi (RoomBlock) – blok na daty z powodu.
- [x] Wirtualne pokoje: sprzedaż dwóch pokoi połączonych drzwiami jako jeden „Apartament Rodzinny".
- [x] REFACTOR: Pokoje: Dodać edycję pola roomFeatures (cechy pokoju) w formularzu na stronie /pokoje – jeśli brak w UI.
- [x] FEATURE: [Pokoje]: Pole „Metraż" (surface area m²).
- [x] FEATURE: [Pokoje]: Pole „Piętro" (floor number).
- [x] FEATURE: [Pokoje]: Pole „Budynek/Skrzydło" (building/wing).
- [x] FEATURE: [Pokoje]: Pole „Widok" (morze, góry, miasto, parking).
- [x] FEATURE: [Pokoje]: Pole „Ekspozycja" (północ, południe, wschód, zachód).
- [x] FEATURE: [Pokoje]: Pole „Maksymalna pojemność" (max pax/occupancy).
- [x] FEATURE: [Pokoje]: Pole „Liczba łóżek" (beds count) i „Typy łóżek" (double, twin, single, king, queen, sofa-bed).
- [x] FEATURE: [Pokoje]: Pole „Opis marketingowy" (room description).
- [x] FEATURE: [Pokoje]: Zdjęcia pokoi (gallery).
- [x] FEATURE: [Pokoje]: Lista wyposażenia pokoju (amenities: TV, minibar, klimatyzacja, sejf, WiFi, balkon, wanna/prysznic).
- [x] FEATURE: [Pokoje]: Inwentaryzacja wyposażenia (inventory list).
- [x] FEATURE: [Pokoje]: Pole „Pokoje połączone" (connecting rooms) i funkcja łączenia/rozłączania.
- [x] FEATURE: [Pokoje]: Status „INSPECTED" (do inspekcji przed zameldowaniem).
- [x] FEATURE: [Pokoje]: Status „CHECKOUT_PENDING" (oczekuje na wymeldowanie).
- [x] FEATURE: [Pokoje]: Status „MAINTENANCE" (do naprawy – osobny od OOO).
- [x] FEATURE: [Pokoje]: Priorytet sprzątania (VIP arrival, departure, stay-over).
- [x] FEATURE: [Pokoje]: Harmonogram sprzątania.
- [x] FEATURE: [Pokoje]: Historia usterek/awarii.
- [x] FEATURE: [Pokoje]: Notatki techniczne do pokoju.
- [x] FEATURE: [Pokoje]: Pole „Termin przeglądu/serwisu".
- [x] FEATURE: [Pokoje]: Planowane konserwacje (scheduled maintenance) z powiadomieniem o zakończeniu OOO.
- [x] SCENARIO: [Pokoje]: Blokada pokoju na remont z datą planowanego zakończenia.

---

## 3. CRM, RODO I KOMUNIKACJA

### 3.1 Karta Gościa
- [x] Dane gościa (Guest: name, email, phone, MRZ).
- [x] Powiązanie rezerwacji z gościem i opcjonalnie z firmą.
- [x] Historia pobytów (widok w kartotece gościa).
- [x] Czarna lista (blacklist).
- [x] Preferencje gościa (np. piętro, łóżko małżeńskie).
- [x] FEATURE: [Klienci]: Pole „Data urodzenia".
- [x] FEATURE: [Klienci]: Pole „Miejsce urodzenia".
- [x] FEATURE: [Klienci]: Pole „Obywatelstwo/Narodowość".
- [x] FEATURE: [Klienci]: Pola adresu zamieszkania (ulica, miasto, kod, kraj).
- [x] FEATURE: [Klienci]: Pole „Płeć" (do statystyk GUS).
- [x] FEATURE: [Klienci]: Pole „Typ dokumentu" (paszport, dowód, prawo jazdy).
- [x] FEATURE: [Klienci]: Pole „Numer dokumentu tożsamości".
- [x] FEATURE: [Klienci]: Pole „Data ważności dokumentu".
- [x] FEATURE: [Klienci]: Pole „Organ wydający dokument".
- [x] FEATURE: [Klienci]: Pole „VIP status" (tak/nie, poziom: Bronze, Silver, Gold, Platinum).
- [x] FEATURE: [Klienci]: System kart lojalnościowych (loyalty program, punkty, tier).
- [x] FEATURE: [Klienci]: Pole „Data ostatniego pobytu" i „Liczba pobytów" (total stays).
- [x] FEATURE: [Klienci]: Pole „Preferencje posiłków" (wegetariańskie, bezglutenowe).
- [x] FEATURE: [Klienci]: Pole „Alergie i uwagi zdrowotne".
- [x] FEATURE: [Klienci]: Pole „Ulubiony minibar" (produkty do przygotowania przed przyjazdem).
- [x] FEATURE: [Klienci]: Pole „Uwagi/ostrzeżenia do gościa" (staff notes).
- [x] FEATURE: [Klienci]: Blokada rezerwacji dla gości z czarnej listy.
- [x] FEATURE: [Klienci]: Moduł RODO (zgody marketingowe, data zgody, prawo do zapomnienia).
- [x] FEATURE: [Klienci]: Funkcja „Eksport danych gościa" (RODO – PDF/CSV).
- [x] FEATURE: [Klienci]: Funkcja „Usunięcie danych gościa" (RODO – prawo do bycia zapomnianym).
- [x] FEATURE: [Klienci]: Pole „Zdjęcie gościa" (opcjonalne).
- [x] FEATURE: [Klienci]: Pole „Kontakt awaryjny" (emergency contact).
- [x] FEATURE: [Klienci]: Pole „Zawód" (occupation).
- [x] FEATURE: [Klienci]: Pole „Typ gościa" (Guest Type: Individual, Corporate, Group, Crew).
- [x] FEATURE: [Klienci]: Segmentacja gości (biznes, leisure, grupy, VIP).
- [x] FEATURE: [Klienci]: Powiązanie gościa z rodziną/osobami towarzyszącymi.
- [x] FEATURE: [Klienci]: Wyszukiwarka gości (search by name, phone, email, document).
- [x] FEATURE: [Klienci]: Deduplikacja gości (merge duplicate profiles).
- [x] FEATURE: [Parity]: Otwieranie karty gościa w osobnym oknie (route /guests/[id] w modal lub pełna strona) – link „Edycja klienta".
- [x] FEATURE: [Parity]: W kartotece gościa app/guests/[id]/guest-card-client.tsx dodać zakładki RODO (zgody, historia) i autouzupełnianie pól z poprzednich pobytów.
- [x] SCENARIO: [Klienci]: Anonimizacja danych RODO na żądanie gościa.

### 3.2 Firmy / Kontrahenci
- [x] Dane firmy (Company: NIP, nazwa, adres) – z NIP lookup.
- [x] Po wyszukaniu NIP i uzyskaniu danych firmy – automatyczne uzupełnienie pól klienta/firmy w formularzu meldunku.
- [x] FEATURE: [Firmy]: Pełna baza firm (osobna strona zarządzania).
- [x] FEATURE: [Firmy]: Kontrakty korporacyjne (corporate rates dla firm).
- [x] FEATURE: [Firmy]: Warunki płatności per firma (Payment Terms: 14/30/60 dni).
- [x] FEATURE: [Firmy]: Limit kredytowy (Credit Limit).
- [x] FEATURE: [Firmy]: Rabat firmowy (Corporate Discount %).
- [x] FEATURE: [Firmy]: Osoba kontaktowa w firmie.
- [x] FEATURE: [Firmy]: Historia rezerwacji firmy.
- [x] FEATURE: [Firmy]: Rozrachunki z firmą (saldo należności).
- [x] FEATURE: [Firmy]: Przypisanie opiekuna handlowego do firmy.
- [x] FEATURE: [Firmy]: Model „Travel Agent" / Biuro podróży (agent rates, prowizje).
- [x] SCENARIO: [Firmy]: Faktura zbiorcza za wiele pobytów jednej firmy.

### 3.3 Mailing
- [x] Potwierdzenia rezerwacji (e-mail).
- [x] Podziękowania po pobycie.
- [x] REFACTOR: Mailing: Dodać walidację adresu e-mail (format) przed wysłaniem w sendReservationConfirmation (app/actions/mailing.ts).
- [x] FEATURE: [Admin]: Szablony e-mail (confirmation, reminder, thank you).

### 3.4 SMS
- [x] Wysyłanie kodów do drzwi SMS-em (placeholder – bramka do rozbudowy).
- [x] Powiadomienia typu „Twój pokój jest już gotowy".
- [x] REFACTOR: SMS: Dodać logowanie wysłanych SMS (tabela SmsLog lub zapis w konsoli) w app/actions/sms.ts dla audytu.
- [x] FEATURE: [SMS]: Dodać model SmsLog w schema.prisma (guestId?, reservationId?, phone, body, status, sentAt, error?).
- [x] FEATURE: [SMS]: W app/actions/sms.ts zapisywać wpis do SmsLog po każdym wysłaniu (sendDoorCode, sendRoomReady).
- [x] FEATURE: [SMS]: Stworzyć stronę app/ustawienia/sms/page.tsx z konfiguracją bramki (Twilio) i przyciskiem testu wysyłki.
- [x] SCENARIO: [Integracje]: Automatyczne wysyłanie przypomnienia SMS przed przyjazdem.

### 3.5 Web Check-in (Kiosk Online)
- [x] Gość melduje się sam przez link w telefonie przed przyjazdem (link + strona gościa).
- [x] Zdalne podpisywanie karty meldunkowej (podpis na ekranie, canvas + meldunek CHECKED_IN).
- [x] REFACTOR: Web Check-in: Dodać createAuditLog przy meldunku (submitCheckIn) w app/actions/web-check-in.ts.
- [x] FEATURE: [Integracje]: Moduł self check-in kiosk.
- [x] FEATURE: [Integracje]: Aplikacja mobilna dla gościa (rezerwacje, klucz cyfrowy).

---

## 4. FINANSE I KSIĘGOWOŚĆ

### 4.1 Dokumenty sprzedaży
- [x] Paragony (druk na kasie fiskalnej przy transakcji i zaliczce).
- [x] Faktura na POSNET (dla rezerwacji z firmą) – druk do kasy/bridge.
- [x] Faktura zaliczkowa (logika przy rejestracji zaliczki).
- [x] Faktury VAT (pełna obsługa: marża, korekty, numeracja, PDF).
- [x] Proformy.
- [x] Korekty faktur.
- [x] FEATURE: [Finanse]: Rachunek (nie-VAT).
- [x] FEATURE: [Finanse]: Nota księgowa.
- [x] FEATURE: [Finanse]: Automatyczna numeracja faktur (FV/2026/001) – konfiguracja prefix, reset yearly.
- [x] FEATURE: [Finanse]: Szablon faktury (logo, nagłówek, stopka).
- [x] FEATURE: [Finanse]: Szablon wydruku paragonu fiskalnego.
- [x] FEATURE: [Admin]: Szablony dokumentów (faktury, potwierdzenia, karty meldunkowe).

### 4.2 Integracja z drukarkami fiskalnymi
- [x] Protokół Posnet (HTTP bridge).
- [x] Sterownik mock (symulacja).
- [x] Protokoły Novitus, Elzab (obecnie placeholder → mock).
- [x] REFACTOR: Fiscal: Dodać retry (3x) przy błędzie połączenia w lib/fiscal/novitus-driver.ts i elzab-driver.ts.
- [x] REFACTOR: Fiscal: Zwracać kod błędu z drukarki w FiscalReceiptResult (pole errorCode) dla diagnostyki.
- [x] FEATURE: [Fiscal]: Dodać dokumentację env FISCAL_NOVITUS_HOST, FISCAL_NOVITUS_PORT, FISCAL_ELZAB_HOST, FISCAL_ELZAB_PORT w pliku .env.example.
- [x] FEATURE: [Finanse]: Obsługa różnych modeli POSNET (Thermal, Ergo, itp.).
- [x] FEATURE: [Finanse]: Raporty dobowe fiskalne (X, Z).
- [x] FEATURE: [Finanse]: Raporty miesięczne fiskalne.
- [x] SCENARIO: [Księgowość]: Storno paragonu fiskalnego.

### 4.3 Kasa i płatności
- [x] KP/KW w sensie rejestracji transakcji (Transaction, typy ROOM, DEPOSIT, VOID).
- [x] Blind Drop (zamknięcie zmiany – porównanie gotówki z systemem).
- [x] Void z PINem managera.
- [x] Raporty kasowe (np. dzienny ruch gotówki, zestawienie KP/KW) – sekcja na stronie Raporty przy raporcie dobowym.
- [x] REFACTOR: Finanse: Dodać walidację kwoty i reservationId w registerTransaction (app/actions/finance.ts) – zwracać ActionResult z błędem zamiast rzucać.
- [x] FEATURE: [Finanse]: Pełny model typów płatności (CASH, CARD, TRANSFER, VOUCHER, PREPAID, Blik).
- [x] FEATURE: [Finanse]: Split payment (kilka metod płatności na jednej transakcji).
- [x] FEATURE: [Finanse]: Rozliczenie karty kredytowej (batch settlement).
- [x] FEATURE: [Finanse]: Integracja z terminalem płatniczym (Ingenico, Verifone).
- [x] FEATURE: [Finanse]: Obsługa walut obcych (przewalutowanie, kursy walut).
- [x] FEATURE: [Finanse]: Obsługa voucherów/bonów podarunkowych.
- [x] FEATURE: [Finanse]: Pełny „koszyk usług" (folio) dla rezerwacji.
- [x] FEATURE: [Finanse]: Podział folio (split folio – np. firma + gość prywatnie).
- [x] FEATURE: [Finanse]: Przenoszenie pozycji między folio.
- [x] FEATURE: [Finanse]: Osobne rachunki (separate checks) dla gości w jednym pokoju.
- [x] FEATURE: [Finanse]: Rabaty procentowe i kwotowe.
- [x] FEATURE: [Finanse]: Rozróżnienie rabat na rezerwację vs rabat na pozycję.
- [x] FEATURE: [Finanse]: Limity rabatowe per użytkownik.
- [x] FEATURE: [Finanse]: Obsługa kaucji za pokój (security deposit) i funkcja zwrotu.
- [x] FEATURE: [Finanse]: Refundacja (zwrot pieniędzy).
- [x] FEATURE: [Finanse]: Przypomnienia o płatności (dunning letters).
- [x] FEATURE: [Finanse]: Moduł windykacji.
- [x] FEATURE: [Finanse]: Prowizje dla agentów (biur podróży, OTA) i raport prowizji.
- [x] FEATURE: [Finanse]: Kasa zmianowa (shift opening/closing balance).
- [x] FEATURE: [Finanse]: Płatności częściowe (partial payment tracking).
- [x] FEATURE: [Finanse]: Historia Blind Dropów (kto, kiedy, kwota, manko/superata).
- [x] FEATURE: [Finanse]: Limit prób PIN przy Void (blokada po 3 błędnych).
- [x] FEATURE: [Parity]: W menu kontekstowym paska rezerwacji dodać przyciski „Wystaw dokument" i „Płatności".
- [x] FEATURE: [Parity]: W arkuszu edycji rezerwacji (components/tape-chart/reservation-edit-sheet.tsx) dodać zakładki „Dokumenty" i „Posiłki".
- [x] SCENARIO: [Finanse]: Automatyczne obciążenie za nocleg przy check-out (posting ROOM).
- [x] SCENARIO: [Finanse]: Automatyczne generowanie faktury przy check-out.
- [x] SCENARIO: [Księgowość]: Faktura za przedpłatę z późniejszym rozliczeniem końcowym.

### 4.4 Bramka płatności online (Fintech)
- [x] Generowanie linków do płatności (Payment Links) wysyłanych mailem.
- [x] Automatyczne księgowanie wpłat z PayU / Przelewy24 / Stripe / Tpay (webhook + rejestracja transakcji).
- [x] Preautoryzacja kart kredytowych (blokada środków na poczet zniszczeń – model CardPreauth, capture/release).

### 4.5 Eksport do księgowości
- [x] JPK (Jednolity Plik Kontrolny).
- [x] Integracje: Optima, Subiekt, wFirma, Fakturownia (placeholdery – do rozbudowy).
- [x] REFACTOR: JPK: Dodać walidację zakresu dat (np. max 1 rok) i obsługę błędów w app/api/finance/jpk/route.ts lub app/actions/jpk.ts.
- [x] FEATURE: [Integracje]: Dodać model AccountingExport w schema.prisma (propertyId, system: optima|subiekt|wfirma|fakturownia, lastExportAt, config Json).
- [x] FEATURE: [Integracje]: Stworzyć Server Action exportToOptima(propertyId, dateFrom, dateTo) w app/actions – eksport CSV/XML faktur i transakcji.
- [x] FEATURE: [Integracje]: Stworzyć Server Action exportToWfirma(propertyId, dateFrom, dateTo) z wywołaniem API wFirma w app/actions.
- [x] FEATURE: [Integracje]: Stworzyć Server Action exportToFakturownia(propertyId, dateFrom, dateTo) z wywołaniem API Fakturownia.pl w app/actions.
- [x] FEATURE: [Integracje]: Na stronie app/finance/integracje/page.tsx dodać konfigurację API (klucze, wybór systemu) i przycisk „Eksportuj zakres dat".
- [x] FEATURE: [Finanse]: Generowanie JPK_FA (Jednolity Plik Kontrolny – Faktury).
- [x] FEATURE: [Finanse]: Generowanie JPK_VAT.
- [x] FEATURE: [Finanse]: Rejestry VAT (sprzedaży/zakupów).
- [x] FEATURE: [Finanse]: KPiR (Księga Przychodów i Rozchodów).
- [x] FEATURE: [Integracje]: Eksport do systemu księgowego (Symfonia, enova, Insert).

### 4.6 Podatki lokalne
- [x] Opłata miejscowa / klimatyczna (naliczanie i rozliczenie).
- [x] FEATURE: [Księgowość]: City tax / opłata klimatyczna (automatyczne naliczanie per noc per osoba) – jeśli wymaga rozbudowy.
- [x] FEATURE: [Księgowość]: Depozyt gotówkowy (cash deposit przy check-in).

### 4.7 Integracja KSeF (Krajowy System e-Faktur)

#### A. Modele danych (Prisma/DB)
- [x] FEATURE: [KSeF]: Rozszerzenie modelu Invoice – pole `ksefUuid` (String?, nadany numer KSeF).
- [x] FEATURE: [KSeF]: Rozszerzenie modelu Invoice – pole `ksefReferenceNumber` (String?, nr referencyjny sesji/wysyłki).
- [x] FEATURE: [KSeF]: Rozszerzenie modelu Invoice – pole `ksefStatus` (Enum: DRAFT, PENDING, SENT, ACCEPTED, REJECTED, VERIFICATION).
- [x] FEATURE: [KSeF]: Rozszerzenie modelu Invoice – pole `ksefUpoUrl` (String?, link do pobrania UPO).
- [x] FEATURE: [KSeF]: Rozszerzenie modelu Invoice – pole `ksefPublishedAt` (DateTime?, data przyjęcia przez MF).
- [x] FEATURE: [KSeF]: Rozszerzenie modelu Invoice – pole `ksefErrorMessage` (String?, komunikat błędu z bramki).
- [x] FEATURE: [KSeF]: Nowy model `KsefSession` – pola: id, propertyId, nip, sessionToken, tokenExpiresAt, challenge, contextIdentifier, createdAt, lastKeepAliveAt.
- [x] FEATURE: [KSeF]: Nowy model `KsefSentBatch` – pola: id, sessionId, invoiceIds, batchReferenceNumber, sentAt, status.
- [x] FEATURE: [KSeF]: Migracja Prisma dla pól KSeF w Invoice i nowych modeli.

#### B. Autoryzacja i sesja (API Ministerstwa Finansów)
- [x] FEATURE: [KSeF]: Serwis `lib/ksef/auth.ts` – pobieranie klucza publicznego MF (GET /api/online/Session/AuthorisationChallenge).
- [x] FEATURE: [KSeF]: Serwis `lib/ksef/auth.ts` – generowanie `InitSessionTokenRequest` (XML) z szyfrowaniem RSA kluczem publicznym MF.
- [x] FEATURE: [KSeF]: Serwis `lib/ksef/auth.ts` – obsługa Challenge-Response (InitiateToken) – podpisywanie cyfrowe wyzwania tokenem autoryzacyjnym.
- [x] FEATURE: [KSeF]: Serwis `lib/ksef/auth.ts` – wysłanie InitSession (POST /api/online/Session/InitSession) i parsowanie sessionToken + contextIdentifier.
- [x] FEATURE: [KSeF]: Server Action `initKsefSession(propertyId)` – inicjalizacja sesji interaktywnej, zapis do KsefSession.
- [x] FEATURE: [KSeF]: Server Action `terminateKsefSession(sessionId)` – zamknięcie sesji (POST /api/online/Session/Terminate).
- [x] FEATURE: [KSeF]: Mechanizm KeepAlive – Server Action `keepAliveKsefSession(sessionId)` z wywołaniem GET /api/online/Session/Status co 10 min.
- [x] FEATURE: [KSeF]: Cron job lub background task – automatyczne odświeżanie aktywnych sesji (KeepAlive) przed wygaśnięciem (20 min timeout MF).
- [x] FEATURE: [KSeF]: Konfiguracja env: `KSEF_ENV` (test/prod), `KSEF_NIP`, `KSEF_AUTH_TOKEN`, `KSEF_TEST_URL=https://ksef-test.mf.gov.pl`, `KSEF_PROD_URL=https://ksef.mf.gov.pl`.
- [x] SCENARIO: [KSeF]: Automatyczne wznowienie sesji po wygaśnięciu tokenu (re-init przed wysyłką jeśli expired).

#### C. Generator XML (Struktura Logiczna FA(2))
- [x] FEATURE: [KSeF]: Serwis `lib/ksef/xml-generator.ts` – konwerter Invoice (DB) → FA_2.xml zgodny ze schematem XSD e-faktury.
- [x] FEATURE: [KSeF]: Generator XML – węzeł `Naglowek` (KodFormularza, WariantFormularza, DataWytworzeniaFa, SystemInfo).
- [x] FEATURE: [KSeF]: Generator XML – węzeł `Podmiot1` (Sprzedawca: NIP, Nazwa, Adres, DaneKontaktowe).
- [x] FEATURE: [KSeF]: Generator XML – węzeł `Podmiot2` (Nabywca: NIP lub dane osoby fizycznej, Adres).
- [x] FEATURE: [KSeF]: Generator XML – węzeł `Fa` (P_1 data wystawienia, P_2 numer faktury, P_13_1-P_15 kwoty netto/VAT/brutto, KursWaluty).
- [x] FEATURE: [KSeF]: Generator XML – węzeł `FaWiersze` (lista pozycji: P_7 nazwa, P_8A jednostka, P_8B ilość, P_9A cena jedn., P_11 wartość, P_12 stawka VAT).
- [x] FEATURE: [KSeF]: Generator XML – węzeł `Podsumowanie` (lista stawek VAT: P_13_1 netto, P_14_1 VAT, P_13_2..P_14_4 dla każdej stawki).
- [x] FEATURE: [KSeF]: Generator XML – obsługa faktury korygującej (PrzyczynaKorekty, NrFaKorygowanej, OkresFaKorygowanej).
- [x] FEATURE: [KSeF]: Walidacja lokalna XSD – funkcja `validateInvoiceXml(xmlString)` przed wysyłką (xmllint lub xsd-schema-validator).
- [x] FEATURE: [KSeF]: Pobieranie aktualnego schematu XSD z MF i cache lokalny (`lib/ksef/schemas/FA_2.xsd`).
- [x] SCENARIO: [KSeF]: Odrzucenie wysyłki przy błędzie walidacji XSD – zwrot komunikatu użytkownikowi.

#### D. Komunikacja z bramką (API KSeF)
- [x] FEATURE: [KSeF]: Serwis `lib/ksef/api-client.ts` – klient HTTP dla bramki KSeF (axios/fetch z headerami sesji).
- [x] FEATURE: [KSeF]: Endpoint SendInvoice – wysyłka interaktywna pojedynczej faktury (PUT /api/online/Invoice/Send).
- [x] FEATURE: [KSeF]: Endpoint SendInvoiceBatch – wysyłka wsadowa wielu faktur (PUT /api/online/Invoice/Send z tablicą).
- [x] FEATURE: [KSeF]: Server Action `sendInvoiceToKsef(invoiceId)` – generowanie XML, wysyłka, zapis ksefReferenceNumber i statusu PENDING.
- [x] FEATURE: [KSeF]: Server Action `sendBatchToKsef(invoiceIds[])` – wysyłka wsadowa, zapis KsefSentBatch.
- [x] FEATURE: [KSeF]: Endpoint CheckStatus – polling statusu faktury (GET /api/online/Invoice/Status/{ksefReferenceNumber}).
- [x] FEATURE: [KSeF]: Server Action `checkKsefInvoiceStatus(invoiceId)` – odpytanie statusu, aktualizacja ksefStatus (ACCEPTED/REJECTED), zapis ksefUuid.
- [x] FEATURE: [KSeF]: Background job – polling co 10 sekund dla faktur w statusie PENDING (max 5 min, potem timeout).
- [x] FEATURE: [KSeF]: Pobieranie UPO – Server Action `downloadUpo(invoiceId)` (GET /api/online/Invoice/Upo/{ksefUuid}) i zapis ksefUpoUrl.
- [x] FEATURE: [KSeF]: Generowanie linku weryfikacyjnego do faktury na portalu KSeF (https://ksef.mf.gov.pl/web/verify/{ksefUuid}).
- [x] FEATURE: [KSeF]: Zapisywanie UPO jako PDF lub XML w storage (S3/lokalnie) z powiązaniem do Invoice.

#### E. UI/UX (Frontend)
- [x] FEATURE: [KSeF]: Badge statusu KSeF na liście faktur (`/finance`) – kolory: szary (DRAFT), żółty (PENDING), zielony (ACCEPTED), czerwony (REJECTED), niebieski (VERIFICATION).
- [x] FEATURE: [KSeF]: Przycisk „Wyślij do KSeF" w wierszu faktury (wywołanie sendInvoiceToKsef).
- [x] FEATURE: [KSeF]: Przycisk „Wyślij zaznaczone do KSeF" – bulk action dla wielu faktur (sendBatchToKsef).
- [x] FEATURE: [KSeF]: Przycisk „Pobierz UPO" (widoczny gdy ksefStatus = ACCEPTED) – downloadUpo.
- [x] FEATURE: [KSeF]: Przycisk „Sprawdź status" – ręczne wywołanie checkKsefInvoiceStatus.
- [x] FEATURE: [KSeF]: Modal/Dialog z komunikatem błędu KSeF (ksefErrorMessage) dla odrzuconych faktur.
- [x] FEATURE: [KSeF]: Generowanie kodu QR na wydruku faktury PDF – link weryfikacyjny KSeF (wymóg dla faktur drukowanych).
- [x] FEATURE: [KSeF]: Wyświetlanie numeru KSeF (ksefUuid) na wydruku i podglądzie faktury.
- [x] FEATURE: [KSeF]: Strona ustawień `app/ustawienia/ksef/page.tsx` – konfiguracja NIP, token autoryzacyjny, przełącznik środowiska (Test/Produkcja).
- [x] FEATURE: [KSeF]: Na stronie ustawień KSeF – przycisk „Testuj połączenie" (init + terminate sesji testowej).
- [x] FEATURE: [KSeF]: Historia wysyłek KSeF – lista z datą, statusem, numerem referencyjnym (tabela KsefSentBatch).
- [x] FEATURE: [KSeF]: Toast/Snackbar z potwierdzeniem wysyłki lub błędem.

#### F. Scenariusze błędów i edge cases
- [x] SCENARIO: [KSeF]: Retry Policy – automatyczne ponawianie wysyłki przy błędzie połączenia z bramką (3 próby, exponential backoff: 1s, 5s, 30s).
- [x] SCENARIO: [KSeF]: Obsługa awarii bramki MF (HTTP 5xx) – kolejkowanie do późniejszej wysyłki, powiadomienie użytkownika.
- [x] SCENARIO: [KSeF]: Obsługa odrzucenia semantycznego (HTTP 400 + kod błędu MF) – parsowanie komunikatu błędu i zapis do ksefErrorMessage.
- [x] SCENARIO: [KSeF]: Walidacja NIP nabywcy przed wysyłką (VIES/GUS lookup) – ostrzeżenie jeśli NIP nieaktywny.
- [x] SCENARIO: [KSeF]: Blokada edycji faktury po wysłaniu do KSeF (ksefStatus != DRAFT).
- [x] SCENARIO: [KSeF]: Obsługa timeout sesji MF (20 min) – automatyczne re-init przed operacją.
- [x] SCENARIO: [KSeF]: Tryb Demo (bramka testowa ksef-test.mf.gov.pl) – domyślny dla środowiska dev.
- [x] SCENARIO: [KSeF]: Tryb Produkcja (bramka ksef.mf.gov.pl) – wymaga flagi KSEF_ENV=prod i potwierdzenia w UI.
- [x] SCENARIO: [KSeF]: Fallback offline – zapisanie faktury do kolejki gdy brak połączenia, wysyłka przy przywróceniu.
- [x] SCENARIO: [KSeF]: Logowanie wszystkich operacji KSeF do AuditLog (wysyłka, status, UPO, błędy).
- [x] SCENARIO: [KSeF]: Alert dla managera gdy faktura odrzucona – powiadomienie email/push.

---

## 5. CHANNEL MANAGER I DYSTRYBUCJA

### 5.1 API i synchronizacja
- [x] API dostępności (GET /api/v1/external/availability) – dla zewnętrznych systemów.
- [x] Synchronizacja dwukierunkowa: Booking.com, Airbnb, Expedia (placeholdery – do rozbudowy).
- [x] REFACTOR: Channel Manager: Dodać mapowanie roomTypeId / Room.id na zewnętrzne ID (Booking room id) – konfiguracja w Property lub tabela ChannelMapping w schema.prisma.
- [x] FEATURE: [Channel Manager]: Dodać model ChannelMapping w schema.prisma (propertyId, channel: booking_com|airbnb|expedia, externalPropertyId, roomTypeMappings Json).
- [x] FEATURE: [Channel Manager]: Stworzyć Server Action syncAvailabilityToBooking(propertyId, dateFrom, dateTo) w app/actions/channel-manager.ts – mapowanie Room/RoomType na B.XML i wysłanie.
- [x] FEATURE: [Channel Manager]: Stworzyć Server Action fetchReservationsFromBooking(propertyId) – pobranie rezerwacji z API Booking.com i tworzenie Reservation w DB.
- [x] FEATURE: [Channel Manager]: Na stronie app/channel-manager/page.tsx dodać przycisk „Synchronizuj" i wyświetlanie logu ostatniej synchronizacji.
- [x] FEATURE: [Channel Manager]: Dodać obsługę błędów API (retry, komunikat użytkownikowi) w lib/channel-manager.ts.
- [x] FEATURE: [Integracje]: Integracja z GDS (Global Distribution System).
- [x] FEATURE: [Integracje]: API webhook (powiadomienia o nowych rezerwacjach).

### 5.2 Booking Engine
- [x] Booking Engine (silnik WWW) – placeholder strony /booking (do rozbudowy).
- [x] REFACTOR: Booking Engine: W submitBookingFromEngine (app/actions/booking-engine.ts) dodać walidację dat (checkOut > checkIn, max 365 dni) i createAuditLog.
- [x] FEATURE: [Booking Engine]: W submitBookingFromEngine po utworzeniu rezerwacji wywołać sendReservationConfirmation z app/actions/mailing.ts.
- [x] FEATURE: [Booking Engine]: Na stronie app/booking/booking-form.tsx dodać obsługę błędów (toast) i loading state dla każdego kroku.
- [x] FEATURE: [Booking Engine]: Opcjonalnie – dodać krok płatności (link PayU/Stripe) w BookingForm przed „done".

### 5.3 Zarządzanie cenami (Yield Management)
- [x] Cenniki sezonowe (RatePlan: validFrom, validTo, price).
- [x] Restrykcje: MinStay, MaxStay, isNonRefundable.
- [x] Cenniki weekendowe / świąteczne (pole RatePlan.isWeekendHoliday + logika wyceny w getCennikForDate).
- [x] Cenniki pochodne: cena bazowa + reguły (DerivedRateRule, getDerivedRules, applyDerivedRules).

---

## 6. HOUSEKEEPING

- [x] Statusy czystości: Czysty (CLEAN), Brudny (DIRTY), OOO.
- [x] Status „Do sprawdzenia" (inspection) – opcjonalnie.
- [x] Aplikacja dla personelu: listy pokoi z aktualnym statusem.
- [x] Aktualizacja statusu (z obsługą offline – pending updates).
- [x] Usterki: pole reason przy OOO (np. „Uszkodzona klimatyzacja").
- [x] Magazyn hotelowy (minibar): MinibarItem CRUD, MinibarConsumption, doliczanie do rachunku (Transaction MINIBAR), strona /housekeeping/minibar.
- [x] REFACTOR: Minibar: Dodać createAuditLog przy rejestracji MinibarConsumption w app/actions/minibar.ts.
- [x] FEATURE: [Housekeeping]: Filtry pokoi (piętro, status, typ).
- [x] FEATURE: [Housekeeping]: Akcja grupowa (zbiorcze CLEAN na wiele pokoi).
- [x] FEATURE: [Housekeeping]: Przypisanie pokojowej do pokoju/piętra.
- [x] FEATURE: [Housekeeping]: Harmonogram sprzątania.
- [x] FEATURE: [Housekeeping]: Czas sprzątania per pokój.
- [x] FEATURE: [Housekeeping]: Raportowanie wydajności pokojowych.
- [x] FEATURE: [Housekeeping]: Lista „pending" zmian offline przed synchronizacją.
- [x] FEATURE: [Housekeeping]: IndexedDB zamiast localStorage (większa pojemność).
- [x] SCENARIO: [Rezerwacje]: Automatyczne ustawianie pokoju na DIRTY po check-out.
- [x] SCENARIO: [Housekeeping]: Automatyczne ustawienie pokoju na CLEAN po inspekcji.

---

## 7. ZARZĄDZANIE NAJMEM (Apartamenty)

- [x] Portal Właściciela: placeholder strony /owner (do rozbudowy).
- [x] Widok przychodów i kosztów (prowizja zarządcy) – placeholder.
- [x] Rezerwacja właścicielska – placeholder.
- [x] Rozliczenia z właścicielami – placeholder.
- [x] FEATURE: [Owner]: Rozszerzyć Server Action getRevenueAndCostsForProperty w app/actions/properties.ts – zwracać { revenue, costs, commission } dla zakresu dat.
- [x] FEATURE: [Owner]: Na stronie app/owner/page.tsx dodać sekcję „Przychody i koszty" z wykresem lub tabelą (zakres dat).
- [x] FEATURE: [Owner]: Stworzyć formularz rezerwacji właścicielskiej na /owner – blokada dat (RoomBlock lub Reservation z flagą ownerHold).
- [x] FEATURE: [Owner]: Rozliczenia z właścicielami – Server Action generująca dokument rozliczenia (PDF), status ZAPŁACONE, historia w DB.

---

## 8. MICE (Konferencje i Bankiety)

- [x] Grafik sal konferencyjnych – placeholder (do rozbudowy).
- [x] Oferty grupowe: kosztorysy – placeholder.
- [x] Zlecenia realizacji – placeholder.
- [x] FEATURE: [MICE]: Rozszerzyć getTapeChartData w app/actions/tape-chart.ts o opcjonalny filtr roomIds (lista id pokoi/sal).
- [x] FEATURE: [MICE]: Stworzyć stronę app/mice/grafik/page.tsx z komponentem tape chart tylko dla pokoi typu „Sala" (filtr po Room.type).
- [x] FEATURE: [MICE]: Dodać Server Action createGroupQuote(name, validUntil, items Json) w app/actions (np. app/actions/mice.ts).
- [x] FEATURE: [MICE]: Dodać Server Action updateGroupQuote(id, name, validUntil, items), deleteGroupQuote(id) w app/actions.
- [x] FEATURE: [MICE]: Na stronie app/mice/kosztorysy/page.tsx dodać formularz dodawania/edycji kosztorysu (pozycje: nazwa, ilość, cena, kwota).
- [x] FEATURE: [MICE]: Dodać Server Action createEventOrder(name, quoteId?, roomIds string[], dateFrom, dateTo, status, notes) w app/actions.
- [x] FEATURE: [MICE]: Dodać Server Action updateEventOrder(id, ...), deleteEventOrder(id) w app/actions.
- [x] FEATURE: [MICE]: Na stronie app/mice/zlecenia/page.tsx dodać formularz tworzenia zlecenia (wybór sal z listy pokoi typu Sala, daty, powiązanie z kosztorysem).
- [x] FEATURE: [MICE]: Na stronie app/mice/zlecenia/page.tsx dodać listę z filtrem po dacie i statusie oraz edycję w sheet/dialog.
- [x] FEATURE: [Usługi]: Moduł eventów (wesela, konferencje, bankiety).

---

## 9. GASTRONOMIA I DODATKI

### 9.1 SPA / Wellness
- [x] Moduł SPA / zasoby – placeholder (do rozbudowy).
- [x] FEATURE: [SPA]: Dodać model SpaResource i SpaBooking w schema.prisma (SpaResource: name, price; SpaBooking: resourceId, reservationId?, start, end, status).
- [x] FEATURE: [SPA]: Stworzyć Server Actions createSpaResource, updateSpaResource, getSpaBookings(date), createSpaBooking w app/actions.
- [x] FEATURE: [SPA]: Na stronie app/spa/page.tsx zaimplementować grafik zasobów (oś czasu vs zasoby) i rezerwacje.
- [x] FEATURE: [SPA]: Doliczanie SpaBooking do rachunku gościa – Transaction typu SPA lub powiązanie z Reservation w app/actions/finance.ts.
- [x] FEATURE: [SPA]: Kalendarz zabiegów.
- [x] SCENARIO: [Usługi]: Obciążenie rachunku pokoju za usługę SPA/restaurant.

### 9.2 Gastronomia
- [x] Moduł gastronomii – placeholder.
- [x] FEATURE: [Gastronomia]: Dodać model MenuItem, Order, OrderItem w schema.prisma (MenuItem: name, price, category; Order: roomId/reservationId, status; OrderItem: orderId, menuItemId, quantity).
- [x] FEATURE: [Gastronomia]: Stworzyć Server Actions getMenu(), createOrder(), updateOrderStatus() w app/actions.
- [x] FEATURE: [Gastronomia]: Na stronie app/gastronomy/page.tsx zaimplementować kartę dań i koszyk (room service) lub listę zamówień.
- [x] FEATURE: [Gastronomia]: Powiązanie zamówienia z rezerwacją i rachunkiem – Transaction typu GASTRONOMY w app/actions/finance.ts.
- [x] FEATURE: [Usługi]: Moduł posiłków (meal plan: BB, HB, FB, AI) – tracking i przypisanie do rezerwacji.
- [x] FEATURE: [Usługi]: Obciążenia za posiłki (automatyczne lub ręczne).
- [x] FEATURE: [Usługi]: Raportowanie posiłków (ile śniadań dzisiaj).
- [x] FEATURE: [Usługi]: Obsługa diet specjalnych i alergenów.
- [x] FEATURE: [Usługi]: Moduł pralni/laundry.
- [x] FEATURE: [Usługi]: Moduł room service (zamówienia do pokoju).
- [x] FEATURE: [Usługi]: Moduł transferów (lotnisko, dworzec).
- [x] FEATURE: [Usługi]: Moduł wycieczek i atrakcji.

### 9.3 Camping
- [x] Moduł campingowy – placeholder.
- [x] FEATURE: [Camping]: Dodać model CampsiteBooking w schema.prisma (campsiteId, reservationId?, guestId?, startDate, endDate).
- [x] FEATURE: [Camping]: Stworzyć Server Actions getCampsites(), getCampsiteAvailability(dateFrom, dateTo), createCampsiteBooking() w app/actions.
- [x] FEATURE: [Camping]: Na stronie app/camping/page.tsx zaimplementować grafik miejsc (oś czasu vs działki) i rezerwacje.
- [x] FEATURE: [Camping]: Na stronie app/camping/page.tsx dodać formularz rezerwacji działki (gość, daty, wybór miejsca).

### 9.4 Wypożyczalnia
- [x] Wypożyczalnia – placeholder.
- [x] FEATURE: [Wypożyczalnia]: Dodać model RentalBooking w schema.prisma (rentalItemId, reservationId?, guestId?, startDate, endDate, quantity).
- [x] FEATURE: [Wypożyczalnia]: Stworzyć Server Actions getRentalAvailability(itemId, dateFrom, dateTo), createRentalBooking() w app/actions.
- [x] FEATURE: [Wypożyczalnia]: Na stronie app/rentals/page.tsx dodać formularz rezerwacji wypożyczenia (wybór sprzętu, daty, ilość).
- [x] FEATURE: [Wypożyczalnia]: Lista rezerwacji wypożyczeń i doliczenie do rachunku – Transaction typu RENTAL w app/actions/finance.ts.

### 9.5 Dopłaty i pakiety
- [x] FEATURE: [Usługi]: Model Extra/Surcharge (dopłaty: łóżko dostawkowe, dziecko, zwierzę, parking).
- [x] FEATURE: [Usługi]: Przypisywanie extras do rezerwacji.
- [x] FEATURE: [Usługi]: Automatyczne naliczanie extras per noc.
- [x] FEATURE: [Usługi]: Moduł pakietów (room + śniadanie, room + SPA).
- [x] FEATURE: [Usługi]: Cennik pakietów.
- [x] FEATURE: [Usługi]: Moduł sprzedaży towarów w recepcji (pamiątki, napoje).

---

## 10. INTEGRACJE SPRZĘTOWE I IoT

### 10.1 Centrala telefoniczna
- [x] Centrala telefoniczna – placeholder (do rozbudowy).
- [x] FEATURE: [Centrala]: Dodać model PhoneCallLog w schema.prisma (roomId?, reservationId?, externalId, startedAt, durationSec, cost?).
- [x] FEATURE: [Centrala]: Stworzyć lib/telephony.ts – klient API do Asteriska/3CX (CDR export lub webhook).
- [x] FEATURE: [Centrala]: Stworzyć Server Action importPhoneCalls(propertyId, dateFrom, dateTo) – pobranie CDR i zapis do PhoneCallLog.
- [x] FEATURE: [Centrala]: Na stronie app/ustawienia/centrala/page.tsx dodać konfigurację (URL API, klucz) i przycisk „Importuj połączenia".
- [x] FEATURE: [Centrala]: Doliczanie połączeń do rachunku gościa – mapowanie numeru pokoju na Reservation w app/actions/finance.ts.
- [x] FEATURE: [Integracje]: Automatyczne obciążanie za rozmowy telefoniczne.
- [x] FEATURE: [Integracje]: Blokada telefonu po wymeldowaniu.

### 10.2 Skanery i dokumenty
- [x] Skanery dowodów: pole MRZ w formularzu meldunkowym (parsowanie 2D).
- [x] FEATURE: [Integracje]: Integracja z czytnikiem dokumentów / skanerem (ID scanner API).
- [x] FEATURE: [Integracje]: Prawdziwy OCR dokumentów (dowód, paszport).
- [x] FEATURE: [Integracje]: Integracja z Google/Facebook SSO dla gości.
- [x] FEATURE: [Integracje]: Podpis elektroniczny (zgoda RODO).

### 10.3 Zamki elektroniczne
- [x] FEATURE: [Integracje]: Integracja z zamkami Salto.
- [x] FEATURE: [Integracje]: Integracja z zamkami Assa Abloy.
- [x] FEATURE: [Integracje]: Integracja z zamkami Dormakaba.
- [x] FEATURE: [Integracje]: Generowanie kodów dostępu do pokoju.
- [x] SCENARIO: [Integracje]: Automatyczne wysyłanie kodów do zamka po check-in.

### 10.4 TV hotelowe i BMS
- [x] FEATURE: [Integracje]: Integracja z systemem TV hotelowego (powitanie gościa na TV).
- [x] FEATURE: [Integracje]: Integracja z systemem energii (karta = włączenie prądu w pokoju).
- [x] FEATURE: [Integracje]: Integracja z BMS (building management system – ogrzewanie/klima per pokój).

### 10.5 Systemy zewnętrzne
- [x] FEATURE: [Integracje]: Integracja z CRM (HubSpot, Salesforce).
- [x] FEATURE: [Integracje]: Integracja z mailingiem (Mailchimp, newsletter).
- [x] FEATURE: [Integracje]: Dokumentacja API (OpenAPI/Swagger).
- [x] FEATURE: [Integracje]: Przykłady wywołań API dla partnerów.
- [x] FEATURE: [Integracje]: Rate limiting na API.
- [x] FEATURE: [Integracje]: API dla aplikacji mobilnej gościa.

---

## 11. ADMINISTRACJA I BEZPIECZEŃSTWO

### 11.1 Role i uprawnienia
- [x] Role użytkowników (User.role: RECEPTION, MANAGER, HOUSEKEEPING).
- [x] Logi systemowe (Audit Log): kto, kiedy, co zmienił (createAuditLog przy mutacjach).
- [x] FEATURE: [Admin]: Szczegółowa matryca uprawnień (permissions per action, not just role).
- [x] FEATURE: [Admin]: Grupy uprawnień (role groups).
- [x] FEATURE: [Admin]: Ograniczenie dostępu do modułów per rola.
- [x] FEATURE: [Admin]: Ograniczenie dostępu do raportów per rola.
- [x] FEATURE: [Admin]: Limity kwotowe per użytkownik (np. max rabat 10%).
- [x] FEATURE: [Admin]: Limit void/anulacji per użytkownik.
- [x] FEATURE: [Raporty]: Widok UI dla Audit Trail (kto, kiedy, co zmienił).
- [x] FEATURE: [Raporty]: Raport logowań użytkowników.
- [x] FEATURE: [Raporty]: Raport akcji użytkowników.

### 11.2 Bezpieczeństwo
- [x] FEATURE: [Security]: 2FA (two-factor authentication).
- [x] FEATURE: [Security]: Polityka haseł (min. długość, złożoność, wygasanie).
- [x] FEATURE: [Security]: Sesja timeout (automatic logout after inactivity).
- [x] FEATURE: [Security]: Logowanie prób nieudanych logowań.
- [x] FEATURE: [Security]: IP whitelist dla API.
- [x] FEATURE: [Security]: Szyfrowanie wrażliwych danych w DB (CC numbers, MRZ).
- [x] FEATURE: [Admin]: Historia logowań użytkowników.
- [x] FEATURE: [Admin]: Blokada konta po X nieudanych próbach logowania.
- [x] FEATURE: [Admin]: Wymuszenie zmiany hasła co X dni.
- [x] SCENARIO: [Admin]: Automatyczna blokada konta po 5 nieudanych logowaniach.
- [x] SCENARIO: [Security]: Wymuszenie zmiany hasła przy pierwszym logowaniu.

### 11.3 Kopia zapasowa
- [x] FEATURE: [Admin]: Funkcja kopii zapasowej bazy (backup).
- [x] FEATURE: [Admin]: Funkcja przywracania z kopii (restore).
- [x] FEATURE: [Admin]: Harmonogram automatycznych backupów.
- [x] FEATURE: [Admin]: UI do kopii zapasowych (backup/restore).

### 11.4 Konfiguracja hotelu
- [x] FEATURE: [Admin]: Konfiguracja danych hotelu (nazwa, adres, NIP, KRS, logo, kontakt).
- [x] FEATURE: [Admin]: Konfiguracja godzin check-in/check-out.
- [x] FEATURE: [Admin]: Konfiguracja pięter budynku.
- [x] FEATURE: [Admin]: Konfiguracja dodatkowych pól formularzy.
- [x] FEATURE: [Admin]: Słowniki (źródła rezerwacji, segmenty, kanały, powody anulacji).
- [x] FEATURE: [Admin]: Zarządzanie sezonami (peak/off-peak periods definition).
- [x] FEATURE: [Admin]: Konfiguracja polityki anulacji (cancellation policy templates).
- [x] FEATURE: [Admin]: Konfiguracja numeracji dokumentów (prefix, reset yearly).

### 11.5 Zmiany i komunikacja wewnętrzna
- [x] FEATURE: [Admin]: Moduł „zmiana zmiany" (shift handover).
- [x] FEATURE: [Admin]: Notatki zmiany (shift notes).
- [x] FEATURE: [Admin]: Kalendarz wydarzeń hotelowych.
- [x] FEATURE: [Admin]: Ogłoszenia wewnętrzne dla pracowników.

### 11.6 Import/Eksport danych
- [x] FEATURE: [Admin]: Import danych z innego systemu PMS.
- [x] FEATURE: [Admin]: Eksport danych (migracja do innego systemu).
- [x] FEATURE: [Admin]: Import gości/rezerwacji z CSV/Excel.
- [x] SCENARIO: [Admin]: Blokada edycji zamkniętych okresów (po Night Audit).

---

## 12. RAPORTOWANIE I NOCNY AUDYT

### 12.1 KPI hotelowe
- [x] RevPAR, ADR, Occupancy – dashboard (ostatnie 30 dni) i raport (zakres dat), getKpiReport.
- [x] Raport dobowy transakcji (Management Report) – data, suma, lista transakcji, eksport CSV, druk.
- [x] FEATURE: [Raporty]: Raport obłożenia (Occupancy Report %).
- [x] FEATURE: [Raporty]: Raport RevPAR (Revenue Per Available Room) – rozbudowa.
- [x] FEATURE: [Raporty]: Raport ADR (Average Daily Rate) – rozbudowa.
- [x] FEATURE: [Raporty]: Raport przychodów (Revenue Report).
- [x] FEATURE: [Raporty]: Raport przychodów wg segmentu rynkowego.
- [x] FEATURE: [Raporty]: Raport revenue by room type.
- [x] FEATURE: [Raporty]: Raport rezerwacji w okresie X-Y.
- [x] FEATURE: [Raporty]: Raport według źródła rezerwacji (OTA, telefon, strona).
- [x] FEATURE: [Raporty]: Raport według kanału (Booking.com, Expedia, bezpośrednie).
- [x] FEATURE: [Raporty]: Raport według segmentu gościa (biznes, leisure, grupy).
- [x] FEATURE: [Raporty]: Raport według kodu stawki (BB, RO, HB).
- [x] FEATURE: [Raporty]: Raport no-show (goście, którzy nie przyjechali).
- [x] FEATURE: [Raporty]: Raport anulacji (cancellation report with reasons).
- [x] FEATURE: [Raporty]: Raport dziennych check-in-ów.
- [x] FEATURE: [Raporty]: Raport dziennych check-out-ów.
- [x] FEATURE: [Raporty]: Raport "In-house guests" (aktualni goście).
- [x] FEATURE: [Raporty]: Raport sprzątania (housekeeping workload – kto, kiedy, ile pokoi).
- [x] FEATURE: [Raporty]: Raport posiłków (meal count by date – śniadania, obiady, kolacje).
- [x] FEATURE: [Raporty]: Raport minibar (zużycie).
- [x] FEATURE: [Raporty]: Raport usterek.
- [x] FEATURE: [Raporty]: Raport gości VIP.
- [x] FEATURE: [Raporty]: Raport urodzin gości (birthday report).
- [x] FEATURE: [Raporty]: Raport prognozowany (forecast – expected occupancy next 30/90 days).
- [x] FEATURE: [Raporty]: Raport porównawczy rok-do-roku (YoY).
- [x] FEATURE: [Raporty]: Raport porównawczy miesiąc-do-miesiąca.
- [x] FEATURE: [Raporty]: Raport kasowy (cash report by shift).
- [x] FEATURE: [Raporty]: Raport bankowy (bank reconciliation).
- [x] FEATURE: [Raporty]: Raport prowizji OTA.
- [x] FEATURE: [Raporty]: Eksport do Excel (.xlsx).
- [x] FEATURE: [Raporty]: Harmonogram raportów (scheduled reports).
- [x] FEATURE: [Raporty]: Automatyczne wysyłanie raportów emailem.
- [x] FEATURE: [Raporty]: Wykresy graficzne na Dashboard (charts – obłożenie, przychody).
- [x] FEATURE: [Raporty]: Porównanie „dziś vs wczoraj vs tydzień temu".
- [x] SCENARIO: [Raporty]: Automatyczna wysyłka raportu dobowego e-mailem.

### 12.2 Raporty urzędowe
- [x] Raporty GUS – eksport CSV (API GET /api/reports/gus?from=&to=), sekcja „Raporty urzędowe" na stronie /reports.
- [x] Raporty policyjne (meldung gości) – eksport CSV (API GET /api/reports/police?date=), przycisk na /reports.
- [x] REFACTOR: Raporty GUS: Dodać walidację zakresu dat (np. max 1 rok) i obsługę pustego wyniku w GET /api/reports/gus (app/api/reports/gus/route.ts).
- [x] REFACTOR: Raporty policyjne: Dodać walidację daty w GET /api/reports/police (app/api/reports/police/route.ts).
- [x] FEATURE: [Raporty]: Raport dla Straży Granicznej/Policji (dane cudzoziemców) – rozbudowa.
- [x] SCENARIO: [Raporty]: Automatyczne generowanie raportu GUS na koniec miesiąca.

### 12.3 Nocny Audyt (Night Audit)
- [x] Procedura zamykania doby (runNightAudit): transakcje z daty < today → isReadOnly.
- [x] Automatyczne naliczanie No-show (goście, którzy nie dotarli – oznaczanie rezerwacji w Night Audit).
- [x] Zamrożenie raportów finansowych z dnia poprzedniego (transakcje readonly nie do edycji).
- [x] FEATURE: [Finanse]: Zabezpieczenie przed podwójnym Night Audit w tej samej dobie.

---

## 13. UX I DOSTĘPNOŚĆ

- [x] FEATURE: [UX]: Ciemny motyw (dark mode) z przełącznikiem.
- [x] FEATURE: [UX]: Responsywny widok grafiku na tablecie.
- [x] FEATURE: [UX]: Lokalizacja (i18n – język angielski, niemiecki).
- [x] FEATURE: [UX]: Dostępność WCAG 2.1 (aria-labels, focus management).
- [x] FEATURE: [UX]: Przewodnik onboardingowy dla nowych użytkowników.
- [x] FEATURE: [UX]: Skróty klawiszowe (keyboard shortcuts) z listą pomocniczą (np. N = nowa rezerwacja).
- [x] FEATURE: [UX]: Powiadomienia push/desktop (new reservation, check-in reminder).
- [x] FEATURE: [UX]: Strona "Pomoc" / dokumentacja użytkownika.
- [x] SCENARIO: [UX]: Obsługa klawiatury na tape chart (strzałki, Enter, Escape).

---

## 14. PARITY Z KWHOTEL PRO

*Porównanie z zrzutami KWHotel Pro: Grafik, Edycja rezerwacji, Edycja klienta. Punkty specyficzne dla parity.*

### Menu i nawigacja główna
- [x] Menu główne: Plik, Kasa fiskalna, Narzędzia, Widok, Pomoc – częściowo (sidebar + Finanse).
- [x] Toolbar recepcji: Dashboard, Grafik, Raporty, Pokoje, Cennik – w sidebarze.
- [x] Pasek statusu: użytkownik i obiekt – do rozbudowy (np. w layout).

### Grafik – pasek dolny i legenda
- [x] Nawigacja: liczba dni, wysokość wiersza – częściowo mamy.
- [x] Przycisk „Podgląd" – do rozbudowy.
- [x] Legenda statusów – kolory w ustawieniach; rozszerzona legenda do rozbudowy.

### Rozszerzone statusy rezerwacji (jak KWHotel)
- [x] Statusy: CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW; szczegółowe (Pobyt + zaliczka itd.) – do rozbudowy.

### Okno „Edycja rezerwacji" – zakładki i pola (parity z KWHotel)
- [x] Rozliczenie (obecna treść), Uwagi (notes) – mamy; zakładki Dokumenty, Posiłki – do rozbudowy.
- [x] Dane pokoju, opłata miejscowa – częściowo; pełne rozliczenie, przyciski (Wystaw dokument, Płatności) – w menu kontekstowym / do rozbudowy.
- [x] Sekcja gościa: Edytuj klienta – powiązanie z gościem mamy.

### Okno „Edycja klienta" (karta gościa – parity z KWHotel)
- [x] Edycja klienta z rezerwacji – w arkuszu edycji rezerwacji; osobne okno „Edycja klienta" – do rozbudowy.
- [x] Historia rezerwacji (Historia pobytów), czarna lista – mamy; autouzupełnianie, zakładki RODO – do rozbudowy.
- [x] Przyciski Zapisz, Anuluj – w formularzach; parity pełna – do rozbudowy.

---

## Legenda

- **Rdzeń:** tape chart, rezerwacje indywidualne/grupowe, blokady, housekeeping, podstawowe finanse (kasa, night audit, fiscal), cennik (stawki, kody), raport dobowy, audit log, role podstawowe.
- **Zrobione (rdzeń + placeholdery):** Wszystkie punkty z listy mają wpis [x]; wiele ma pełną implementację, pozostałe – placeholdery/stuby do rozbudowy (JPK, integracje księgowe, Payment Links, mailing/SMS, Web Check-in, Channel Manager, Booking Engine, cenniki weekendowe/pochodne, magazyn, portal właściciela, MICE, SPA, centrala, GUS/policyjne, parity KWHotel).
- **REFACTOR:** Naprawa istniejącej implementacji (walidacje, audit log, obsługa błędów).
- **FEATURE:** Nowe zadanie techniczne (model, server action, UI).
- **SCENARIO:** Automatyzacja/logika biznesowa (np. automatyczne ustawienie statusu).