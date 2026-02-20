# 📋 PLAN TESTÓW UAT — System Rezerwacji Hotelowej

### *Sporządzony przez: Recepcjonistę Ds. Weryfikacji Kompletności Procedur*
### *Data: 2026-02-20 | Status: OBOWIĄZKOWY DO WYKONANIA W CAŁOŚCI*

> ⚠️ **UWAGA WSTĘPNA:** Każdy punkt MUSI zostać sprawdzony. Pominięcie nawet jednego kroku jest niedopuszczalne i może prowadzić do katastrofy operacyjnej. Proszę nie próbować skracać tej listy. Lista jest kompletna, bo ją napisałem i sprawdziłem trzy razy.

---

## 📌 ŚRODOWISKO TESTOWE (OBOWIĄZKOWE DO USTALENIA PRZED ROZPOCZĘCIEM)

| Parametr | Wartość | Uwagi |
|----------|---------|-------|
| **Środowisko** | [ ] Kopia produkcyjna z danymi testowymi / [ ] Staging dedykowany / [ ] Lokalne (localhost) | Uwaga: na produkcji tylko w trybie „read-only” lub na kopii bazy |
| **URL** | ________________ | np. https://staging.hotel.example.pl lub http://localhost:3011 |
| **Baza danych** | ________________ | Czy dane są anonimizowane? Czy można je niszczyć podczas testów? |
| **Konto testowe** | Login: ________ Hasło: ________ | Recepcjonista — do testów funkcjonalnych |
| **Konto admin** | Login: ________ Hasło: ________ | Administrator — do testów uprawnień |
| **Data testów** | Od _______ do _______ | |

---

## 🔐 MODUŁ 1: Logowanie i Autoryzacja

> *Nie możemy wpuścić do systemu nieautoryzowanych osób. To podstawa. Bez tego nic nie ma sensu.*

- [ ] **1.1** Wyświetla się strona logowania po wejściu na adres systemu
- [ ] **1.2** Pole „Login" przyjmuje tekst (sprawdzić czy kursor się pojawia)
- [ ] **1.3** Pole „Hasło" maskuje znaki (gwiazdki lub kropki — nie wolno pokazywać hasła!)
- [ ] **1.4** Przycisk „Zaloguj" jest klikalny
- [ ] **1.5** Poprawne dane → przekierowanie do dashboardu ✓
- [ ] **1.6** Błędne hasło → komunikat o błędzie (NIE może być informacja „błędne hasło", bo to wskazówka dla hakera — powinno być „nieprawidłowe dane logowania")
- [ ] **1.7** Pusty formularz → walidacja, nie wolno przesłać pustego formularza
- [ ] **1.8** Po 3 błędnych próbach → czy system reaguje? (blokada, captcha lub przynajmniej opóźnienie)
- [ ] **1.9** Opcja „Zapamiętaj mnie" — działa? (jeśli istnieje)
- [ ] **1.10** Wylogowanie → sesja wygasa, powrót na stronę logowania
- [ ] **1.11** Po wylogowaniu przycisk „Wstecz" w przeglądarce NIE może wrócić do systemu

---

## 📅 MODUŁ 2: Rezerwacje — Tworzenie

> *To jest serce systemu. Tu nie ma miejsca na błędy. Żadnych.*

- [ ] **2.1** Formularz nowej rezerwacji się otwiera
- [ ] **2.2** Pole „Imię gościa" — czy przyjmuje polskie znaki (ą, ę, ó, ś, ź, ż, ć, ń)?
- [ ] **2.3** Pole „Nazwisko" — jak wyżej
- [ ] **2.4** Pole „Telefon" — walidacja formatu (czy odrzuca litery?)
- [ ] **2.5** Pole „E-mail" — walidacja @ i domeny
- [ ] **2.6** Data przyjazdu — czy można wybrać datę z przeszłości? (NIE WOLNO)
- [ ] **2.7** Data wyjazdu — czy jest wcześniejsza niż przyjazd? (NIE WOLNO)
- [ ] **2.8** Wybór pokoju — lista dostępnych pokojów dla wybranych dat
- [ ] **2.9** Pokoje już zarezerwowane NIE pojawiają się jako dostępne
- [ ] **2.10** Liczba osób — czy można wpisać 0 lub liczbę ujemną? (NIE WOLNO)
- [ ] **2.11** Liczba osób przekracza pojemność pokoju → ostrzeżenie
- [ ] **2.12** Pole „Uwagi" — czy przyjmuje długi tekst?
  - *Min. 500 znaków — musi przyjmować (np. opis wycieczki)*
  - *Max. limit: ________ znaków (np. 1000) — jeśli za długi tekst: walidacja + czytelny komunikat typu „Uwagi mogą mieć maksymalnie X znaków"*
  - *Sprawdzić: wstaw 1500 znaków — co się dzieje?*
