# Scenariusze błędów i trudnych sytuacji

**Dokument:** error_scenarios.md  
**Przeznaczenie:** Materiał szkoleniowy AI — co powinien zrobić pracownik w typowych sytuacjach awaryjnych.

---

## 1. Brak internetu

### Opis sytuacji

- Przeglądarka pokazuje błąd sieci (np. „Przekroczono czas oczekiwania”, „Nie można załadować użytkowników”),
- Strona się nie ładuje lub operacje (zapis, wyszukiwanie) nie przechodzą,
- Ikona WifiOff w panelu Housekeeping (tryb offline).

### Co powinien zrobić pracownik

1. **Sprawdzić połączenie** — czy WiFi jest włączone, czy router działa, czy inne urządzenia mają internet.
2. **Odświeżyć stronę** — czasem pomaga po krótkiej przerwie w sieci (F5 lub Ctrl+R).
3. **Recepcja / Front Office / Finanse** — system wymaga połączenia; bez internetu nie można:
   - tworzyć ani edytować rezerwacji,
   - rejestrować płatności,
   - wykonywać audytu nocnego.
4. **Plan awaryjny:**
   - Zapisać dane na kartce (imię gościa, pokój, daty, kwota) — do późniejszego wprowadzenia,
   - Użyć telefonu z internetem (hotspot) jako zapasowego połączenia,
   - Skontaktować się z administratorem / dostawcą internetu.
5. **Housekeeping** — panel ma **tryb offline**:
   - Zmiany statusów pokoi (np. DIRTY → CLEAN) są zapisywane lokalnie (IndexedDB),
   - Po powrocie do sieci system synchronizuje dane,
   - Należy upewnić się, że synchronizacja się wykonała (ikona Wifi po połączeniu).

### Czego unikać

- Wielokrotnego klikania „Zapisz” lub „Zaloguj” — grozi duplikatami lub błędami,
- Wprowadzania tych samych danych w wielu miejscach bez sprawdzenia, czy pierwsza próba się zapisała.

---

## 2. System wolno działa

### Opis sytuacji

- Strona ładuje się długo (np. >10 s),
- Kliknięcia reagują z opóźnieniem,
- Operacje (zapis rezerwacji, przeciąganie paska) trwają kilkanaście sekund.

### Co powinien zrobić pracownik

1. **Poczekać** — nie klikać ponownie; druga próba może utworzyć duplikat lub konflikt.
2. **Sprawdzić obciążenie** — czy na Tape Chart jest bardzo dużo rezerwacji, czy widok jest ustawiony na „Rok” (dużo kolumn); warto przełączyć na widok „Tydzień”.
3. **Odświeżyć stronę** — po zapisaniu ważnych zmian; uwaga: niezapisane dane w otwartym formularzu mogą się utracić.
4. **Zamknąć zbędne karty** — wiele otwartych kart z systemem obciąża przeglądarkę.
5. **Użyć trybu „Tylko wolne pokoje”** — mniej danych do wyświetlenia = szybszy Tape Chart.
6. **Zgłosić problem** — jeśli wolna praca utrzymuje się przez dłuższy czas, poinformować kierownika / administratora (możliwy problem z serwerem lub bazą).

### Czego unikać

- Wielokrotnego wysyłania tego samego zapytania (np. kilka razy „Zapisz”),
- Przeciągania wielu rezerwacji szybko po sobie — poczekać na zakończenie każdej operacji.

---

## 3. Pokój zajęty

### Opis sytuacji

- Próba utworzenia rezerwacji na pokój, który w danym terminie ma już inną rezerwację,
- Próba przeniesienia rezerwacji (drag & drop) na zajęty pokój,
- Komunikat: „Pokój X jest zajęty w podanym terminie”.

### Co powinien zrobić pracownik

1. **Nie wymuszać** — system blokuje operację celowo, żeby uniknąć overbookingu.
2. **Sprawdzić Tape Chart** — która rezerwacja zajmuje pokój w tym terminie; otworzyć ją i zweryfikować dane.
3. **Wybrać inny pokój:**
   - W formularzu rezerwacji — zmienić pole „Pokój” na wolny pokój tego samego typu (lub innego),
   - Przy przeciąganiu — upuścić pasek na inny, wolny pokój.
4. **Użyć auto-przypisania** — jeśli dostępne: system sam dobierze wolny pokój danego typu.
5. **Sprawdzić konflikty** — włączyć przełącznik „Konflikty” na Tape Chart; podświetlone paski to nadrezerwacje (overbooking) — trzeba je rozwiązać.
6. **Jeśli to błąd systemu** (np. duplikat, stare dane) — anulować nieprawidłową rezerwację lub skontaktować się z kierownikiem.

### Wyjątek: overbooking

- Jeśli hotel ma włączony limit overbookingu i świadomie akceptuje nadrezerwację, system może pozwolić na zapis z ostrzeżeniem „Rezerwacja utworzona w trybie overbooking”.
- W takim przypadku decyzja należy do kierownika; przed przyjazdem trzeba mieć plan awaryjny (np. przeniesienie gościa, współpraca z innym hotelem).

---

## 4. Klient chce anulować

### Opis sytuacji

Gość dzwoni lub przychodzi i rezygnuje z rezerwacji. Być może zapłacił zaliczkę.

### Co powinien zrobić pracownik

