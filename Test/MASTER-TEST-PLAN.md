# Master Test Plan – Hotel PMS (Tape Chart / Rezerwacje)

**Rola:** Senior QA Automation Engineer (Playwright)  
**Cel:** Kompleksowy plan testów z identyfikacją „ślepych plamek” i niestandardowych zachowań UI.

---

## 1. Zakres i kontekst

### 1.1 Moduły w scope

| Moduł | Opis | Źródło prawdy |
|-------|------|----------------|
| **Dashboard** | Strona główna: VIP Arrival, Dirty Rooms, OOO, Dzisiejsze check-iny | `app/page.tsx`, `actions/dashboard.ts` |
| **Front Office / Tape Chart** | Kalendarz Gantt (oś X: dni, oś Y: pokoje), DnD, Undo/Redo, Room Guard, Privacy Mode, Sheet (edycja/nowa rezerwacja) | `components/tape-chart/*`, `app/front-office/page.tsx` |
| **Meldunek (Check-in)** | Formularz gościa, MRZ, Parse & Forget (upload dowodu) | `app/check-in/page.tsx`, `guest-check-in-form.tsx` |
| **Finance** | Night Audit, Blind Drop, Void Security (PIN) | `app/finance/page.tsx`, `actions/finance.ts` |
| **Housekeeping** | Statusy pokoi (CLEAN/DIRTY/OOO), offline-first, sync, zgłoszenie usterki | `app/housekeeping/page.tsx`, `lib/housekeeping-offline.ts` |
| **Reports** | Raport dobowy (Management Report) po dacie | `app/reports/page.tsx` |
| **Command Palette** | Ctrl+K / Cmd+K, wyszukiwanie gościa/pokoju, szybkie akcje | `components/command-palette.tsx` |
| **Nawigacja** | Sidebar, linki, główne trasy | `components/app-sidebar.tsx`, `layout.tsx` |
| **API zewnętrzne** | `/api/v1/external/availability`, `/api/v1/external/posting` | `app/api/v1/external/*` |

**Moduły brakujące (luka – nie były w oryginalnej specyfikacji / roadmap):**

| Moduł | Opis | Uwagi |
|-------|------|--------|
| **Cennik** | Zarządzanie cenami pokoi (lista, edycja `Room.price`), opcjonalnie stawki sezonowe | Obecnie brak strony `/cennik`, brak pozycji w sidebarze; ceny tylko w seedzie i w edycji pokoju (jeśli jest). Testy nie wykryły braku, bo moduł nie był w scope. Po implementacji dodać do scope i scenariusze (wyświetlanie cen, edycja, audit). |

### 1.2 Założenia techniczne (ważne dla testów)

- **UI:** Sheet/Drawer zamiast modali – brak standardowego `role="dialog"` w części widoków.
- **Toast:** Sonner (pozycja, selektory, czas życia) – nie zakładać jednego wspólnego wzorca dla wszystkich komunikatów.
- **Tape Chart:** „Dziś” i zakres dat mogą być zahardkodowane (np. 2026-02-07 + 60 dni) – testy nie powinny polegać na „dzisiejszej” dacie w UI.
- **Dane:** Seed (Prisma) definiuje pokoje i początkowe rezerwacje – testy muszą być odporne na stan bazy (np. wielokrotne uruchomienia, różne środowiska).

---

## 2. Ślepe plamki i niestandardowe zachowania

Poniższe punkty są **źródłem nieskutecznych testów** lub braku pokrycia. Każdy scenariusz w rozdziale 4 powinien je uwzględniać.

### 2.1 Tape Chart (Grafik)

