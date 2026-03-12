# Flow meldowania i wymeldowania

**Dokument:** checkin_checkout_flow.md  
**Przeznaczenie:** Materiał szkoleniowy AI — opis zachowania systemu przy check-in, płatnościach, wymeldowaniu, sprzątaniu i statusach pokoi.

---

## 1. Meldowanie gościa

### Przebieg krok po kroku

1. **Znalezienie rezerwacji** — recepcjonista otwiera rezerwację:
   - z Tape Chart (klik w pasek),
   - z listy przyjazdów (np. Dashboard),
   - z księgi meldunkowej (filtry: Przyjazdy, dziś),
   - po numerze potwierdzenia.

2. **Weryfikacja** — sprawdzenie, czy rezerwacja ma status CONFIRMED (potwierdzona). Tylko taka może być zameldowana.

3. **Formularz meldunkowy** — w zakładce **Meldunek** w oknie rezerwacji lub na stronie **Check-in** (`/check-in`):
   - dane osobowe (imię, nazwisko, data urodzenia),
   - dokument tożsamości (typ, numer, data ważności),
   - adres zamieszkania, obywatelstwo, cel pobytu,
   - opcjonalnie: dane firmy (NIP) dla faktury VAT,
   - pola niestandardowe (np. zgody, informacje dodatkowe).

4. **Opcje ułatwiające wypełnienie:**
   - **Skan MRZ** — skan dokumentu (dowód, paszport), system odczytuje pasek MRZ (Machine Readable Zone) i wypełnia pola,
   - **Parse & Forget** — wgranie zdjęcia dowodu, OCR wypełnia pola, plik nie jest zapisywany (RODO),
   - wyszukanie gościa — system dopasowuje istniejącego gościa i uzupełnia dane.

5. **Kliknięcie „Zamelduj”** — system:
   - zmienia status rezerwacji na **CHECKED_IN**,
   - opcjonalnie generuje **kod dostępu** (cyfrowy klucz do drzwi),
   - aktualizuje profil gościa (totalStays, lastStayDate),
   - uruchamia integracje (np. powitanie na TV, aktywacja zasilania pokoju).

### Inne ścieżki meldunku

- **Walk-in** — gość bez rezerwacji: tworzy się rezerwacja i od razu meldunek (status CHECKED_IN).
- **Web Check-in** — gość wypełnia formularz online (link w mailu), podpisuje kartę meldunkową; recepcja weryfikuje i wydaje klucz.
- **Kiosk** — gość melduje się przy automacie (jeśli hotel ma kiosk), system zmienia status na CHECKED_IN po podpisie.

### Wymagania i ograniczenia

- Meldunek możliwy **w dniu przyjazdu** lub dzień wcześniej (np. w kiosku).
- Pokój powinien mieć status CLEAN; jeśli DIRTY — system może ostrzegać (gość może być zameldowany mimo tego).
- Gość na **czarnej liście** — system wyświetla ostrzeżenie, ale nie blokuje meldunku; decyzja należy do recepcji.

---

## 2. Pobieranie płatności

### Rodzaje transakcji

- **PAYMENT** — wpłata (gotówka, karta, przelew),
- **DEPOSIT** — zaliczka,
- **Kaucja (security deposit)** — zabezpieczenie zwalniane przy wymeldowaniu.

### Metody płatności

- **CASH** — gotówka,
- **CARD** — karta płatnicza (Visa, Mastercard, Amex itd.),
- **TRANSFER** — przelew,
- **SPLIT** — płatność mieszana (np. część gotówką, część kartą).

### Przebieg pobierania płatności

1. **Otwarcie rezerwacji** — zakładka **Rozliczenie** (settlement) w oknie rezerwacji.

2. **Sprawdzenie salda folio** — suma obciążeń minus wpłaty = kwota do zapłaty.

3. **Rejestracja wpłaty:**
   - wybór kwoty (pełna lub częściowa),
   - wybór metody płatności,
   - opcjonalnie: szczegóły (numer autoryzacji, opis),
   - zapis — transakcja trafia do folio rezerwacji.

