# STOP — Przeczytaj zanim cokolwiek zrobisz

## Problem
Dostajesz ODE MNIE trzy szczegółowe prompty z kompletną specyfikacją okna edycji rezerwacji wzorowanego na KWHotel. Mimo to pominąłeś OGROMNĄ ilość elementów. Porównuję to co zrobiłeś (screenshot "Nowa rezerwacja" z naszej apki) z KWHotel i widzę ponad 20 brakujących elementów.

## Zanim zaczniesz naprawiać — ODPOWIEDZ MI NA TE PYTANIA:

1. **Czy przeczytałeś CAŁY prompt v1 (przeprojektowanie layoutu)?** Podaj listę sekcji które zaimplementowałeś i które pominąłeś.
2. **Czy przeczytałeś prompt v3 (uzupełnienie z dokumentacji KWHotel)?** Jeśli tak, dlaczego pominąłeś większość punktów?
3. **Ile z 25 punktów checklisty z v1 jest zrealizowanych?** Przejdź punkt po punkcie i oznacz ✅ lub ❌.
4. **Czy przeczytałeś stronę https://kwhotel.com/pl/baza-wiedzy/grafik-i-rezerwacje/tworzenie-rezerwacji-pojedynczych/ ?** — tam jest PEŁNY opis każdego elementu okna.

## Po odpowiedzi — oto KOMPLETNA lista braków do naprawienia:

---

# BRAKI W LEWEJ KOLUMNIE

## Brak 1: Sekcja DANE POKOJU — nie istnieje w ogóle
W KWHotel na samej górze lewej kolumny jest:
- **Grupa** (typ pokoju) — dropdown
- **Numer** (konkretny pokój) — dropdown
- **SB / DB / EB** — liczba łóżek (Single/Double/Extra Bed) — read-only
- **Wyposażenie** — tekst read-only (TV, Łazienka, WiFi...)
- **Opis** — tekst read-only

U nas: NIE MA tej sekcji. Jest od razu Źródło/Kanał/Wyżywienie.

**Napraw:** Dodaj sekcję DANE POKOJU na GÓRZE lewej kolumny. Użyj istniejącego dropdowna pokoju (form.room). Dodaj wyświetlanie SB/DB/EB, wyposażenia i opisu po wyborze pokoju.

## Brak 2: Sekcja OKRES POBYTU — nie widać
W KWHotel jest:
- Data zameldowania + data wymeldowania
- Liczba nocy (z przyciskami 1-7)
- Godziny check-in / check-out

U nas: NIE WIDAĆ tej sekcji na screenshocie. Albo nie istnieje, albo jest schowana poniżej.

**Napraw:** Upewnij się, że sekcja OKRES POBYTU jest WIDOCZNA, z datami, godzinami, przyciskami nocy, Parking, Stawka, Pax.

## Brak 3: Źródło / Kanał / Wyżywienie / ETA — złe miejsce
Te pola są teraz na GÓRZE lewej kolumny. W KWHotel są w zakładce **Pozostałe** (prawa kolumna).

**Napraw:** Przenieś Źródło, Kanał, Wyżywienie, ETA do zakładki POZOSTAŁE w prawej kolumnie. Lewa kolumna powinna zaczynać się od DANE POKOJU, potem OKRES POBYTU, potem DANE GOŚCIA.

## Brak 4: Lista gości w pokoju
W KWHotel pod danymi gościa jest lista gości z przyciskami:
- Lista gości: "Jan Kowalski 0 0 ☐☐☑"
- [Dodaj klienta] [Edytuj klienta] [Usuń klienta]

U nas: NIE WIDAĆ.

**Napraw:** Dodaj sekcję "Goście w pokoju" pod danymi gościa. Z listą occupants i przyciskami Dodaj/Edytuj/Usuń. Te komponenty już ISTNIEJĄ w kodzie (ReservationOccupant, addReservationOccupant, removeReservationOccupant) — podłącz je.

## Brak 5: Historia gościa
W KWHotel widać historię pobytów gościa.

**Napraw:** Dodaj rozwijany panel "▶ Historia (X pobytów)" pod danymi gościa. Akcja `getReservationsByGuestId` już ISTNIEJE — podłącz ją.

## Brak 6: Przypomnienie do rezerwacji
W KWHotel na dole lewej kolumny jest:
- ☐ Przypomnienie do rezerwacji [📅 data] [⏰ godzina]

U nas: NIE MA.

**Napraw:** Dodaj w sekcji UWAGI.