| Ślepa plamka | Opis | Wpływ na testy |
|--------------|------|-----------------|
| **Klik w „puste pole”** | Klik w pustą komórkę dnia otwiera **formularz nowej rezerwacji** (nie kontekstowe menu, nie podwójne kliknięcie). Komórka może być **przykryta paskiem rezerwacji** – zwykły `click()` trafia w pasek (edycja), nie w komórkę. | Używać `evaluate(click)` lub wybierać komórki gwarantowanie wolne (pokój + data bez rezerwacji). |
| **Drag & Drop** | Użycie **@dnd-kit** – programowe `locator.dragTo()` **nie wywołuje** `onDragEnd`. Próby weryfikacji „przeciągnij na DIRTY → toast” w E2E są zawodne. | Room Guard (DnD na DIRTY/OOO): weryfikacja ręczna lub mock/symulacja; E2E ograniczyć do asercji stanu (np. pokój 102 = DIRTY). |
| **Privacy Mode** | Włączony domyślnie – **nazwiska na paskach są zamazane** (np. „J. K*****”). Asercje na pełne imię/nazwisko bez wyłączenia Privacy dadzą fail. | Przed asercjami na tekst gościa: wyłączyć Privacy Mode lub asercje na zamazany format. |
| **Overlay vs grid** | Paski rezerwacji są w **overlayu** (absolute), komórki dni w gridzie pod spodem. Kolejność zdarzeń i „co jest klikalne” zależy od `pointer-events`. | Nie zakładać, że „klik w (x,y) komórki” trafi w komórkę; w razie wątpliwości – `force: true` lub `evaluate(click)`. |
| **Undo/Redo** | Historia tylko **ostatnie 5 akcji**; po 6. ruchu najstarsza znika. Skróty Ctrl+Z / Ctrl+Y oraz przyciski. | Testy graniczne: 5× Undo, 6. akcja – brak dalszego Undo; Redo po Undo. |
| **Room Guard** | Upuszczenie na **DIRTY** lub **OOO** → toast błędu, rezerwacja **nie** zmienia pokoju. | E2E: asercja treści toastu lub widoczność komunikatu; nie polegać na DnD w Playwright. |

### 2.2 Formularze i Sheet

| Ślepa plamka | Opis | Wpływ na testy |
|--------------|------|-----------------|
| **Edycja vs Nowa rezerwacja** | **Edycja** – tylko po kliknięciu w **pasek** (otwiera Sheet „Edycja rezerwacji”). **Nowa** – tylko po kliknięciu w **komórkę** (Sheet „Nowa rezerwacja”). Brak „nowej rezerwacji” z menu kontekstowego paska. | Scenariusze rozdzielić: źródło wejścia (pasek vs komórka) i oczekiwany tytuł/formularz. |
| **Status w UI** | W formularzach status może być **po polsku** (Potwierdzona, Zameldowany…) lub enum (CONFIRMED). Listy rozwijane – wartość vs etykieta. | Selektory: `selectOption({ label: 'Potwierdzona' })` lub `value: 'CONFIRMED'` w zależności od implementacji. |
| **Zamknięcie Sheet** | Anuluj / klik poza / Escape – Sheet się zamyka; **bez zapisu**. Nie zakładać automatycznego „Save” przy zamknięciu. | Scenariusze: zapis tylko po „Zapisz”; anulowanie nie zmienia danych na grafiku. |

### 2.3 Meldunek (Check-in)

| Ślepa plamka | Opis | Wpływ na testy |
|--------------|------|-----------------|
| **Parse & Forget** | Upload „dowodu” to **symulacja OCR** – dane z pliku nie są odczytywane; formularz wypełniany mockiem; **plik nie jest zapisywany**. | Nie asercje na „prawdziwe” dane z pliku; asercje na toast sukcesu i wypełnione pola (wartości mock). |
| **MRZ** | Wpisanie MRZ i **blur** uzupełnia „Imię i nazwisko” (parsowanie po `<`). Format wyniku zależy od parsera (np. „IDPOLKOWALSKI, JAN”). | Testy MRZ: oczekiwana wartość = faktyczny wynik parsera (np. „IDPOLKOWALSKI, JAN”), nie „Kowalski, Jan” z mocka OCR. |
| **Walidacja** | Pole „Imię i nazwisko” **required** (HTML). Submit z pustym – brak toastu sukcesu, brak nawigacji. | Negatywny scenariusz: pusty wymagany → brak utworzenia rezerwacji. |

### 2.4 Finance

| Ślepa plamka | Opis | Wpływ na testy |
|--------------|------|-----------------|
| **Blind Drop** | Różnica (manko/superata) widoczna **dopiero po zatwierdzeniu**; wcześniej kasjer widzi tylko pole „policzona gotówka”. | Flow: wpisanie kwoty → klik „Zatwierdź” → dopiero wtedy asercja na „Manko”/„Superata”/„Oczekiwano”. |
| **Night Audit** | Po uruchomieniu transakcje z daty &lt; dziś **readonly** – brak w pełni weryfikowalnego E2E bez mocka czasu. | Scenariusze: przycisk „Zamknij dobę” i toast/komunikat; ewentualna weryfikacja readonly w osobnym scope (np. API). |
| **Void** | Wymagany **PIN managera** – niepełna wiedza o poprawnym PINie w testach. | Testy: poprawne PIN → sukces; błędny PIN → komunikat błędu; walidacja pustego PIN/ID transakcji. |