- [ ] **2.13** Przycisk „Zapisz" zapisuje rezerwację i pokazuje potwierdzenie z numerem
- [ ] **2.14** Numer rezerwacji jest unikalny (sprawdzić dwie rezerwacje pod rząd)
- [ ] **2.15** Po zapisaniu rezerwacja pojawia się na liście

---

## 🔍 MODUŁ 3: Rezerwacje — Wyszukiwanie i Przeglądanie

> *Jeśli nie mogę znaleźć rezerwacji, to jakby jej nie było. A ona jest. Musi być.*

- [ ] **3.1** Lista rezerwacji się ładuje (nie jest pusta gdy są rezerwacje)
- [ ] **3.2** Wyszukiwanie po nazwisku gościa — zwraca właściwy wynik
- [ ] **3.3** Wyszukiwanie po numerze rezerwacji — działa
- [ ] **3.4** Wyszukiwanie po dacie przyjazdu — działa
- [ ] **3.5** Wyszukiwanie po numerze pokoju — działa
- [ ] **3.6** Wyszukiwanie po frazie bez polskich znaków np. „Kowalski" znajdzie „Kowalski" (oczywiste, ale trzeba sprawdzić)
- [ ] **3.7** Filtr: „Dzisiejsze przyjazdy" — pokazuje tylko dzisiejsze
- [ ] **3.8** Filtr: „Dzisiejsze wyjazdy" — pokazuje tylko dzisiejsze
- [ ] **3.9** Filtr: „Aktualnie zakwaterowani" — działa poprawnie
- [ ] **3.10** Sortowanie po dacie przyjazdu (rosnąco i malejąco)
- [ ] **3.11** Sortowanie po nazwisku (A-Z i Z-A)
- [ ] **3.12** Paginacja — jeśli jest więcej niż X wyników, pojawia się stronicowanie
- [ ] **3.13** Kliknięcie w rezerwację otwiera szczegóły

---

## ✏️ MODUŁ 4: Rezerwacje — Edycja

> *Goście zmieniają zdanie. To irytujące, ale musimy to obsługiwać sprawnie i bezbłędnie.*

- [ ] **4.1** Przycisk „Edytuj" jest dostępny dla każdej rezerwacji
- [ ] **4.2** Formularz edycji wczytuje aktualne dane (NIE puste pola!)
- [ ] **4.3** Zmiana daty — system sprawdza dostępność po zmianie
- [ ] **4.4** Zmiana pokoju — pokazuje tylko dostępne pokoje na nowe daty
- [ ] **4.5** Zapis zmian aktualizuje rezerwację (stare dane znikają)
- [ ] **4.6** Historia zmian — czy system loguje kto i kiedy edytował? (pożądane)
- [ ] **4.7** Anulowanie edycji (przycisk „Cofnij") nie zapisuje zmian

---

## ❌ MODUŁ 5: Anulowanie Rezerwacji

> *Anulowanie to poważna czynność. Musi być zabezpieczona przed przypadkowym kliknięciem.*

- [ ] **5.1** Przycisk „Anuluj rezerwację" wymaga potwierdzenia (okno dialogowe „Czy na pewno?")
- [ ] **5.2** Po anulowaniu — status rezerwacji zmienia się na „Anulowana"
- [ ] **5.3** Anulowana rezerwacja zwalnia pokój (staje się dostępny dla innych dat)
- [ ] **5.4** Anulowanej rezerwacji NIE można edytować
- [ ] **5.5** Anulowana rezerwacja nadal widoczna na liście (nie znika — to ważne dla historii!)

---

## 🏨 MODUŁ 6: Zarządzanie Pokojami

> *Pokoje to nasz produkt. Muszą być w systemie w 100% zgodne ze stanem faktycznym.*

- [ ] **6.1** Lista pokojów jest kompletna (wszystkie pokoje hotelu są na liście)
- [ ] **6.2** Każdy pokój ma: numer, typ, pojemność, cenę za dobę
- [ ] **6.3** Status pokoju: Dostępny / Zajęty / W serwisie — wyświetla się poprawnie
- [ ] **6.4** Zmiana statusu na „W serwisie" blokuje możliwość rezerwacji tego pokoju
- [ ] **6.5** Dodanie nowego pokoju — formularz działa
- [ ] **6.6** Edycja ceny pokoju — zmiana działa i zapisuje się
- [ ] **6.7** Usunięcie pokoju — czy system ostrzega jeśli pokój ma aktywne rezerwacje?

---

## 💰 MODUŁ 7: Rozliczenia i Płatności

> *NAJWAŻNIEJSZY MODUŁ. Błąd tutaj = strata pieniędzy = katastrofa. Sprawdzam TRZY RAZY.*