## Brak 7: Uwagi — "Pokaż na grafiku"
W KWHotel jest checkbox przy uwagach — jeśli zaznaczony, pierwsza linia wyświetla się na pasku rezerwacji w TapeChart.

U nas: NIE MA.

**Napraw:** Dodaj checkbox "Pokaż uwagi na grafiku" w sekcji UWAGI.

---

# BRAKI W PRAWEJ KOLUMNIE — ZAKŁADKA ROZLICZENIE

## Brak 8: Tabela cen Osób / Dziecko1 / Dziecko2 / Dziecko3
W KWHotel jest pełna tabela:
```
           │ Osób  │ Dziecko1 │ Dziecko2 │ Dziecko3 │ Suma/doba
Liczba     │  [1]  │   [0]    │   [0]    │   [0]    │
Cena       │[0,00] │  [0,00]  │  [0,00]  │  [0,00]  │  100,00
```

U nas: Jest tylko jedno pole "Cena za dobę: 300". BRAK tabeli.

**Napraw:** Zamień pole "Cena za dobę" na pełną tabelę cen z kolumnami Osób/Dziecko1/Dziecko2/Dziecko3.

## Brak 9: Trzeci tryb rozliczania — Plan cenowy
W KWHotel jest 3 opcje: ● Cena pokoju za dobę / ○ Cena za osobo-dobę / ○ Plan cenowy

U nas: Są tylko 2 radio buttons. Brak "Plan cenowy".

**Napraw:** Dodaj trzeci radio button "Plan cenowy" z dropdownem cenników (rate codes). Jeśli wybrany — ceny wypełniają się automatycznie z cennika.

## Brak 10: Pola wpłat — Wpłata, Zaliczka, Voucher, Kaucja
W KWHotel po prawej stronie rozliczenia jest:
```
Wpłata:              [0,00]   [Zapłacono]
Zaliczka:            [0,00]
Voucher / dofinans.: [0,00]   [▼ typ]
Kaucja:              [0,00]
```

U nas: NIE MA żadnego z tych pól. Jest tylko "Wpłaty: 0.00" jako read-only.

**Napraw:** Dodaj edytowalne pola: Wpłata (z przyciskiem "Zapłacono" który wpisuje brakującą kwotę), Zaliczka, Voucher/dofinansowanie (z typem), Kaucja. Podłącz do istniejących server actions (registerTransaction, collectSecurityDeposit itp.).

## Brak 11: Przycisk "Zapłacono"
W KWHotel przycisk "Zapłacono" automatycznie wpisuje brakującą kwotę do pola Wpłata.

**Napraw:** Dodaj obok pola Wpłata.

## Brak 12: Rabat za nocleg [%]
W KWHotel jest pole "Rabat za nocleg [%]: [0]".

U nas: NIE MA.

**Napraw:** Dodaj. Akcja `addFolioDiscount` już ISTNIEJE — podłącz.

## Brak 13: Checkbox "Dolicz opłatę miejscową"
W KWHotel: ☐ Dolicz opłatę miejscową

U nas: Jest wiersz "Opłata miejscowa: 0.00" ale nie ma checkboxa do włączenia/wyłączenia.

**Napraw:** Dodaj checkbox. Jeśli zaznaczony: opłata = osoby × noce × stawka.

## Brak 14: Checkbox "Płatność gwarantowana kartą kredytową"
W KWHotel: ☐ Płatność gwarantowana kartą kredytową

U nas: NIE MA.

**Napraw:** Dodaj checkbox informacyjny.

## Brak 15: Termin wpłaty zaliczki
W KWHotel: data, po której brak wpłaty → rezerwacja na czerwono na grafiku.

U nas: NIE MA.

**Napraw:** Dodaj pole daty pod zaliczką.

## Brak 16: Dodatkowy status rezerwacji
W KWHotel obok "Status rezerwacji" jest osobna zakładka "Dodatkowy status rezerwacji".

U nas: NIE MA.

**Napraw:** Dodaj dropdown z konfigurowalnymi statusami (VIP, Oczekuje na wpłatę, Reklamacja itp.).

## Brak 17: Statusy dynamiczne
W KWHotel statusy wyświetlane zależą od etapu rezerwacji — nie wszystkie naraz.

U nas: Wyświetlane jest WSZYSTKIE 5 statusów jednocześnie (Potwierdzona, Zameldowany, Wymeldowany, Anulowana, No-show).