### 2.5 Housekeeping

| Ślepa plamka | Opis | Wpływ na testy |
|--------------|------|-----------------|
| **Offline-first** | Stan **localStorage/IndexedDB**; po powrocie online **sync** z konfliktem „Server Wins”. | E2E: symulacja offline (np. `page.context().setOffline(true)`), zmiana statusu, powrót online – weryfikacja toastu/sync; nie zakładać, że zawsze jest tylko jedna „prawda”. |
| **Zgłoszenie usterki** | Zmienia status na **OOO**, opcjonalny powód; może wymagać wyboru pokoju i potwierdzenia. | Scenariusz: wybór pokoju → formularz usterki → zapis → pokój w stanie OOO (na liście / Dashboard). |

### 2.6 Command Palette i nawigacja

| Ślepa plamka | Opis | Wpływ na testy |
|--------------|------|-----------------|
| **Otwarcie** | Skrót **Ctrl+K** (Win/Linux) i **Cmd+K** (Mac). Nie zakładać jednego skrótu na wszystkich platformach. | Testy na obu wariantach lub parametrizacja po `browserName`/platformie. |
| **Wybór opcji** | Cmdk/Radix – **klik w option** może być zasłonięty (np. przez group). **Enter** po otwarciu często wybiera pierwszą opcję. | Preferować klawiaturę (Enter) do wyboru lub `click({ force: true })` na opcji. |
| **Nawigacja** | Sidebar **fixed**; główna treść z `pl-52` – linki muszą być widoczne i klikalne. | Asercje na URL po kliku; nie zakładać focusu w „standardowym” miejscu. |

### 2.7 Dashboard i Reports

| Ślepa plamka | Opis | Wpływ na testy |
|--------------|------|-----------------|
| **Dane zależne od dnia** | VIP Arrival, Dzisiejsze check-iny, Dirty Rooms zależą od **daty** i stanu bazy. | Asercje na „pusty stan” (np. „Brak przyjazdów”) lub na istnienie sekcji; unikać sztywnych list gości/pokoi. |
| **Raport dobowy** | Raport po **wybranej dacie**; możliwy brak danych dla przyszłości. | Scenariusz: wybór daty (np. wczoraj) → generowanie → widoczność raportu lub komunikatu błędu. |

### 2.8 API i backend

| Ślepa plamka | Opis | Wpływ na testy |
|--------------|------|-----------------|
| **Availability / Posting** | Endpointy zewnętrzne – **brak UI** do ich wywołania w aplikacji. | Pokrycie: testy API (request/response, auth jeśli jest) osobno; E2E nie „klikają” w te flow. |
| **Audit trail** | Zapis do AuditLog po mutacjach – **niewidoczny w UI**. | Weryfikacja w warstwie API/bazy lub integracyjnie; poza scope E2E UI. |

---

## 3. Ryzyka i ograniczenia

- **Stała data „dziś” w Tape Chart** – zmiana w kodzie (np. na realną datę) może złamać testy oparte na konkretnych `data-testid` (np. `cell-102-2026-03-30`). Zalecenie: konfigurowalna „dziś” lub testy odporne na zakres dat.
- **Wielokrotne uruchomienia** – baza nie jest czyszczona między testami; możliwe duplikaty gości/rezerwacji (np. „Jan Testowy” wielokrotnie). Asercje: `.first()`, liczba rezerwacji ≥ N, lub izolacja danych (np. unikalne nazwy).
- **Timing** – Sonner toasty, Sheet open/close, nawigacja – stosować `expect(…).toBeVisible({ timeout: … })` i unikać sztywnych `waitForTimeout`.
- **Środowisko** – testy zakładają działającą aplikację (np. `http://localhost:3000`) i przygotowaną bazę (seed). CI musi to zapewniać.

---

## 4. Lista scenariuszy testowych (Master List)

Poniżej **pełna lista scenariuszy** pogrupowana po modułach. Każdy powinien być zaimplementowany z uwzględnieniem ślepych plamek z sekcji 2.

---

### 4.1 Nawigacja i layout