1. **Znaleźć rezerwację** — w Tape Chart, księdze meldunkowej lub po numerze potwierdzenia / nazwisku.
2. **Otworzyć rezerwację** — kliknąć w pasek lub wyszukać w liście.
3. **Sprawdzić warunki anulowania** — polityka hotelu (np. darmowe anulowanie do 24 h przed przyjazdem, opłata za późne anulowanie).
4. **Wykonać anulowanie:**
   - W oknie rezerwacji — przycisk **Usuń rez.** lub z menu kontekstowego (prawy przycisk) → **Anuluj**,
   - Podać **powód anulowania** (np. „Gość zrezygnował”, „Zmiana planów”),
   - Potwierdzić operację.
5. **Zwrot zaliczki** — jeśli gość wpłacił zaliczkę:
   - Sprawdzić politykę: zwrot pełny, częściowy czy brak zwrotu,
   - W systemie: w folio rezerwacji wykonać **REFUND** (zwrot) na odpowiednią kwotę,
   - Poinformować gościa o terminie zwrotu (np. 7–14 dni na konto).
6. **Potwierdzenie** — wysłać gościowi mail z potwierdzeniem anulowania (jeśli system to wspiera) lub poinformować ustnie.

### Ważne

- Anulowana rezerwacja ma status **CANCELLED**; pokój znów jest wolny,
- Powód anulowania jest zapisywany — przydatny do raportów i analizy.

---

## 5. Pomyłka w rezerwacji

### Opis sytuacji

- Zła data przyjazdu lub wyjazdu,
- Zły pokój,
- Źle wpisane dane gościa,
- Duplikat rezerwacji (ta sama osoba, ten sam termin — utworzona dwa razy).

### Co powinien zrobić pracownik

#### Pomyłka w datach

1. Otworzyć rezerwację.
2. Zmienić pole **Check-in** i/lub **Check-out** na prawidłowe daty.
3. Kliknąć **Zapisz**.
4. Sprawdzić, czy cena się przeliczyła (inna liczba nocy = inna kwota).
5. Poinformować gościa o zmianie (np. e-mailem).

#### Pomyłka w pokoju

1. Otworzyć rezerwację.
2. **Opcja A:** Zmienić pole **Pokój** w formularzu na właściwy i zapisać.
3. **Opcja B:** Na Tape Chart przeciągnąć pasek rezerwacji na właściwy pokój.
4. Upewnić się, że nowy pokój jest wolny w tym terminie.

#### Pomyłka w danych gościa

1. Otworzyć rezerwację.
2. Poprawić pola (imię, nazwisko, email, telefon) w formularzu.
3. Zapisać.
4. Jeśli chodzi o innego gościa (np. pomyłka przy wyborze z listy) — zmienić gościa; system zaktualizuje powiązanie z profilem.

#### Duplikat rezerwacji

1. Włączyć **Konflikty** na Tape Chart — zobaczyć podświetlone paski.
2. Ustalić, która rezerwacja jest ważna (np. starsza, z płatnością).
3. **Anulować duplikat** — tę, która jest błędna; podać powód „Błąd — duplikat”.
4. Jeśli obie mają płatności — przed anulowaniem przenieść ewentualną wpłatę do właściwej rezerwacji (zwrot + nowa wpłata lub transfer — zależnie od procedur).

#### Cofnięcie ostatniej operacji

- **Ctrl+Z** na Tape Chart — cofnięcie ostatniego przeciągnięcia / zmiany (do 5 kroków wstecz),
- Działa tylko dla operacji na Tape Chart; nie cofa zapisu z formularza.

---

## 6. Konflikt dat

### Opis sytuacji

- Dwie rezerwacje na ten sam pokój w tym samym terminie (overbooking),
- System pokazuje czerwone obwódki na paskach (gdy włączone „Konflikty”),
- Komunikat przy próbie utworzenia rezerwacji: „Pokój zajęty”.

### Co powinien zrobić pracownik

1. **Włączyć Konflikty** — na Tape Chart przełącznik „Konflikty”; podświetlone paski to rezerwacje w konflikcie.
2. **Zidentyfikować konflikt** — ten sam pokój, nakładające się daty (check-in jednej < check-out drugiej).
3. **Ustalić przyczynę:**
   - **Duplikat** — ten sam gość, błąd recepcji,
   - **Różni goście** — poważny błąd; dwa różne zameldowania w jednym pokoju w tym samym czasie.
4. **Rozwiązać konflikt:**
   - **Duplikat:** anulować jedną rezerwację (powód: „Błąd — duplikat”),
   - **Różni goście:** skontaktować się z kierownikiem; trzeba:
     - przenieść jedną rezerwację do innego pokoju,
     - lub zmienić daty jednej z rezerwacji,
     - lub anulować jedną i zaoferować alternatywę / rekompensatę.
5. **Po rozwiązaniu** — wyłączyć „Konflikty” i sprawdzić, czy nie ma już podświetlonych pasków.
6. **Przed przyjazdem** — jeśli konflikt dotyczy przyszłych dat, rozwiązać go jak najszybciej, żeby uniknąć kłopotów w dniu przyjazdu.

### Zapobieganie

- Nie klikać wielokrotnie „Zapisz” przy wolnej sieci,
- Sprawdzać Tape Chart przed utworzeniem rezerwacji,
- Używać wyszukiwarki dostępności (searchAvailableRooms) przy rezerwacjach telefonicznych.