4. **Dla płatności SPLIT** — podanie podziału (np. 200 PLN gotówką, 300 PLN kartą).

5. **Paragon / faktura** — po wpłacie można wydrukować paragon lub wystawić fakturę (np. dla firm).

### Kiedy pobierać

- **Przy meldunku** — zaliczka, pełna opłata, gwarancja kartą.
- **W trakcie pobytu** — minibar, SPA, restauracja, inne usługi (obciążenia na folio).
- **Przy wymeldowaniu** — saldo do zapłaty.

### Integracje

- **Karta kredytowa** — preautoryzacja przy check-in, capture przy check-out.
- **Link do płatności** — gość może zapłacić online (np. zaliczkę) przed przyjazdem.
- **Drukarka fiskalna** — paragon fiskalny przy płatności gotówką (jeśli skonfigurowana).

---

## 3. Wydanie klucza

### Klucz fizyczny (klucz / karta RFID)

System **nie zarządza** fizycznymi kluczami. Procedura po stronie recepcji:

1. Po meldunku recepcjonista wręcza gościowi klucz lub kartę dostępu.
2. Klucz jest przypisany do pokoju (ręcznie, poza systemem).
3. Przy wymeldowaniu gość oddaje klucz; recepcja odbiera go i przygotowuje dla kolejnego gościa.

### Cyfrowy klucz (kod dostępu)

Jeśli hotel ma **inteligentne zamki** zintegrowane z systemem:

1. Przy meldunku system generuje **kod dostępu** do pokoju.
2. Kod jest ważny w okresie pobytu (check-in — check-out).
3. Gość widzi kod w aplikacji gościa (`/guest-app/[token]`) lub otrzymuje go w wiadomości.
4. Przy wymeldowaniu kod traci ważność.

### Co przekazać gościowi

- numer pokoju,
- piętro, kierunek (np. „windą na 2. piętro, w lewo”),
- godziny śniadania / restauracji,
- zasady hotelu (cisza nocna, checkout do godz. X),
- kod WiFi (jeśli dotyczy).

---

## 4. Wymeldowanie

### Przebieg krok po kroku

1. **Otwarcie rezerwacji** — rezerwacja ze statusem CHECKED_IN.

2. **Sprawdzenie folio** — suma obciążeń vs wpłaty:
   - **Saldo = 0** — wymeldowanie bez dodatkowych kroków.
   - **Saldo > 0** — gość ma do zapłaty; recepcjonista przyjmuje płatność przed check-outem.
   - **Saldo < 0** — nadpłata; możliwy zwrot lub pozostawienie jako zaliczka na przyszłość.

3. **Kliknięcie „Wymelduj” (Check-out)** — system:
   - zmienia status rezerwacji na **CHECKED_OUT**,
   - zmienia status pokoju na **DIRTY** (do sprzątania),
   - aktualizuje statystyki gościa (totalStays, lastStayDate),
   - nalicza brakujące obciążenia (np. nocleg, opłata miejscowa) — jeśli audyt nocny nie zrobił tego wcześniej,
   - opcjonalnie: tworzy fakturę VAT (dla firm),
   - zwalnia kaucję (jeśli była pobrana),
   - dezaktywuje zasilanie / cyfrowy klucz w pokoju.

4. **Dokumenty** — po wymeldowaniu: paragon, faktura lub proforma (jeśli gość potrzebuje).

### Express Check-out

Dla gości z kartą kredytową:
- Karta zostaje przy check-in (preautoryzacja).
- Przy check-out system automatycznie obciąża kartę na saldo.
- Faktura może być wysłana emailem.

### Late check-out

Jeśli gość zostaje dłużej:
- Edycja rezerwacji — zmiana daty wyjazdu.
- System naliczy dodatkowe noce i ewentualną opłatę za późne wymeldowanie (jeśli skonfigurowana).

---

## 5. Sprzątanie pokoju

### Przebieg w Housekeeping

1. **Panel Housekeeping** (`/housekeeping`) — lista pokojów z aktualnymi statusami.