- **NAV-01** Sidebar: wszystkie linki widoczne (Dashboard, Front Office, Meldunek, Housekeeping, Finance, Reports).
- **NAV-02** Klik każdego linku prowadzi do oczekiwanego URL (/, /front-office, /check-in, /housekeeping, /finance, /reports).
- **NAV-03** Aktywny link w sidebarze ma wyróżniony styl (np. active state).
- **NAV-04** Command Palette: Ctrl+K otwiera paletę (Desktop).
- **NAV-05** Command Palette: Cmd+K otwiera paletę (Mac / gdy używane).
- **NAV-06** Command Palette: placeholder/wyszukiwarka widoczny.
- **NAV-07** Command Palette: opcja „Grafik (Tape Chart)” / szybkie akcje widoczne.
- **NAV-08** Command Palette: wybór opcji (Enter lub klik) przekierowuje na odpowiednią stronę (np. /front-office).
- **NAV-09** Strona główna (Dashboard) ładuje się bez błędu; widoczne sekcje (np. VIP Arrival, Dirty Rooms, OOO).

---

### 4.2 Dashboard

- **DASH-01** Nagłówek „Dashboard” i przycisk „Otwórz Grafik” widoczne.
- **DASH-02** Sekcja VIP Arrival: widoczna; jeśli brak danych – komunikat typu „Brak przyjazdów”.
- **DASH-03** Sekcja Dirty Rooms: widoczna; jeśli brak danych – „Brak pokoi do sprzątania”.
- **DASH-04** Sekcja OOO: widoczna; jeśli brak danych – „Brak pokoi OOO”.
- **DASH-05** Sekcja „Dzisiejsze check-iny” pojawia się tylko gdy są dane (opcjonalnie).
- **DASH-06** Klik „Otwórz Grafik” prowadzi do /front-office.

---

### 4.3 Tape Chart (Grafik) – widok i interakcje

- **TC-01** Nagłówek „Tape Chart” widoczny.
- **TC-02** Kolumna „Room Number” i co najmniej jeden pokój (np. 101) widoczne.
- **TC-03** Przyciski Undo (Ctrl+Z) i Redo (Ctrl+Y) widoczne.
- **TC-04** Przełącznik Privacy Mode widoczny; domyślnie włączony (zalecane).
- **TC-05** Privacy Mode: po wyłączeniu paski pokazują pełne nazwisko (jeśli jest rezerwacja).
- **TC-06** Privacy Mode: przy włączonym – pasek pokazuje zamazane nazwisko (np. „(Privacy)”).
- **TC-07** Undo: przy braku historii przycisk Undo jest disabled.
- **TC-08** Redo: przy braku „przyszłej” historii przycisk Redo jest disabled.
- **TC-09** Jeśli są rezerwacje: co najmniej jeden pasek rezerwacji widoczny (data-testid reservation-bar).
- **TC-10** Klik w pasek rezerwacji otwiera Sheet (Edycja rezerwacji) – nie „Nowa rezerwacja”.
- **TC-11** Prawy klik na pasku rezerwacji otwiera menu kontekstowe (np. „Edytuj rezerwację”, „Check-in”, „Anuluj rezerwację”).
- **TC-12** Room Guard: pokój ze statusem DIRTY (np. 102) wyświetla etykietę DIRTY w wierszu.
- **TC-13** Room Guard: próba DnD na DIRTY – w E2E weryfikacja ręczna lub asercja toastu błędu (z uwagi na dnd-kit – patrz 2.1).
- **TC-14** Komórki dni mają data-testid w formacie `cell-{room}-{YYYY-MM-DD}` (np. cell-102-2026-03-30).
- **TC-15** Klik w pustą komórkę (np. przez evaluate(click) lub wolny pokój/data) otwiera Sheet „Nowa rezerwacja”.
- **TC-16** Formularz „Nowa rezerwacja”: pola Gość, Pokój (prefilled), Zameldowanie, Wymeldowanie, Status, Zapisz – widoczne po otwarciu z komórki.

---

### 4.4 Nowa rezerwacja (Create Reservation)

- **CR-01** Otwarcie z komórki: pokój i data zameldowania uzupełnione zgodnie z wybraną komórką.
- **CR-02** Wypełnienie: Gość „Jan Testowy”, Status „Potwierdzona” (lub CONFIRMED), Zapisz – sukces (toast „Rezerwacja utworzona”).
- **CR-03** Po zapisie: Sheet się zamyka; na grafiku pojawia się nowy pasek (z wyłączonym Privacy lub asercja na zamazany tekst).
- **CR-04** Walidacja: pusty Gość – Zapisz nie tworzy rezerwacji (brak toastu sukcesu lub błąd).
- **CR-05** Anuluj zamyka Sheet bez zapisu; liczba rezerwacji na grafiku bez zmian (opcjonalnie).

---

### 4.5 Edycja rezerwacji

