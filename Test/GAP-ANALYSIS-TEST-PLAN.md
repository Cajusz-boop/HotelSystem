# Plan testów – wykrywanie braków funkcjonalnych (Gap Analysis)

**Cel:** Znajdowanie **brakujących funkcji** i **niedostępnych operacji**, które użytkownik (recepcja, manager) mógłby oczekiwać w systemie hotelowym, a które nie są zaimplementowane lub nie są testowane.

**Zasada:** Dla każdego obszaru zadaj pytania w stylu: *„Czy użytkownik może…?”*, *„Czy istnieje sposób na…?”*, *„Czy da się zobaczyć/zmienić…?”*. Jeśli odpowiedź brzmi „nie” lub „nie wiadomo” – to **luka** do odnotowania i ewentualnie uzupełnienia w produkcie lub w testach.

**W tym dokumencie:** tylko plan (pytania, obszary, kryteria). Żadnych scenariuszy krok-po-kroku ani kodu testów.

---

## 1. Tape Chart (Grafik) – nawigacja w czasie i przestrzeni

### 1.1 Przesuwanie / przewijanie osi czasu (przykład z briefu)

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy użytkownik może przesunąć widok kalendarza w przód (np. na maj, czerwiec)?** | Brak przewijania lub „przesuwania kratek” w prawo – rezerwacje w maju są niewidoczne, jeśli zakres jest np. luty–kwiecień. | Typowa luka: stały zakres dat (np. „dziś” + 60 dni) bez możliwości przejścia do dowolnego miesiąca. |
| **Czy użytkownik może cofnąć widok w czasie (np. zobaczyć styczeń)?** | Brak możliwości cofnięcia się do przeszłości – nie da się sprawdzić, co było zarezerwowane w poprzednich miesiącach. | Przydatne przy rozliczeniach, reklamacjach, audytach. |
| **Czy istnieje „idź do daty” / wybór miesiąca (date picker, przyciski „następny miesiąc”)?** | Brak kontroli „przejdź do maja” – użytkownik nie może celowo otworzyć widoku na wybrany miesiąc. | Często brak w MVP. |
| **Czy zakres dat zależy od „dzisiejszej” daty w systemie, czy od daty zahardkodowanej?** | Zahardkodowana „dziś” (np. 2026-02-07) – wdrożenie nie widzi „prawdziwej” daty; recepcja nie widzi aktualnego „dziś”. | Luka konfiguracji / danych. |

### 1.2 Przewijanie i skala (dużo pokoi / dużo dni)

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy przy wielu pokojach (np. 50–200) istnieje pionowe przewijanie z zachowaniem nagłówka (sticky)?** | Brak sticky header przy scrollu – po przewinięciu w dół traci się widoczność etykiet dni. | Krytyczne dla hoteli 50–200 pokoi. |
| **Czy przy wielu dniach istnieje poziome przewijanie z zachowaniem kolumny „numer pokoju”?** | Brak sticky pierwszej kolumny – po przewinięciu w prawo traci się informacja, który rząd to który pokój. | Standard w Ganttach. |
| **Czy po przewinięciu (scroll) paski rezerwacji pozostają poprawnie wyrównane do komórek?** | Błędy pozycjonowania (absolute vs scroll) – paski „uciekają” względem siatki. | Luka techniczna / layout. |
| **Czy da się zmienić „gęstość” widoku (np. mniej dni na ekranie, szersze komórki)?** | Brak zoom / zmiany skali – zawsze ta sama szerokość dnia; niewygodne na dużych zakresach. | Opcjonalne, ale typowy brak. |

