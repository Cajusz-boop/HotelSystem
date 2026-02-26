# Opis systemu dla Testera QA / Testera Manualnego

**Projekt:** Hotel PMS (Property Management System) — Karczma Łabędź  
**Technologia:** Next.js, TypeScript, Prisma, MariaDB/MySQL  
**Cel dokumentu:** Umożliwienie wykonania testów manualnych i zapoznanie z funkcjami systemu.

---

## 1. Środowisko testowe

### Uruchomienie aplikacji (lokalnie)

- **Port:** `3011`
- **URL:** `http://localhost:3011` (używaj **http**, nie https)

**Uruchomienie:**

```powershell
cd c:\HotelSystem
npm run dev
```

Czekaj na komunikat typu „Ready” / skompilowanie (ok. 10–20 s). Pierwsze wejście na stronę może trwać dłużej (kompilacja na żądanie).

**Czysty start (gdy 500 / biała strona / błędy runtime):**

```powershell
npm run dev:clean
```

To usuwa folder `.next` i uruchamia serwer od zera.

### Baza danych

- **Lokalnie:** plik `.env` — zmienna `DATABASE_URL` (MySQL/MariaDB).
- **Migracje:** po zmianach w `prisma/schema.prisma` wykonuje się `npx prisma db push`.
- **Dane testowe:** `npm run db:seed` (seed), opcjonalnie `npm run db:seed:kwhotel` (rozszerzony seed).

---

## 2. Logowanie

- **Strona logowania:** `/login` lub przekierowanie z chronionych stron.
- **Metoda:** wybór użytkownika z listy → wpisanie **PIN-u** (4–6 cyfr) → zatwierdzenie.
- **API użytkowników:** `GET /api/auth/users` — zwraca listę użytkowników (id, name, role).
- **Uprawnienia:** menu w sidebarze jest filtrowane wg uprawnień (np. `module.dashboard`, `module.front_office`, `module.rooms`, `admin.settings`). Różni użytkownicy mogą widzieć różne pozycje menu.

**Co testować:**

- Logowanie poprawnym PIN-em dla wybranego użytkownika.
- Logowanie błędnym PIN-em (komunikat błędu, brak dostępu).
- Wylogowanie (przycisk Wyloguj w menu).
- Przekierowanie na `/login` przy braku sesji i wejściu na chronioną stronę.
- Widoczność menu w zależności od uprawnień użytkownika.

---

## 3. Nawigacja — struktura menu (sidebar)

Menu boczne dzieli się na sekcje. Poniżej główne ścieżki i co oznaczają.

| Sekcja | Ścieżka | Opis |
|--------|---------|------|
| **Panel** | `/` | Dashboard — podsumowanie, KPI. |
| **Recepcja** | `/front-office` | Grafik rezerwacji (TapeChart), paski rezerwacji, drag & drop. |
| **Meldunek** | `/check-in` | Szybki meldunek gościa (formularz, MRZ). |
| **Zmiana zmiany** | `/zmiana` | Podsumowanie zmiany. |
| **Księga meldunkowa** | `/ksiega-meldunkowa` | Lista rezerwacji z filtrami, kolumny, eksport. |
| **Kontrahenci** | `/kontrahenci` | Goście (`?tab=goscie`) i Firmy (`?tab=firmy`). |
| **Biura podróży** | `/biura-podrozy` | Baza biur podróży. |
| **Channel Manager** | `/channel-manager` | Integracja kanałów (Booking, itp.). |
| **Pokoje** | `/pokoje` | Lista pokoi, typy, statusy, ceny. |
| **Cennik** | `/cennik` | Stawki, plany cenowe. |
| **Reguły pochodne** | `/cennik/reguly-pochodne` | Reguły cenowe. |
| **Housekeeping** | `/housekeeping` | Sprzątanie, minibar, posiłki, pralnia. |
| **Parking** | `/parking` | Miejsca parkingowe. |
| **Finanse** | `/finance` | Finanse, przypomnienia, windykacja, integracje. |
| **Raporty** | `/reports` | Raporty. |
| **Ustawienia** | `/ustawienia` | Dane hotelu, piętra, użytkownicy, numeracja, asortyment, kasa fiskalna, 2FA, szablony e-mail itd. |
| **Rezerwacja online** | `/booking` | **Publiczny** booking engine (bez logowania). |