**Napraw:** Filtruj statusy na podstawie daty rezerwacji i aktualnego stanu:
- Rezerwacja PRZYSZŁA: Potwierdzona, Anulowana, No-show
- Rezerwacja DZISIEJSZA: Potwierdzona, Zameldowany, Anulowana, No-show
- Rezerwacja TRWAJĄCA (zameldowany): Zameldowany, Wymeldowany
- Rezerwacja PRZESZŁA: Wymeldowany

## Brak 18: Przycisk "Melduj gościa" / "Wymelduj i zapisz"
W KWHotel jest przycisk "Wymelduj i zapisz" (lub "Melduj gościa" w zależności od etapu).

U nas: NIE MA go w widocznej części okna (był "Rozlicz i wymelduj" w starym oknie).

**Napraw:** Dodaj przycisk obok statusu, dynamiczny:
- Gdy status = Potwierdzona → [Melduj gościa]
- Gdy status = Zameldowany → [Wymelduj i zapisz]

---

# BRAKI W ZAKŁADKACH

## Brak 19: Zakładka POZOSTAŁE — nie istnieje
W KWHotel to osobna zakładka z: Źródło, Kanał, Segment, Nr rezerwacji online, Waluta, Kopiuj rezerwację, Historia zmian.

U nas: Nie ma takiej zakładki. Źródło/Kanał są w lewej kolumnie (złe miejsce).

**Napraw:** Utwórz zakładkę Pozostałe. Przenieś tam Źródło, Kanał, Wyżywienie, ETA. Dodaj: Segment, Nr online, Waluta, Historia zmian (placeholder), Kopiuj rezerwację (placeholder).

## Brak 20: Zakładka WŁASNE — nie istnieje

**Napraw:** Dodaj zakładkę z placeholderem "W budowie — pola definiowane przez użytkownika".

## Brak 21: Zakładka PARKING — nie istnieje

**Napraw:** Dodaj zakładkę z placeholderem + info o aktualnie przypisanym miejscu.

---

# BRAKI W FOOTERZE

## Brak 22: Brakujące przyciski
W KWHotel footer ma: [Towary] [Wystaw dokument ▼] [Ceny/dni] [Anuluj Rez] [Płatności] [Historia] [Zapisz] [Anuluj]

U nas: Jest TYLKO [Zapisz i drukuj] [Zapisz].

**Napraw:** Dodaj brakujące przyciski:
- **[Towary]** — otwiera AddChargeDialog (ISTNIEJE w kodzie)
- **[Wystaw dokument ▼]** — dropdown: Faktura/Rachunek/Proforma/Paragon
- **[Ceny / dni]** — dialog z ceną per dzień pobytu
- **[Usuń rezerwację]** — z dialogiem potwierdzenia + pole na powód
- **[Płatności]** — historia transakcji
- **[Rozlicz i wymelduj]** — ISTNIEJE w kodzie, przenieś do footera

---

# PORZĄDEK ZAKŁADEK

Finalna kolejność (jak w KWHotel):
1. Rozliczenie
2. Dokumenty
3. Posiłki
4. Parking
5. Pozostałe
6. Własne
7. Usługi
8. Grafik sprzątań
9. Meldunek

---

# KOLEJNOŚĆ PRACY

1. **NAJPIERW odpowiedz na pytania** z początku promptu (co pominąłeś i dlaczego)
2. Przenieś Źródło/Kanał/Wyżywienie/ETA z lewej kolumny do zakładki Pozostałe
3. Dodaj sekcję DANE POKOJU na górze lewej kolumny
4. Upewnij się, że OKRES POBYTU jest widoczny (daty, godziny, noce, parking, stawka, pax)
5. Dodaj listę gości, historię, przypomnienie do lewej kolumny
6. Rozbuduj zakładkę Rozliczenie (tabela cen, wpłaty, rabat, checkboxy, statusy dynamiczne)
7. Dodaj zakładki: Pozostałe, Własne, Parking
8. Rozbuduj footer o brakujące przyciski
9. Przetestuj WSZYSTKO

# WAŻNE
- Nie rób tego "na później" — zrób TERAZ wszystko z tej listy
- Nie twórz pustych komponentów — podłącz do istniejących server actions
- Sprawdź audyt z wcześniej — tam jest lista WSZYSTKICH istniejących akcji i pól
- Jeśli pole nie istnieje w Prisma — dodaj je z migracją
- Jeśli czegoś nie rozumiesz — zostaw komentarz TODO, ale NIE pomijaj całej sekcji