### 1.3 Odnajdywanie rezerwacji i kontekst

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy z poziomu Tape Chart można wyszukać gościa / rezerwację i od razu zobaczyć ją na grafiku (np. podświetlenie, skok do daty)?** | Brak „znajdź i pokaż na grafiku” – Command Palette może prowadzić do gościa, ale bez kontekstu „gdzie na kalendarzu”. | Luka UX. |
| **Czy po kliknięciu w rezerwację widać pełne dane (daty, pokój, status, zaliczki) bez konieczności zgadywania?** | Sheet edycji może nie pokazywać wszystkich pól (np. zaliczki, źródło rezerwacji). | Luka kompletności formularza. |
| **Czy da się zobaczyć listę rezerwacji na wybrany dzień (widok „dzień”) zamiast tylko Gantt?** | Brak widoku „dzień X – lista przyjazdów/wyjazdów” – tylko Gantt. | Często brak w MVP. |

### 1.4 Eksport i drukowanie

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy można wydrukować lub wyeksportować (PDF/obraz) fragment grafiku (np. tydzień, wybrane pokoje)?** | Brak druku / eksportu Tape Chart – recepcja nie może „wziąć grafiku na kartce”. | Typowy brak. |
| **Czy widok druku uwzględnia przewinięty obszar czy tylko „pierwszą stronę”?** | Drukuje się tylko to, co na ekranie – brak „drukuj cały zakres” lub „drukuj zaznaczony obszar”. | Luka przy druku. |

---

## 2. Meldunek (Check-in) i rezerwacje

### 2.1 Wybór dat i pokoju

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy użytkownik może wybrać datę zameldowania / wymeldowania z kalendarza (zamiast stałej „jutro”)?** | Daty ustawione na sztywno (np. jutro–pojutrze) – brak date pickera. | Krytyczne dla realnego obiegu. |
| **Czy przy tworzeniu rezerwacji z meldunku można wybrać pokój z listy (np. wolne pokoje w danym dniu) zamiast jednego stałego?** | Stały pokój (np. 101) w formularzu – brak wyboru pokoju. | Luka biznesowa. |
| **Czy system pokazuje, które pokoje są wolne w wybranych datach (zanim zapisze rezerwację)?** | Brak podglądu dostępności – użytkownik nie wie, czy wybrany pokój jest wolny. | Luka UX. |

### 2.2 Goście i duplikaty

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy przed utworzeniem rezerwacji można wyszukać istniejącego gościa (np. po nazwisku), żeby uniknąć duplikatów?** | Brak „szukaj gościa” w formularzu meldunku – ryzyko wielu kartotek tego samego gościa. | Luka danych / RODO. |
| **Czy po wpisaniu MRZ system sprawdza, czy gość już istnieje (np. po numerze dokumentu)?** | MRZ tylko wypełnia pola – brak sprawdzenia „czy ten dokument już jest w bazie”. | Luka integralności. |

### 2.3 Dokumenty i MRZ

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy obsługiwane są różne formaty MRZ (2 linie vs 3 linie, paszport vs dowód)?** | Parser może zakładać jeden format – inne dokumenty nie wypełniają pól. | Luka brzegowa. |
| **Czy po „Parse & Forget” użytkownik widzi jasną informację, że plik nie został zapisany?** | Brak wyraźnej informacji o tym, że zdjęcie dowodu nie jest przechowywane (RODO). | Luka komunikacji. |

---

## 3. Finance – kompletność i bezpieczeństwo

### 3.1 Night Audit

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy można uruchomić Night Audit drugi raz w tej samej dobie i co się wtedy dzieje (blokada / komunikat)?** | Brak zabezpieczenia przed podwójnym zamknięciem – ryzyko błędów w raportach. | Luka biznesowa. |
| **Czy po Night Audit użytkownik widzi jasno, które transakcje są „zamrożone” (readonly)?** | Brak wizualnej informacji w UI (np. w raportach, w liście transakcji), że dane są tylko do odczytu. | Luka UX. |
| **Czy raport dobowy (Management Report) jest dostępny od razu po Night Audit (np. link / automatyczne otwarcie)?** | Raport może być tylko z Reports po dacie – brak bezpośredniego powiązania „zamknąłem dobę → oto raport”. | Luka procesu. |