Uwaga: część pozycji (np. MICE, SPA, Gastronomia) może być niewidoczna, jeśli użytkownik nie ma odpowiednich uprawnień.

---

## 4. Moduły i obszary do testów

### 4.1 Recepcja (`/front-office`)

- **Grafik (TapeChart):** wiersze = pokoje, kolumny = dni, paski = rezerwacje.
- **Akcje:** klik w pustą komórkę → nowa rezerwacja; klik w pasek → otwarcie okna rezerwacji.
- **Drag & drop:** przeciąganie paska na inny pokój lub inny dzień (zmiana pokoju/dat).
- **Filtry:** pokoje, typy pokoi, grupy rezerwacji.
- **Zoom:** zmiana szerokości kolumn / wysokości wierszy, przycisk „Dziś”.
- **Wydarzenia:** ewentualne oznaczenia wydarzeń na osi czasu.
- **Druk:** drukowanie grafiku (okno druku przeglądarki).

**Scenariusze:** tworzenie rezerwacji z grafiku, edycja po kliknięciu w pasek, przenoszenie rezerwacji drag & drop, zmiana zakresu dat, filtry.

### 4.2 Okno rezerwacji (dialog z grafiku)

Otwierane po kliknięciu w pasek rezerwacji lub po utworzeniu nowej.

- **Lewa kolumna:** dane pokoju (typ, numer), okres pobytu (check-in/out, noce, godziny, dorośli/dzieci, parking), dane gościa (wyszukiwanie, imię, email, telefon, firma), goście w pokoju, uwagi.
- **Prawa kolumna — zakładki:** Rozliczenie, Dokumenty, Posiłki, Grafik sprzątań, Parking, Pozostałe, Usługi, Własne, Meldunek.
- **Rozliczenie:** status rezerwacji, cena bazowa, dopłaty (dorośli/dzieci), rabat, opłata miejscowa, suma, wpłaty, zaliczka, kaucja, gwarancja kartą.
- **Dokumenty:** Faktura, Proforma, Rachunek, druk fiskalny.
- **Footer:** Towary, Wystaw dok., Ceny/dni, Usuń rez., Płatności, Historia, Zapisz.

**Scenariusze:** zapis rezerwacji po zmianie dat/gościa/pokoju, zmiana statusu (np. Potwierdzona → Zameldowana), wpłata, wystawienie faktury/rachunku, dodanie posiłków, zapis i ponowne otwarcie (spójność danych).

### 4.3 Meldunek (`/check-in`)

- Formularz meldunkowy (m.in. MRZ, Parse & Forget).
- Powiązanie z rezerwacją / gościem.

**Scenariusze:** meldowanie z istniejącą rezerwacją, meldowanie bez rezerwacji (walk-in), poprawność zapisu danych gościa.

### 4.4 Księga meldunkowa (`/ksiega-meldunkowa`)

- Lista rezerwacji w tabeli z filtrami i kolumnami.
- **Filtry:** tryb (Wszystkie, Przyjazdy, Wyjazdy, In-house, No-show, Anulowane), daty od–do, pokój, typ, status, źródło, segment, kanał, wyżywienie, wyszukiwanie gościa.
- **Skróty dat:** Dziś, Jutro, Ten tydzień, Ten miesiąc itd.
- **Tabela:** kolumny konfigurowalne (np. ID, Gość, Pokój, Typ, Check-in, Check-out, status).
- **Eksport:** CSV, Excel; druk.

**Scenariusze:** filtrowanie po dacie i statusie, wyszukiwanie po nazwisku/emailu, zmiana widocznych kolumn, eksport CSV/Excel, paginacja.