# STOP — Przeczytaj zanim cokolwiek zrobisz

## Problem
Dostajesz ODE MNIE trzy szczegółowe prompty z kompletną specyfikacją okna edycji rezerwacji wzorowanego na KWHotel. Mimo to pominąłeś OGROMNĄ ilość elementów. Porównuję to co zrobiłeś (screenshot "Nowa rezerwacja" z naszej apki) z KWHotel i widzę ponad 20 brakujących elementów.

## Zanim zaczniesz naprawiać — ODPOWIEDZ MI NA TE PYTANIA:

1. **Czy przeczytałeś CAŁY prompt v1 (przeprojektowanie layoutu)?** Podaj listę sekcji które zaimplementowałeś i które pominąłeś.
2. **Czy przeczytałeś prompt v3 (uzupełnienie z dokumentacji KWHotel)?** Jeśli tak, dlaczego pominąłeś większość punktów?
3. **Ile z 25 punktów checklisty z v1 jest zrealizowanych?** Przejdź punkt po punkcie i oznacz ✅ lub ❌.
4. **Czy przeczytałeś stronę https://kwhotel.com/pl/baza-wiedzy/grafik-i-rezerwacje/tworzenie-rezerwacji-pojedynczych/ ?** — tam jest PEŁNY opis każdego elementu okna.

## Po odpowiedzi — oto KOMPLETNA lista braków do naprawienia:

---

# BRAKI W LEWEJ KOLUMNIE

## Brak 1: Sekcja DANE POKOJU — nie istnieje w ogóle
W KWHotel na samej górze lewej kolumny jest:
- **Grupa** (typ pokoju) — dropdown
- **Numer** (konkretny pokój) — dropdown
- **SB / DB / EB** — liczba łóżek (Single/Double/Extra Bed) — read-only
- **Wyposażenie** — tekst read-only (TV, Łazienka, WiFi...)
- **Opis** — tekst read-only

U nas: NIE MA tej sekcji. Jest od razu Źródło/Kanał/Wyżywienie.

**Napraw:** Dodaj sekcję DANE POKOJU na GÓRZE lewej kolumny. Użyj istniejącego dropdowna pokoju (form.room). Dodaj wyświetlanie SB/DB/EB, wyposażenia i opisu po wyborze pokoju.

## Brak 2: Sekcja OKRES POBYTU — nie widać
W KWHotel jest:
- Data zameldowania + data wymeldowania
- Liczba nocy (z przyciskami 1-7)
- Godziny check-in / check-out

U nas: NIE WIDAĆ tej sekcji na screenshocie. Albo nie istnieje, albo jest schowana poniżej.

**Napraw:** Upewnij się, że sekcja OKRES POBYTU jest WIDOCZNA, z datami, godzinami, przyciskami nocy, Parking, Stawka, Pax.

## Brak 3: Źródło / Kanał / Wyżywienie / ETA — złe miejsce
Te pola są teraz na GÓRZE lewej kolumny. W KWHotel są w zakładce **Pozostałe** (prawa kolumna).

**Napraw:** Przenieś Źródło, Kanał, Wyżywienie, ETA do zakładki POZOSTAŁE w prawej kolumnie. Lewa kolumna powinna zaczynać się od DANE POKOJU, potem OKRES POBYTU, potem DANE GOŚCIA.

## Brak 4: Lista gości w pokoju
W KWHotel pod danymi gościa jest lista gości z przyciskami:
- Lista gości: "Jan Kowalski 0 0 ☐☐☑"
- [Dodaj klienta] [Edytuj klienta] [Usuń klienta]

U nas: NIE WIDAĆ.

**Napraw:** Dodaj sekcję "Goście w pokoju" pod danymi gościa. Z listą occupants i przyciskami Dodaj/Edytuj/Usuń. Te komponenty już ISTNIEJĄ w kodzie (ReservationOccupant, addReservationOccupant, removeReservationOccupant) — podłącz je.

## Brak 5: Historia gościa
W KWHotel widać historię pobytów gościa.

**Napraw:** Dodaj rozwijany panel "▶ Historia (X pobytów)" pod danymi gościa. Akcja `getReservationsByGuestId` już ISTNIEJE — podłącz ją.

## Brak 6: Przypomnienie do rezerwacji
W KWHotel na dole lewej kolumny jest:
- ☐ Przypomnienie do rezerwacji [📅 data] [⏰ godzina]

U nas: NIE MA.

**Napraw:** Dodaj w sekcji UWAGI.