- **ER-01** Otwarcie Sheet edycji po kliknięciu w pasek: tytuł „Edycja rezerwacji”, pola zgodne z rezerwacją.
- **ER-02** Zmiana gościa / dat / statusu i Zapisz – toast sukcesu; dane na pasku zaktualizowane (np. po odświeżeniu lub w stanie).
- **ER-03** Anuluj zamyka bez zapisu.
- **ER-04** Menu kontekstowe: „Check-in” – zmiana statusu na CHECKED_IN, toast.
- **ER-05** Menu kontekstowe: „Anuluj rezerwację” – status CANCELLED, toast (uwaga na disabled dla już anulowanych).

---

### 4.6 Meldunek (Check-in)

- **CI-01** Strona /check-in: nagłówek „Meldunek gościa” i formularz widoczne.
- **CI-02** Pola: Imię i nazwisko, Email, Telefon, Kod MRZ (dowód, skaner 2D) – widoczne.
- **CI-03** Przycisk „Zapisz gościa / Utwórz rezerwację” widoczny.
- **CI-04** Przycisk „Wgraj zdjęcie dowodu” (Parse & Forget) widoczny.
- **CI-05** Minimalny flow: tylko Imię i nazwisko → Zapisz → toast „Rezerwacja utworzona”, formularz wyczyszczony (puste pola).
- **CI-06** Pełny flow: Imię, email, telefon → Zapisz → toast.
- **CI-07** MRZ: wpisanie MRZ i blur → pole „Imię i nazwisko” uzupełnione (zgodnie z parserem, np. „IDPOLKOWALSKI, JAN”).
- **CI-08** Po udanym meldunku: wszystkie pola formularza puste (Parse & Forget – dane nie zostają).
- **CI-09** Walidacja: puste Imię i nazwisko → Submit nie tworzy rezerwacji (required, brak toastu sukcesu).
- **CI-10** (Opcjonalnie) Upload pliku (Parse & Forget): symulacja OCR – toast sukcesu, pola wypełnione mockiem; brak zapisu pliku – weryfikacja zachowania, nie prawdziwego OCR.
- **CI-11** Po meldunku: przejście na /front-office – Tape Chart ładuje się; liczba rezerwacji ≥ poprzedniej (nowa rezerwacja widoczna w zakresie dat).

---

### 4.7 Finance

- **FIN-01** Strona /finance: nagłówek „Finance” widoczny.
- **FIN-02** Sekcja Night Audit (Zamknięcie doby): widoczna; przycisk „Zamknij dobę” / „Zamykanie…”.
- **FIN-03** Sekcja Blind Drop: widoczna; pole „Policzona gotówka”, przycisk „Zatwierdź i pokaż różnicę”.
- **FIN-04** Blind Drop: wpisanie kwoty i zatwierdzenie – po zatwierdzeniu widoczny wynik (Oczekiwano, Wprowadzono, Manko/Superata).
- **FIN-05** Sekcja Void Security: nagłówek, pole PIN managera, ID transakcji, przycisk anulowania – widoczne.
- **FIN-06** Void: błędny lub pusty PIN – komunikat błędu (toast lub inline).
- **FIN-07** Void: poprawne ID i PIN – toast sukcesu (jeśli backend zwraca sukces; zależne od testowego PINu).
- **FIN-08** Night Audit: klik „Zamknij dobę” – toast z informacją o zamknięciu (bez weryfikacji readonly w UI w pierwszej iteracji).

---

### 4.8 Housekeeping

- **HK-01** Strona /housekeeping ładuje się; nagłówek „Housekeeping” widoczny.
- **HK-02** Wskaźnik Online/Offline (lub Ładowanie) widoczny.
- **HK-03** Lista pokoi z statusami (CLEAN, DIRTY, OOO) lub komunikat „Ładowanie” – co najmniej jeden stan widoczny.
- **HK-04** Zmiana statusu pokoju (np. CLEAN → DIRTY) – zapis, toast sukcesu (online).
- **HK-05** (Opcjonalnie) Offline: symulacja offline → zmiana statusu → toast „Offline – zmiana zapisana lokalnie”; powrót online → sync, toast synchronizacji.
- **HK-06** Zgłoszenie usterki: wybór pokoju → formularz (przyczyna) → Zgłoś – toast, pokój OOO (na liście lub Dashboard).

---

### 4.9 Reports