### 4.5 Kontrahenci (`/kontrahenci`)

- **Zakładka Goście:** lista gości (CRM), karty gości.
- **Zakładka Firmy:** lista firm.
- **Ścieżka karty gościa:** `/guests/[id]` — szczegóły gościa, historia pobytów, rezerwacje.

**Scenariusze:** wyszukiwanie gościa, dodawanie/edycja gościa, wejście w kartę gościa, poprawność historii rezerwacji.

### 4.6 Pokoje (`/pokoje`)

- Lista pokoi z numerem, typem, statusem (np. CLEAN, DIRTY, OOO, INSPECTION, MAINTENANCE).
- Edycja pokoju: numer, typ, łóżka, wyposażenie, opis, piętro, budynek, aktywny do sprzedaży.

**Scenariusze:** dodawanie/edycja pokoju, zmiana statusu, wyłączenie pokoju ze sprzedaży (remont).

### 4.7 Cennik (`/cennik`)

- Plany cenowe (RatePlan), stawki za typ pokoju i okres.
- Reguły pochodne (`/cennik/reguly-pochodne`).

**Scenariusze:** dodawanie/edycja planu cenowego, ustawienie cen na okres, sprawdzenie wyceny na grafiku/ w oknie rezerwacji.

### 4.8 Finanse (`/finance`)

- Podstrony: przypomnienia o płatności, windykacja, integracje księgowe.
- W oknie rezerwacji (zakładka Rozliczenie): wpłaty, zaliczki, rabaty, kaucja, opłata miejscowa, faktury, rachunki, druk fiskalny.

**Scenariusze:** rejestracja wpłaty, wystawienie faktury VAT, proforma, rachunek, wydruk paragonu fiskalnego, sprawdzenie sum i salda.

### 4.9 Rezerwacja online — Booking Engine (`/booking`)

- **Publiczna strona** (bez logowania).
- Kroki: wybór dat, wybór pokoju, dane gościa, płatność (np. link do płatności).
- Integracja z cennikiem i dostępnością.

**Scenariusze:** wybór dat → sprawdzenie dostępności, wybór pokoju, wypełnienie formularza gościa, płatność (jeśli włączona), pojawienie się rezerwacji na grafiku recepcji i w księdze meldunkowej.

### 4.10 Ustawienia (`/ustawienia`)

- **Dane hotelu** (`/ustawienia/dane-hotelu`): nazwa, NIP, adres, opłata miejscowa, ceny posiłków itd.
- **Piętra** (`/ustawienia/pietra`): zarządzanie piętrami.
- **Użytkownicy** (`/ustawienia/uzytkownicy`): użytkownicy, limity rabatowe, role/uprawnienia.
- **Numeracja dokumentów** (`/ustawienia/numeracja`): prefiksy, liczniki.
- **Asortyment** (`/ustawienia/asortyment`): towary/usługi do fakturowania.
- **Kasa fiskalna** (`/ustawienia/kasa-fiskalna`): konfiguracja druku fiskalnego.
- **Szablony e-mail** (`/ustawienia/szablony-email`): szablony wiadomości.
- **2FA** (`/ustawienia/2fa`): uwierzytelnianie dwuskładnikowe.

**Scenariusze:** zmiana danych hotelu i sprawdzenie ich w dokumentach/opłacie miejscowej, dodanie użytkownika i sprawdzenie logowania oraz menu, zmiana numeracji i sprawdzenie na nowych dokumentach.

---

## 5. Kluczowe przepływy (E2E do weryfikacji)