### 3.2 Blind Drop i Void

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy kasjer może zobaczyć historię Blind Dropów (kto, kiedy, jaka kwota, manko/superata)?** | Brak listy / raportu zamknięć zmiany – brak audytu kasowy. | Luka audytu. |
| **Czy przy Void użytkownik wybiera transakcję z listy (np. z dzisiejszych), czy musi znać ID?** | Wymóg wpisania ID transakcji – brak listy transakcji do anulowania. | Luka UX. |
| **Czy po błędnym PINie jest ograniczenie prób (np. blokada po 3 nieudanych)?** | Brak limitu prób – ryzyko brute force. | Luka bezpieczeństwa. |

### 3.3 Zaliczki (Deposit)

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy w UI widać, że zaliczka została zarejestrowana i czy jest powiązana z rezerwacją?** | Deposit Management może być tylko w specyfikacji – brak widocznego flow w aplikacji. | Luka funkcjonalna. |
| **Czy raport dobowy / zestawienie zawiera zaliczki osobno (np. typ DEPOSIT)?** | Brak rozbicia po typach w raportach – trudna analiza. | Luka raportowania. |

---

## 4. Housekeeping – offline i skala

### 4.1 Synchronizacja i konflikty

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy użytkownik (pokojowa) widzi jasny komunikat, gdy zastosowano „Server Wins” (np. „Status pokoju został nadpisany przez recepcję”)?** | Brak czytelnej informacji o konflikcie – użytkownik nie wie, dlaczego jego zmiana zniknęła. | Luka UX. |
| **Czy da się zobaczyć listę zmian oczekujących na sync („pending”)?** | Brak widoku „te zmiany zostaną wysłane, gdy będzie sieć”. | Luka transparentności. |
| **Czy przy długotrwałej utracie sieci (np. cały dzień) nie dochodzi do utraty danych (limit localStorage, nadpisanie)?** | Ryzyko przepełnienia lub nadpisania danych offline. | Luka techniczna. |

### 4.2 Usterki i powiadomienia

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy po zgłoszeniu usterki (OOO) recepcja / dashboard dostaje widoczną informację (np. powiadomienie, lista „nowe OOO”)?** | Spec mówi o „notyfikacji do Dashboardu” – może nie być zaimplementowane lub widoczne. | Luka procesu. |
| **Czy można edytować lub anulować zgłoszenie usterki (np. pomyłka)?** | Brak cofnięcia OOO lub edycji przyczyny. | Luka UX. |

### 4.3 Skala i filtry

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy da się filtrować pokoje (np. tylko piętro 1, tylko DIRTY)?** | Brak filtrów – przy 200 pokojach lista jest długa. | Luka skalowalności. |
| **Czy da się zmienić status wielu pokoi naraz (zbiorcze CLEAN)?** | Brak akcji grupowej – tylko pojedyncze zmiany. | Luka produktywności. |

---

## 5. Dashboard i dane „na dziś”

### 5.1 Data i aktualność

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy na Dashboardzie widać, za jaki dzień są dane („VIP Arrival – na dzień 2026-02-08”)?** | Brak wyświetlania daty kontekstu – użytkownik nie wie, czy to „dziś” z serwera. | Luka transparentności. |
| **Czy VIP Arrival / Dzisiejsze check-iny używają rzeczywistej daty serwera, czy zahardkodowanej?** | Zahardkodowana data – dashboard nie odzwierciedla realnego „dziś”. | Luka konfiguracji. |
| **Czy po zmianie daty (np. po Night Audit) dashboard odświeża się automatycznie lub po odświeżeniu strony?** | Brak odświeżania – możliwe nieaktualne widgety. | Luka spójności. |

### 5.2 Kompletność widgetów

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy z widgetu VIP Arrival / Dzisiejsze check-iny można przejść do rezerwacji (np. klik → Tape Chart z zaznaczoną rezerwacją)?** | Widgety tylko informacyjne – brak akcji „przejdź do rezerwacji”. | Luka UX. |
| **Czy z listy Dirty Rooms można przejść do Housekeeping z filtrem „DIRTY” lub do konkretnego pokoju?** | Brak linków kontekstowych. | Luka nawigacji. |

---