- **RPT-01** Strona /reports ładuje się; możliwość wyboru daty (np. data input).
- **RPT-02** Generowanie raportu (np. przycisk „Generuj” / „Pobierz”) – widoczność raportu lub komunikatu błędu.
- **RPT-03** Raport dla daty z przeszłości (np. wczoraj) – dane lub „Brak danych” (w zależności od implementacji).

---

### 4.10 Undo / Redo (granice)

- **UR-01** Wykonanie ruchu (np. przeniesienie rezerwacji) → Undo cofa; Redo przywraca (jeśli DnD da się wiarygodnie wykonać w E2E).
- **UR-02** Po 5 akcjach: 6. Undo nie usuwa starszej niż 5 (lub przycisk Undo disabled gdy brak historii) – weryfikacja granicy stosu.
- **UR-03** Skrót Ctrl+Z wywołuje Undo; Ctrl+Y (lub Cmd+Shift+Z) – Redo (na wybranych przeglądarkach).

---

### 4.11 Dostępność i UX (opcjonalnie)

- **A11Y-01** Komórka dnia w Tape Chart: role lub aria (np. button), obsługa Enter/Space do otwarcia „Nowa rezerwacja”.
- **A11Y-02** Formularze: etykiety powiązane z polami (for/id); wymagane pola oznaczone.
- **A11Y-03** Command Palette: fokus w input po otwarciu; nawigacja strzałkami (jeśli zaimplementowana).

---

### 4.12 API (poza E2E UI)

- **API-01** GET (lub POST) `/api/v1/external/availability` – wymagane parametry, format odpowiedzi (np. JSON).
- **API-02** POST `/api/v1/external/posting` – payload, autoryzacja (jeśli jest), kod odpowiedzi.
- **API-03** Brak dostępu bez klucza/tokenu (jeśli wymagane) – 401/403.

---

### 4.13 Negatywne i brzegowe

- **NEG-01** Edycja rezerwacji: data wymeldowania ≤ zameldowania – walidacja, komunikat błędu.
- **NEG-02** Nowa rezerwacja: pokój nieistniejący (np. „999”) – błąd z backendu.
- **NEG-03** Meldunek: nieprawidłowy format email – walidacja (jeśli jest).
- **NEG-04** Finance: Blind Drop – nieprawidłowa kwota (tekst, ujemna) – walidacja/toast.
- **NEG-05** Strona nieistniejąca (404) – obsługa w aplikacji (jeśli jest).
- **NEG-06** Tape Chart: klik w komórkę pokoju OOO – czy można utworzyć rezerwację (zgodnie z regułami biznesowymi); ewentualny komunikat.

---

## 5. Priorytetyzacja i kolejność wdrożenia

1. **Krytyczne (smoke):** NAV-01–03, TC-01–05, CI-01–05, CR-02, FIN-01–04.
2. **Wysokie:** TC-10, TC-15, CR-01–04, ER-01–02, CI-06–09, FIN-05–06, HK-01–04, Command Palette NAV-04–08.
3. **Średnie:** Undo/Redo TC-07–08, UR-01–03, Room Guard TC-12–13, Housekeeping offline HK-05, Reports RPT-01–03.
4. **Niskie:** A11Y-*, API-*, NEG-* (wybrane), Dashboard DASH-* (jeśli nie w smoke).

---

## 6. Uwagi dla automatyzacji (Playwright)

- **Selektory:** Preferować `data-testid` tam gdzie dodane (reservation-bar, room-row-*, cell-*-*, create-reservation-*); dla formularzy – `getByLabel`, `getByRole`.
- **Toast:** Sonner – `getByText("…")` z timeoutem; unikać sztywnych selektorów wewnętrznych (np. data-sonner-toast) jeśli mogą się zmienić.
- **Sheet:** Nie zakładać `role="dialog"`; używać tytułu („Nowa rezerwacja”, „Edycja rezerwacji”) lub data-testid formularza.
- **Stabilność:** Unikać `waitForTimeout`; używać `expect(…).toBeVisible({ timeout })`, `toBeEnabled`, `toHaveCount` itd.
- **Izolacja:** Unikalne dane (np. „Jan Testowy ” + timestamp) przy tworzeniu rezerwacji; asercje na `.first()` lub „co najmniej jeden” gdy duplikaty możliwe.
- **Konfiguracja:** baseURL z env (np. PLAYWRIGHT_BASE_URL); osobne projekty (chromium/firefox/webkit) według potrzeb.

---

**Koniec Master Test Plan.**

Dokument stanowi podstawę do implementacji scenariuszy w Playwright oraz do przeglądów pokrycia i identyfikacji brakujących testów (ślepe plamki).