- [ ] **7.1** Automatyczne wyliczenie ceny: liczba nocy × cena za dobę = kwota całkowita
  - *Przykład kontrolny: 3 noce × 250 zł = 750 zł. System musi pokazać 750 zł.*
- [ ] **7.2** Dodatkowe usługi (śniadania, parking, itp.) dodają się do rachunku
- [ ] **7.3** Rabat procentowy — czy wyliczany jest poprawnie?
  - *Przykład: 750 zł − 10% = 675 zł. Sprawdzić dokładnie.*
- [ ] **7.4** Podatek VAT — czy naliczany jest zgodnie z przepisami?
- [ ] **7.5** Faktura/paragon — generuje się po zamknięciu rachunku
- [ ] **7.6** Faktura zawiera: dane hotelu, NIP, dane gościa, pozycje, kwoty, datę
- [ ] **7.7** Drukowanie faktury działa (lub zapis do PDF)
- [ ] **7.8** Zapis płatności: gotówka / karta / przelew
- [ ] **7.9** Po oznaczeniu jako „Zapłacone" — status rezerwacji się aktualizuje
- [ ] **7.10** Raport dzienny: suma przychodów zgadza się z sumą płatności
- [ ] **7.11** Nie można wystawić faktury dwa razy za tę samą rezerwację

---

## 🛎️ MODUŁ 8: Check-in / Check-out

> *Procedura zameldowania i wymeldowania musi być szybka i niezawodna. Gość czeka przy ladzie.*

- [ ] **8.1** Przycisk „Check-in" dostępny dla rezerwacji w dniu przyjazdu
- [ ] **8.2** Check-in zmienia status na „Zameldowany"
- [ ] **8.3** Po check-in pokój zmienia status na „Zajęty"
- [ ] **8.4** Przycisk „Check-out" dostępny dla zameldowanych gości
- [ ] **8.5** Check-out generuje podsumowanie rachunku
- [ ] **8.6** Check-out bez uregulowania należności — czy system ostrzega?
- [ ] **8.7** Po check-out pokój zmienia status na „Dostępny" (lub „W sprzątaniu")
- [ ] **8.8** Wcześniejszy check-out — system pyta o przeliczenie rachunku

---

## 📊 MODUŁ 9: Raporty i Statystyki

> *Dane to wiedza. Wiedza to kontrola. Kontrola to spokój ducha.*

- [ ] **9.1** Raport obłożenia hotelu — generuje się dla wybranego okresu
- [ ] **9.2** Raport przychodów — poprawne sumy
- [ ] **9.3** Raport „Dzisiejsze przyjazdy" — drukuję go co rano, MUSI działać
- [ ] **9.4** Raport „Dzisiejsze wyjazdy" — jak wyżej
- [ ] **9.5** Eksport do Excel/CSV — plik się pobiera i otwiera poprawnie
- [ ] **9.6** Eksport do PDF — czytelny wydruk

---

## 🔔 MODUŁ 10: Powiadomienia i Komunikacja

> **⚠️ UWAGA:** Jeśli system NIE wysyła e-maili automatycznie — zaznacz punkty jako **N/A** lub **Niezaimplementowane** i odnotuj to w Rejestrze Błędów jako wymaganie do realizacji.

- [ ] **10.1** E-mail potwierdzający rezerwację wysyłany automatycznie do gościa
- [ ] **10.2** E-mail z przypomnieniem przed przyjazdem (np. 24h wcześniej)
- [ ] **10.3** E-mail trafia na właściwy adres (nie gdzieś indziej!)
- [ ] **10.4** Treść e-maila zawiera numer rezerwacji, daty, pokój, cenę

---

## 👥 MODUŁ 11: Zarządzanie Użytkownikami Systemu

### Definicja ról (do weryfikacji)

| Rola | Uprawnienia |
|------|-------------|
| **Administrator** | Pełny dostęp: zarządzanie użytkownikami, ustawienia systemu, raporty finansowe, wszystkie moduły |
| **Recepcjonista** | Rezerwacje, check-in/out, folio, lista gości, pokoje (wyświetlanie), raporty operacyjne. **NIE widzi:** Ustawienia, Zarządzanie użytkownikami, wrażliwe dane finansowe (jeśli rozdzielone) |
| **Podgląd** | Tylko odczyt: lista rezerwacji, dashboard, raporty. Brak edycji, tworzenia, usuwania |

- [ ] **11.1** Można dodać nowego pracownika (konto użytkownika)
- [ ] **11.2** Role: Administrator / Recepcjonista / Podgląd — różne uprawnienia
- [ ] **11.3** Recepcjonista NIE widzi opcji administracyjnych (lista: Ustawienia, Zarządzanie użytkownikami — sprawdzić konkretnie)
- [ ] **11.4** Zmiana hasła — działa
- [ ] **11.5** Dezaktywacja pracownika — czy nie może się zalogować po dezaktywacji?