## 6. Raporty i eksport

### 6.1 Dostępność i zakres

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy raport dobowy można wygenerować dla dowolnej daty (także przyszłej)?** | Ograniczenie do przeszłości lub brak walidacji – niejasne zachowanie. | Luka brzegowa. |
| **Czy istnieje raport „rezerwacje w okresie X–Y” (np. wszystkie rezerwacje na maj)?** | Brak raportu rezerwacji po zakresie dat – tylko Management Report (transakcje). | Luka raportowania. |
| **Czy raport można wyeksportować (CSV, Excel) oprócz druku/PDF?** | Tylko drukowanie – brak eksportu do arkusza. | Luka eksportu. |

---

## 7. Command Palette i wyszukiwanie

### 7.1 Zakres i akcje

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy wyszukiwanie gościa zwraca także rezerwacje (np. „Jan Kowalski – 3 rezerwacje”)?** | Może zwracać tylko listę gości bez kontekstu rezerwacji. | Luka użyteczności. |
| **Czy z wyniku wyszukiwania można od razu otworzyć edycję rezerwacji lub Tape Chart na tej rezerwacji?** | Brak akcji „otwórz na grafiku” / „edytuj rezerwację”. | Luka UX. |
| **Czy w Command Palette są akcje „Nowa rezerwacja”, „Meldunek” (nie tylko Grafik)?** | Może brakować skrótów do innych modułów. | Luka kompletności. |

---

## 8. API zewnętrzne i integracje

### 8.1 Dostępność i dokumentacja

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy endpoint availability przyjmuje zakres dat (od–do) i zwraca wolne pokoje?** | Może zwracać tylko „wolne / zajęte” bez szczegółów lub z ograniczonym zakresem. | Luka dla Channel Managera. |
| **Czy API jest udokumentowane (OpenAPI, przykład wywołania)?** | Brak dokumentacji – integracje „w ciemno”. | Luka dla partnerów. |
| **Czy błędy API zwracają czytelne kody i opisy (np. 400 – brak parametru „date”)?** | Ogólne 500 lub niejasne komunikaty. | Luka integracji. |

---

## 9. Bezpieczeństwo i uprawnienia

### 9.1 Audyt i użytkownicy

| Pytanie | Opis luki | Uwagi |
|---------|-----------|--------|
| **Czy w aplikacji widać, kto jest zalogowany (np. „Zalogowany: Jan Manager”)?** | Brak koncepcji użytkownika – AuditLog może nie mieć sensownego userId. | Luka audytu. |
| **Czy Night Audit / Void wymagają innego poziomu uprawnień niż zwykła recepcja?** | Wszyscy mogą zamknąć dobę lub zrobić void – brak ról. | Luka bezpieczeństwa. |
| **Czy istnieje widok / raport „Audit Trail” (kto, kiedy, co zmienił)?** | Audit w bazie, ale brak UI do przeglądania. | Luka nadzoru. |

---

## 10. Jak używać tego planu

1. **Przejdź obszar po obszarze** (Tape Chart, Meldunek, Finance, Housekeeping, Dashboard, Raporty, Command Palette, API, Bezpieczeństwo).
2. **Dla każdego pytania:** sprawdź w aplikacji (ręcznie lub w testach), czy odpowiedź brzmi „tak” czy „nie”.
3. **Odnotuj luki:** tam gdzie „nie” – wpisz do listy braków (np. w pliku BRAKI-FUNKCJONALNE.md lub w backlogu).
4. **Priorytetyzuj:** np. „przesunięcie Tape Chart na maj” (nawigacja) vs „drukowanie grafiku” (eksport) vs „historia Blind Drop” (audyt).
5. **Nie implementuj od razu testów automatycznych** dla brakujących funkcji – najpierw ustal, czy funkcja ma być zaimplementowana w produkcie; potem można dodać testy weryfikujące jej istnienie i zachowanie.

---

**Koniec planu.**  
Dokument służy wyłącznie do **wykrywania braków**; nie zawiera scenariuszy testowych ani kodu.