2. **Przypisanie pokoju** — pokojowa widzi pokoje do sprzątania (status DIRTY lub CHECKOUT_PENDING).

3. **Priorytety sprzątania** (opcjonalnie):
   - VIP_ARRIVAL — VIP przyjeżdża dziś,
   - DEPARTURE — gość wyjeżdża dziś (pilne),
   - STAY_OVER — gość zostaje (mniejsze sprzątanie),
   - NORMAL — standard.

4. **Sprzątanie** — pokojowa wykonuje prace, po zakończeniu:
   - zmienia status na **INSPECTION** (do sprawdzenia) — jeśli hotel ma inspekcję,
   - lub od razu na **CLEAN** — jeśli brak inspekcji.

5. **Inspekcja** (opcjonalnie) — kierownik sprawdza pokój:
   - **INSPECTION** → **INSPECTED** lub **DIRTY** (jeśli wymaga ponownego sprzątania).

6. **Gotowość** — status **CLEAN** lub **INSPECTED** oznacza pokój gotowy do zameldowania.

### Harmonogram sprzątania

- System może generować **dzienny harmonogram sprzątania** na podstawie przyjazdów i wyjazdów.
- Pokojowe mogą być przypisane do pięter.
- Tryb offline — dane zapisywane lokalnie (np. na tablecie), synchronizacja po powrocie do sieci.

### Minibar i pralnia

- **Minibar** — pokojowa zaznacza zużyte produkty; system dolicza opłaty do folio gościa.
- **Pranie** — zlecenia prania, opłata na folio.

---

## 6. Statusy pokoi

| Status | Opis | Znaczenie dla recepcji |
|--------|------|------------------------|
| **CLEAN** | Czysty, gotowy | Pokój można przypisać nowemu gościowi |
| **DIRTY** | Do sprzątania | Pokój zajęty lub zwolniony, wymaga sprzątania |
| **INSPECTION** | Do sprawdzenia | Posprzątany, czeka na kontrolę |
| **INSPECTED** | Sprawdzony | Gotowy do zameldowania |
| **CHECKOUT_PENDING** | Oczekuje wymeldowania | Gość powinien dziś wyjechać |
| **OOO** (Out of Order) | Wyłączony | Nie można rezerwować (usterka, remont) |
| **MAINTENANCE** | Do naprawy | Wymaga interwencji technicznej |

### Automatyczne zmiany statusu

- **Check-out** → pokój zmienia się na **DIRTY**.
- **Zgłoszenie usterki** (Housekeeping) → pokój może być oznaczony jako **OOO**.
- **Sprzątanie zakończone** → **DIRTY** → **CLEAN** (lub **INSPECTION**).

### Ograniczenia przy rezerwacji

- **OOO** — całkowita blokada przypisania rezerwacji.
- **DIRTY** — zazwyczaj ostrzeżenie (recepcja może zameldować, ale pokój nie jest gotowy).
- **CLEAN** / **INSPECTED** — pokój dostępny.

---

## 7. Możliwe błędy i trudne sytuacje

### Meldowanie

| Sytuacja | Opis | Reakcja systemu / zalecenie |
|----------|------|-----------------------------|
| **Rezerwacja PENDING** | Gość przyszedł, rezerwacja niepotwierdzona | Najpierw potwierdzić rezerwację, potem meldować |
| **Rezerwacja CANCELLED** | Gość ma anulowaną rezerwację | Sprawdzić powód; ewentualnie nowa rezerwacja (walk-in) |
| **Pokój DIRTY** | Pokój nieposprzątany | System ostrzega; decyzja recepcji: czekać na sprzątanie lub zameldować do innego pokoju |
| **Pokój OOO** | Pokój wyłączony | System blokuje meldunek w tym pokoju; przeniesienie na inny |
| **Gość na czarnej liście** | isBlacklisted = true | Ostrzeżenie; recepcja decyduje (melduje / odmawia) |
| **Błąd MRZ / OCR** | Skan dokumentu nie odczytał danych | Ręczne wpisanie danych |
| **Data przyjazdu inna niż dziś** | Kiosk / web check-in poza dniem przyjazdu | Kiosk: „Meldunek możliwy tylko w dniu przyjazdu lub dzień wcześniej” |
| **Duplikat meldunku** | Gość już CHECKED_IN | System nie pozwala ponownie meldować; sprawdzić, czy chodzi o inną rezerwację |