## Brak 7: Uwagi — "Pokaż na grafiku"
W KWHotel jest checkbox przy uwagach — jeśli zaznaczony, pierwsza linia wyświetla się na pasku rezerwacji w TapeChart.

U nas: NIE MA.

**Napraw:** Dodaj checkbox "Pokaż uwagi na grafiku" w sekcji UWAGI.

---

# BRAKI W PRAWEJ KOLUMNIE — ZAKŁADKA ROZLICZENIE

## Brak 8: Tabela cen Osób / Dziecko1 / Dziecko2 / Dziecko3
W KWHotel jest pełna tabela:
```
           │ Osób  │ Dziecko1 │ Dziecko2 │ Dziecko3 │ Suma/doba
Liczba     │  [1]  │   [0]    │   [0]    │   [0]    │
Cena       │[0,00] │  [0,00]  │  [0,00]  │  [0,00]  │  100,00
```

U nas: Jest tylko jedno pole "Cena za dobę: 300". BRAK tabeli.

**Napraw:** Zamień pole "Cena za dobę" na pełną tabelę cen z kolumnami Osób/Dziecko1/Dziecko2/Dziecko3.

## Brak 9: Trzeci tryb rozliczania — Plan cenowy
W KWHotel jest 3 opcje: ● Cena pokoju za dobę / ○ Cena za osobo-dobę / ○ Plan cenowy

U nas: Są tylko 2 radio buttons. Brak "Plan cenowy".

**Napraw:** Dodaj trzeci radio button "Plan cenowy" z dropdownem cenników (rate codes). Jeśli wybrany — ceny wypełniają się automatycznie z cennika.

## Brak 10: Pola wpłat — Wpłata, Zaliczka, Voucher, Kaucja
W KWHotel po prawej stronie rozliczenia jest:
```
Wpłata:              [0,00]   [Zapłacono]
Zaliczka:            [0,00]
Voucher / dofinans.: [0,00]   [▼ typ]
Kaucja:              [0,00]
```

U nas: NIE MA żadnego z tych pól. Jest tylko "Wpłaty: 0.00" jako read-only.

**Napraw:** Dodaj edytowalne pola: Wpłata (z przyciskiem "Zapłacono" który wpisuje brakującą kwotę), Zaliczka, Voucher/dofinansowanie (z typem), Kaucja. Podłącz do istniejących server actions (registerTransaction, collectSecurityDeposit itp.).

## Brak 11: Przycisk "Zapłacono"
W KWHotel przycisk "Zapłacono" automatycznie wpisuje brakującą kwotę do pola Wpłata.

**Napraw:** Dodaj obok pola Wpłata.

## Brak 12: Rabat za nocleg [%]
W KWHotel jest pole "Rabat za nocleg [%]: [0]".

U nas: NIE MA.

**Napraw:** Dodaj. Akcja `addFolioDiscount` już ISTNIEJE — podłącz.

## Brak 13: Checkbox "Dolicz opłatę miejscową"
W KWHotel: ☐ Dolicz opłatę miejscową

U nas: Jest wiersz "Opłata miejscowa: 0.00" ale nie ma checkboxa do włączenia/wyłączenia.

**Napraw:** Dodaj checkbox. Jeśli zaznaczony: opłata = osoby × noce × stawka.

## Brak 14: Checkbox "Płatność gwarantowana kartą kredytową"
W KWHotel: ☐ Płatność gwarantowana kartą kredytową

U nas: NIE MA.

**Napraw:** Dodaj checkbox informacyjny.

## Brak 15: Termin wpłaty zaliczki
W KWHotel: data, po której brak wpłaty → rezerwacja na czerwono na grafiku.

U nas: NIE MA.

**Napraw:** Dodaj pole daty pod zaliczką.

## Brak 16: Dodatkowy status rezerwacji
W KWHotel obok "Status rezerwacji" jest osobna zakładka "Dodatkowy status rezerwacji".

U nas: NIE MA.

**Napraw:** Dodaj dropdown z konfigurowalnymi statusami (VIP, Oczekuje na wpłatę, Reklamacja itp.).

## Brak 17: Statusy dynamiczne
W KWHotel statusy wyświetlane zależą od etapu rezerwacji — nie wszystkie naraz.

U nas: Wyświetlane jest WSZYSTKIE 5 statusów jednocześnie (Potwierdzona, Zameldowany, Wymeldowany, Anulowana, No-show).