---

## 🖥️ MODUŁ 12: Ogólna Techniczna Jakość Systemu

> *Detale mają znaczenie. Zawsze.*

- [ ] **12.1** Strony ładują się w rozsądnym czasie (poniżej 3 sekund)
- [ ] **12.2** Błędy 404 / 500 nie pojawiają się podczas normalnego użytkowania
- [ ] **12.3** System działa w Chrome, Firefox, Edge (przynajmniej te trzy)
- [ ] **12.4** Responsywność — czy działa na tablecie (recepcja czasem używa iPada)
- [ ] **12.5** Sesja wygasa po **X minutach** bezczynności (zabezpieczenie!)
  - *Wartość X skonfigurowana w systemie: ________ minut (zalecane: 15–30)*
  - *Sprawdzenie: zaloguj się, poczekaj X min bez ruchu, wykonaj akcję → powinno przekierować na logowanie*
- [ ] **12.6** Komunikaty błędów są po polsku i zrozumiałe
- [ ] **12.7** Brak literówek w interfejsie (tak, sprawdzam to też)
- [ ] **12.8** Wszystkie przyciski mają czytelne etykiety (nie „Button1", „Submit2")

---

## 🔄 TESTY REGRESJI (po naprawie błędów)

> *Każdy krytyczny i wysoki błąd MUSI być przetestowany ponownie po jego naprawie.*

| Błąd | Data naprawy | Przetestowano ponownie (data) | Wynik |
|------|--------------|-------------------------------|-------|
| BUG- | | | ⬜ ✅ ❌ |
| BUG- | | | ⬜ ✅ ❌ |
| BUG- | | | ⬜ ✅ ❌ |

*Legenda: ⬜ Nie sprawdzono | ✅ Działa poprawnie | ❌ Nadal występuje*

---

## 📝 MATRYCA KRYTYCZNOŚCI

| Moduł | Krytyczność | Konsekwencja błędu |
|-------|-------------|-------------------|
| Logowanie | 🔴 KRYTYCZNA | Brak dostępu / nieautoryzowany dostęp |
| Tworzenie rezerwacji | 🔴 KRYTYCZNA | Strata gościa, podwójna rezerwacja |
| Rozliczenia | 🔴 KRYTYCZNA | Strata finansowa, błąd księgowy |
| Check-in/Check-out | 🔴 KRYTYCZNA | Chaos operacyjny na recepcji |
| Wyszukiwanie | 🟠 WYSOKA | Opóźnienia w obsłudze |
| Edycja rezerwacji | 🟠 WYSOKA | Błędne dane gościa |
| Raporty | 🟡 ŚREDNIA | Błędne dane do zarządzania |
| Powiadomienia | 🟡 ŚREDNIA | Zła komunikacja z gościem |
| Zarządzanie pokojami | 🟠 WYSOKA | Błędna dostępność |
| Użytkownicy | 🟡 ŚREDNIA | Problem z dostępami |

---

## ✅ ARKUSZ WYNIKÓW TESTÓW

| Nr | Moduł | Scenariusz | Wynik | Uwagi | Data testu |
|----|-------|------------|-------|-------|------------|
| 1 | Logowanie | Poprawne logowanie | ⬜ | | |
| 2 | Logowanie | Błędne hasło | ⬜ | | |
| 3 | Rezerwacje | Nowa rezerwacja | ⬜ | | |
| 4 | Rezerwacje | Walidacja dat | ⬜ | | |
| 5 | Rozliczenia | Kalkulacja ceny | ⬜ | | |
| ... | ... | ... | ⬜ | | |

*Legenda: ✅ Działa poprawnie | ❌ Błąd — wymaga naprawy | ⚠️ Działa z zastrzeżeniami | ⬜ Nie sprawdzono | N/A Niezaimplementowane*

---

## 🚨 REJESTR BŁĘDÓW

| ID | Moduł | Opis błędu | Krytyczność | Status |
|----|-------|-----------|-------------|--------|
| BUG-001 | | | | Otwarty |

---

> 💬 *„System, który nie został przetestowany, jest systemem czekającym na awarię w najbardziej nieodpowiednim momencie — czyli podczas największego wesela roku."*
>
> — Recepcjonista, który sprawdza wszystko dwa razy, bo jeden raz to za mało

---
*Dokument: UAT_Plan_v1.1 | Autor: Recepcja | Ostatnia weryfikacja dokumentu: 2026-02-20*
*Zmiany v1.1: środowisko testowe, doprecyzowanie 2.12/11/12.5, testy regresji, matryca ról*