1. **Rezerwacja z recepcji:** Recepcja → klik w komórkę grafiku → wypełnienie dat, pokój, gość (wybór lub nowy) → Zapisz → rezerwacja widoczna na grafiku i w księdze meldunkowej.
2. **Meldunek:** Rezerwacja w statusie „Potwierdzona” → okno rezerwacji → zakładka Meldunek / zmiana statusu na „Zameldowana” (lub strona `/check-in`) → zapis.
3. **Rozliczenie:** Okno rezerwacji → Rozliczenie → wpłata → Zapisz → sprawdzenie salda; Wystaw dok. → Faktura/Rachunek → sprawdzenie dokumentu.
4. **Booking online:** `/booking` → daty → pokój → dane gościa → płatność (jeśli jest) → potwierdzenie → ta sama rezerwacja w Recepcji i Księdze meldunkowej.
5. **Drag & drop:** Przeciągnięcie paska rezerwacji na inny pokój lub inny dzień → zapis → poprawne nowe pokój/daty po odświeżeniu.

---

## 6. Na co zwracać uwagę (typowe problemy)

- **Błędy 500 / biała strona:** uruchom `npm run dev:clean`, odśwież z Ctrl+Shift+R.
- **Port 3011 zajęty:** tylko jedna instancja `npm run dev`; w razie potrzeby zamknij drugi terminal lub zakończ proces na 3011.
- **Stare dane w UI:** twarde odświeżenie (Ctrl+Shift+R) po zmianach po stronie serwera.
- **Walidacja formularzy:** wymagane pola (np. gość, daty, pokój) — sprawdź komunikaty przy pustych polach i niepoprawnych formatach.
- **Uprawnienia:** testuj różnymi użytkownikami (z różnymi rolami), żeby upewnić się, że menu i akcje są zgodne z uprawnieniami.
- **Wielojęzyczność:** system ma i18n (pl/en/de) — przełącznik języka w UI; sprawdź, czy kluczowe etykiety i komunikaty się zmieniają.
- **Motyw:** przełącznik jasny/ciemny — sprawdź czytelność i brak „ucinania” elementów.

---

## 7. Dokumentacja uzupełniająca

W folderze `docs/` znajdują się specyfikacje i opisy modułów (np. okno rezerwacji, księga meldunkowa, finanse, szybkie meldowanie, booking online, CRM, cennik). Przydatne do głębszego testowania konkretnych funkcji:

- `promntLW-szybkie-meldowanie.md` — okno rezerwacji, layout, checklisty
- `promntLW-księga-meldunkowa.md` — księga meldunkowa, filtry, kolumny
- `promntLW-Finanse-braki.md` — finanse, dokumenty, brakujące elementy
- `promntLW-Booking-online.md` — booking engine
- `promntLW-CRM.md` — goście, firmy
- `promntLW-cennik.md` — cennik, stawki
- `AUDYT-KWHOTEL-REFERENCJA-PMS.md` — audyt funkcji vs KWHotel (co jest zaimplementowane, co brakuje)

---

## 8. Środowisko produkcyjne (Hetzner)

- **URL:** `https://hotel.karczma-labedz.pl`
- **Deploy:** push do `master` uruchamia webhook i deploy na serwerze; alternatywnie skrypt `.\scripts\deploy-to-hetzner.ps1`.
- Testy na produkcji należy wykonywać ostrożnie (np. na kopii danych lub w oknie testowym), bez niszczenia danych klientów.

---

## 9. Szybka checklista przed testami

- [ ] Serwer działa: `http://localhost:3011` odpowiada.
- [ ] Znasz dane logowania (użytkownik + PIN) dla co najmniej jednego konta z rozszerzonymi uprawnieniami.
- [ ] Baza ma dane (po `db:seed` lub `db:seed:kwhotel`): są pokoje, typy pokoi, rezerwacje, goście.
- [ ] Wiesz, gdzie jest Recepcja (grafik), Księga meldunkowa, Pokoje, Cennik, Finanse (w menu i w oknie rezerwacji).
- [ ] Booking engine testujesz bez logowania, pod adresem `/booking`.

---

*Dokument przeznaczony dla testerów manualnych i QA. W razie zmian w aplikacji (ścieżki, nazwy modułów) zaktualizuj ten opis.*