**Napraw:** Filtruj statusy na podstawie daty rezerwacji i aktualnego stanu:
- Rezerwacja PRZYSZŁA: Potwierdzona, Anulowana, No-show
- Rezerwacja DZISIEJSZA: Potwierdzona, Zameldowany, Anulowana, No-show
- Rezerwacja TRWAJĄCA (zameldowany): Zameldowany, Wymeldowany
- Rezerwacja PRZESZŁA: Wymeldowany

## Brak 18: Przycisk "Melduj gościa" / "Wymelduj i zapisz"
W KWHotel jest przycisk "Wymelduj i zapisz" (lub "Melduj gościa" w zależności od etapu).

U nas: NIE MA go w widocznej części okna (był "Rozlicz i wymelduj" w starym oknie).

**Napraw:** Dodaj przycisk obok statusu, dynamiczny:
- Gdy status = Potwierdzona → [Melduj gościa]
- Gdy status = Zameldowany → [Wymelduj i zapisz]

---

# BRAKI W ZAKŁADKACH

## Brak 19: Zakładka POZOSTAŁE — nie istnieje
W KWHotel to osobna zakładka z: Źródło, Kanał, Segment, Nr rezerwacji online, Waluta, Kopiuj rezerwację, Historia zmian.

U nas: Nie ma takiej zakładki. Źródło/Kanał są w lewej kolumnie (złe miejsce).

**Napraw:** Utwórz zakładkę Pozostałe. Przenieś tam Źródło, Kanał, Wyżywienie, ETA. Dodaj: Segment, Nr online, Waluta, Historia zmian (placeholder), Kopiuj rezerwację (placeholder).

## Brak 20: Zakładka WŁASNE — nie istnieje

**Napraw:** Dodaj zakładkę z placeholderem "W budowie — pola definiowane przez użytkownika".

## Brak 21: Zakładka PARKING — nie istnieje

**Napraw:** Dodaj zakładkę z placeholderem + info o aktualnie przypisanym miejscu.

---

# BRAKI W FOOTERZE

## Brak 22: Brakujące przyciski
W KWHotel footer ma: [Towary] [Wystaw dokument ▼] [Ceny/dni] [Anuluj Rez] [Płatności] [Historia] [Zapisz] [Anuluj]

U nas: Jest TYLKO [Zapisz i drukuj] [Zapisz].

**Napraw:** Dodaj brakujące przyciski:
- **[Towary]** — otwiera AddChargeDialog (ISTNIEJE w kodzie)
- **[Wystaw dokument ▼]** — dropdown: Faktura/Rachunek/Proforma/Paragon
- **[Ceny / dni]** — dialog z ceną per dzień pobytu
- **[Usuń rezerwację]** — z dialogiem potwierdzenia + pole na powód
- **[Płatności]** — historia transakcji
- **[Rozlicz i wymelduj]** — ISTNIEJE w kodzie, przenieś do footera

---

# PORZĄDEK ZAKŁADEK

Finalna kolejność (jak w KWHotel):
1. Rozliczenie
2. Dokumenty
3. Posiłki
4. Parking
5. Pozostałe
6. Własne
7. Usługi
8. Grafik sprzątań
9. Meldunek

---

# KOLEJNOŚĆ PRACY

1. **NAJPIERW odpowiedz na pytania** z początku promptu (co pominąłeś i dlaczego)
2. Przenieś Źródło/Kanał/Wyżywienie/ETA z lewej kolumny do zakładki Pozostałe
3. Dodaj sekcję DANE POKOJU na górze lewej kolumny
4. Upewnij się, że OKRES POBYTU jest widoczny (daty, godziny, noce, parking, stawka, pax)
5. Dodaj listę gości, historię, przypomnienie do lewej kolumny
6. Rozbuduj zakładkę Rozliczenie (tabela cen, wpłaty, rabat, checkboxy, statusy dynamiczne)
7. Dodaj zakładki: Pozostałe, Własne, Parking
8. Rozbuduj footer o brakujące przyciski
9. Przetestuj WSZYSTKO

# WAŻNE
- Nie rób tego "na później" — zrób TERAZ wszystko z tej listy
- Nie twórz pustych komponentów — podłącz do istniejących server actions
- Sprawdź audyt z wcześniej — tam jest lista WSZYSTKICH istniejących akcji i pól
- Jeśli pole nie istnieje w Prisma — dodaj je z migracją
- Jeśli czegoś nie rozumiesz — zostaw komentarz TODO, ale NIE pomijaj całej sekcji