### Płatności

| Sytuacja | Opis | Reakcja systemu / zalecenie |
|----------|------|-----------------------------|
| **Saldo ujemne (nadpłata)** | Gość zapłacił za dużo | Zwrot (REFUND) lub pozostawienie jako zaliczka |
| **Brak metody płatności** | Nieprawidłowy kod (np. „KARTA” zamiast „CARD”) | Walidacja: dozwolone metody to CASH, CARD, TRANSFER itd. |
| **SPLIT — suma nie zgadza się** | Suma części ≠ kwota transakcji | Błąd walidacji: „Suma metod nie zgadza się z kwotą” |
| **Transakcja dla CANCELLED** | Wpis płatności do anulowanej rezerwacji | System rejestruje, ale loguje ostrzeżenie |
| **Błąd drukarki fiskalnej** | Paragon się nie wydrukował | Procedura hotelu: anulowanie / ponowny wydruk (w zależności od konfiguracji) |

### Wymeldowanie

| Sytuacja | Opis | Reakcja systemu / zalecenie |
|----------|------|-----------------------------|
| **Nieopłacone saldo** | Gość ma dług na folio | Przyjąć płatność przed check-outem; system nie blokuje wymeldowania, ale raportuje ostrzeżenie |
| **Nieopłacone usługi (np. restauracja)** | Rachunki z restauracji nie przeniesione | Ostrzeżenie w logach; uregulować przed lub po check-out |
| **Kaucja nie zwolniona** | Gość zapłacił kaucję, system nie zwolnił | Ręczne zwolnienie kaucji (REFUND) przed check-out |
| **Wymeldowanie bez oddania klucza** | Gość wyszedł, nie oddał klucza | Procedura hotelu: kontakt z gościem, ewentualna blokada karty / zmiana zamka |

### Sprzątanie i statusy

| Sytuacja | Opis | Reakcja systemu / zalecenie |
|----------|------|-----------------------------|
| **Pokój CLEAN, ale gość jeszcze w środku** | Pomyłka — pokojowa oznaczyła jako CLEAN za wcześnie | Zmiana statusu na DIRTY lub CHECKOUT_PENDING |
| **Konflikt: rezerwacja na CLEAN, pokój DIRTY** | Nowy gość przyjeżdża, pokój nieposprzątany | Pilne sprzątanie lub przeniesienie gościa |
| **Offline — brak synchronizacji** | Housekeeping bez internetu, zmiany lokalne | Po powrocie do sieci — synchronizacja; możliwe konflikty |
| **Usterka w pokoju** | Awaria (np. klimatyzacja, ciepła woda) | Zgłoszenie usterki → status OOO lub MAINTENANCE; przeniesienie gościa |

### Inne trudne sytuacje

| Sytuacja | Opis | Reakcja systemu / zalecenie |
|----------|------|-----------------------------|
| **No-show** | Gość nie przyjechał w dniu przyjazdu | Oznaczenie statusu NO_SHOW; polityka anulowania / naliczenia opłat |
| **Early arrival** | Gość przyjechał wcześniej niż check-in | Sprawdzenie dostępności; wcześniejszy meldunek (jeśli pokój wolny) lub przechowalnia bagaży |
| **Late departure** | Gość nie wyszedł do godziny check-out | Kontakt z gościem; opłata za późne wymeldowanie lub przedłużenie rezerwacji |
| **Zmiana gościa w trakcie pobytu** | Inna osoba chce zostać w pokoju | Edycja rezerwacji: zmiana gościa lub dodanie współlokatora; zgodność z polityką hotelu |
| **Uszkodzenie w pokoju** | Gość coś zniszczył | Obciążenie folio (np. typu „Uszkodzenie”), potrącenie z kaucji |
