# TEST PLAN — Hotel PMS (Playwright E2E)

**Wersja:** 1.0
**Data:** Luty 2026
**Bazuje na:** SZKOLENIE-HOTEL-PMS.md (PRD)

---

## Konwencje

- **[EXISTING]** — test już istnieje w bieżącym zestawie (nie implementujemy ponownie)
- **[NEW]** — nowy test do implementacji
- **HP** — Happy Path
- **EC** — Edge Case
- **ID** — unikalny identyfikator testu (prefiks modułu + numer)

---

## 1. Logowanie i nawigacja (`auth.spec.ts`)

### 1.1 Logowanie

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| AUTH-01 | HP [NEW] | Logowanie poprawnymi danymi (admin@hotel.local / admin123) | Przekierowanie na Dashboard, sidebar widoczny |
| AUTH-02 | EC [NEW] | Logowanie błędnym hasłem | Komunikat o błędzie, brak przekierowania |
| AUTH-03 | EC [NEW] | Logowanie pustym formularzem | Walidacja — pola wymagane |
| AUTH-04 | EC [NEW] | Logowanie z włączonym 2FA — brak kodu | Formularz kodu 2FA, brak dostępu |
| AUTH-05 | EC [NEW] | Dostęp do chronionej strony bez logowania | Przekierowanie na /login |

### 1.2 Zmiana hasła

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| AUTH-06 | HP [NEW] | Strona /change-password ładuje się | Formularz z polami: stare hasło, nowe hasło, powtórz |
| AUTH-07 | EC [NEW] | Nowe hasło nie spełnia wymagań | Komunikat o wymaganiach |
| AUTH-08 | EC [NEW] | Nowe hasło ≠ powtórz hasło | Komunikat o niezgodności |

### 1.3 Nawigacja

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| AUTH-09 | HP [EXISTING] | Sidebar zawiera wszystkie linki nawigacji | navigation.spec.ts |
| AUTH-10 | HP [EXISTING] | Klik na każdy link prowadzi do poprawnej strony | navigation.spec.ts |
| AUTH-11 | HP [EXISTING] | Aktywny link ma wyróżniony styl | navigation.spec.ts |
| AUTH-12 | HP [EXISTING] | Ctrl+K otwiera paletę komend | command-palette.spec.ts |
| AUTH-13 | HP [NEW] | Przełącznik trybu ciemnego/jasnego działa | Zmiana klasy/motywu na body |

---

## 2. Dashboard (`dashboard.spec.ts`)

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| DASH-01 | HP [EXISTING] | Nagłówek Dashboard i przycisk "Otwórz Grafik" | dashboard.spec.ts |
| DASH-02 | HP [EXISTING] | Sekcja VIP Arrival widoczna | dashboard.spec.ts |
| DASH-03 | HP [EXISTING] | Sekcja Dirty Rooms widoczna | dashboard.spec.ts |
| DASH-04 | HP [EXISTING] | Sekcja OOO widoczna | dashboard.spec.ts |
| DASH-05 | HP [NEW] | Sekcja KPI (Occupancy, ADR, RevPAR, Przychód) widoczna | Karty KPI z wartościami liczbowymi |
| DASH-06 | HP [NEW] | Sekcja "Dzisiejsze check-iny" widoczna | Lista lub komunikat "brak" |
| DASH-07 | HP [NEW] | Sekcja "Dzisiejsze check-outy" widoczna | Lista lub komunikat "brak" |
| DASH-08 | HP [NEW] | Wykresy obłożenia/przychodów renderują się | Elementy canvas/svg widoczne |
| DASH-09 | HP [EXISTING] | Klik "Otwórz Grafik" → /front-office | dashboard.spec.ts |

---

## 3. Front Office — Tape Chart (`front-office.spec.ts` — rozszerzenie)

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| FO-01 | HP [EXISTING] | Grafik wyświetla nagłówek i pokoje | reception-flow.spec.ts |
| FO-02 | HP [EXISTING] | Kolorowe paski rezerwacji widoczne | reception-flow.spec.ts |
| FO-03 | HP [EXISTING] | Undo/Redo przyciski widoczne | reception-flow.spec.ts |
| FO-04 | HP [EXISTING] | Tryb prywatności widoczny | reception-flow.spec.ts |
| FO-05 | HP [EXISTING] | Tworzenie rezerwacji z Tape Chart | create-reservation.spec.ts |
| FO-06 | HP [EXISTING] | Edycja rezerwacji (Sheet) | edit-reservation.spec.ts |
| FO-07 | HP [EXISTING] | Room Guard blokuje DIRTY/OOO | reception-flow.spec.ts |
| FO-08 | HP [EXISTING] | Nawigacja po datach | gap-analysis.spec.ts |
| FO-09 | HP [EXISTING] | Sticky headers | gap-analysis.spec.ts |
| FO-10 | HP [NEW] | Filtry: typ pokoju — filtrowanie działa | Po wyborze filtra widoczne tylko pasujące pokoje |
| FO-11 | HP [NEW] | Filtry: piętro — filtrowanie działa | Po wyborze piętra widoczne tylko pokoje z tego piętra |
| FO-12 | HP [NEW] | Widok KWHotel (/front-office/kwhotel) ładuje się | Tabela z pokojami i rezerwacjami |
| FO-13 | EC [NEW] | Przeciągnięcie rezerwacji na zajęty pokój | Blokada lub ostrzeżenie o kolizji |
| FO-14 | HP [NEW] | Podział rezerwacji (Split) — menu kontekstowe | Opcja "Podziel rezerwację" widoczna |

---

## 4. Rezerwacje — zaawansowane (`advanced-reservations.spec.ts`)

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| RES-01 | HP [NEW] | Rezerwacja grupowa — formularz otwiera się | Pola: nazwa grupy, organizator, pokoje |
| RES-02 | HP [NEW] | Walk-in — szybki meldunek gościa bez rezerwacji | Formularz walk-in, automatyczny check-in |
| RES-03 | HP [NEW] | Folio rezerwacji — lista obciążeń i płatności | Tabela z charges/payments/saldo |
| RES-04 | HP [NEW] | Dodanie obciążenia do folio | Nowa pozycja na folio, saldo zaktualizowane |
| RES-05 | HP [NEW] | Wydruk potwierdzenia rezerwacji (PDF) | Przycisk generuje PDF lub otwiera podgląd |
| RES-06 | EC [NEW] | Anulowanie rezerwacji z powodem | Status zmienia się na Cancelled, powód zapisany |
| RES-07 | EC [NEW] | Rezerwacja z datą wyjazdu < przyjazdu | Walidacja — błąd dat |
| RES-08 | EC [NEW] | Overbooking — więcej rezerwacji niż pokojów | Ostrzeżenie o overbookingu |
| RES-09 | HP [NEW] | Statusy rezerwacji: Request → Confirmed → Checked-in → Checked-out | Przejścia statusów działają |
| RES-10 | HP [NEW] | Lista oczekujących (Waitlist) — dodanie gościa | Gość na liście oczekujących |

---

## 5. Check-in / Check-out (`check-in-checkout.spec.ts` — rozszerzenie)

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| CI-01 | HP [EXISTING] | Formularz check-in ładuje się z polami | check-in.spec.ts |
| CI-02 | HP [EXISTING] | Minimalny meldunek (imię + nazwisko) | check-in-flow.spec.ts |
| CI-03 | HP [EXISTING] | MRZ auto-wypełnia dane | check-in-flow.spec.ts, ci-gap.spec.ts |
| CI-04 | HP [EXISTING] | NIP auto-uzupełnia dane firmy | check-in-flow.spec.ts |
| CI-05 | EC [EXISTING] | Pusty formularz — walidacja | check-in-flow.spec.ts |
| CI-06 | HP [NEW] | Check-out — saldo 0, wymeldowanie | Status → Checked-out, pokój → DIRTY |
| CI-07 | EC [NEW] | Check-out z saldem > 0 | Ostrzeżenie o nieuregulowanym saldzie |
| CI-08 | HP [NEW] | Express Check-out — automatyczne obciążenie karty | Potwierdzenie express checkout |
| CI-09 | HP [NEW] | Web Check-in — strona /check-in/guest/[token] ładuje się | Formularz online dla gościa |
| CI-10 | EC [NEW] | Web Check-in — nieprawidłowy token | Komunikat o błędzie lub 404 |

---

## 6. Goście i kontrahenci (`guests-companies.spec.ts`)

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| GC-01 | HP [NEW] | Strona /kontrahenci ładuje się | Zakładki: goście, firmy |
| GC-02 | HP [NEW] | Lista gości wyświetla się | Tabela z gośćmi |
| GC-03 | HP [NEW] | Wyszukiwanie gościa po nazwisku | Filtrowana lista |
| GC-04 | HP [NEW] | Wyszukiwanie gościa po emailu | Filtrowana lista |
| GC-05 | HP [NEW] | Wyszukiwanie gościa po telefonie | Filtrowana lista |
| GC-06 | HP [NEW] | Karta gościa /guests/[id] — dane osobowe | Profil z danymi, historią pobytów |
| GC-07 | HP [NEW] | Dodanie nowego gościa | Formularz, zapis, gość na liście |
| GC-08 | HP [NEW] | Edycja danych gościa | Zmiana danych, zapis |
| GC-09 | HP [NEW] | Status VIP — ustawienie poziomu | VIP badge widoczny |
| GC-10 | HP [NEW] | Lista firm (/firmy lub zakładka firmy) | Tabela z firmami |
| GC-11 | HP [NEW] | Dodanie nowej firmy (NIP, nazwa, adres) | Firma na liście |
| GC-12 | EC [NEW] | Czarna lista — dodanie gościa | Ostrzeżenie przy próbie rezerwacji |
| GC-13 | EC [NEW] | RODO — anonimizacja gościa | Dane osobowe usunięte/zanonimizowane |
| GC-14 | EC [NEW] | Wyszukiwanie nieistniejącego gościa | Komunikat "brak wyników" |

---

## 7. Pokoje (`rooms.spec.ts` — rozszerzenie)

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| RM-01 | HP [EXISTING] | Pokoje posortowane numerycznie | rooms-management.spec.ts |
| RM-02 | HP [EXISTING] | Edycja piętra (select) | rooms-management.spec.ts |
| RM-03 | HP [EXISTING] | Edycja budynku (input) | rooms-management.spec.ts |
| RM-04 | HP [EXISTING] | Edycja widoku (select) | rooms-management.spec.ts |
| RM-05 | HP [NEW] | Dodanie nowego pokoju | Formularz, zapis, pokój na liście |
| RM-06 | HP [NEW] | Edycja typu pokoju | Zmiana typu, zapis |
| RM-07 | HP [NEW] | Ustawienie cech pokoju (balkon, minibar, itp.) | Cechy zapisane i widoczne |
| RM-08 | HP [NEW] | Zmiana statusu pokoju (CLEAN/DIRTY/OOO/MAINTENANCE) | Status zaktualizowany |
| RM-09 | HP [NEW] | Blokada pokoju (Room Block) — OOO z datami | Pokój zablokowany na okres |
| RM-10 | EC [NEW] | Dodanie pokoju z duplikatem numeru | Walidacja — numer już istnieje |

---

## 8. Cennik i plany taryfowe (`pricing.spec.ts`)

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| PRC-01 | HP [NEW] | Strona /cennik ładuje się | Lista planów taryfowych |
| PRC-02 | HP [NEW] | Wyświetlenie cen dla typu pokoju | Tabela cen per typ/okres |
| PRC-03 | HP [NEW] | Edycja ceny za pokój/noc | Zmiana ceny, zapis |
| PRC-04 | HP [NEW] | Reguły pochodne (/cennik/reguly-pochodne) | Lista reguł, np. "Korporacyjny = Bazowy - 15%" |
| PRC-05 | HP [NEW] | Dodanie nowej reguły pochodnej | Formularz, zapis |
| PRC-06 | HP [NEW] | Wydruk cennika (/cennik/wydruk) | Podgląd cennika do wydruku/PDF |
| PRC-07 | EC [NEW] | Cena ujemna — walidacja | Błąd walidacji |
| PRC-08 | EC [NEW] | Minimalny pobyt = 0 — walidacja | Błąd lub akceptacja |

---

## 9. Housekeeping — zaawansowane (`advanced-housekeeping.spec.ts`)

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| HK-01 | HP [EXISTING] | Panel Housekeeping ładuje się | housekeeping.spec.ts |
| HK-02 | HP [EXISTING] | Statusy pokojów widoczne | housekeeping.spec.ts |
| HK-03 | HP [EXISTING] | Zmiana statusu pokoju | housekeeping.spec.ts |
| HK-04 | HP [EXISTING] | Zgłoszenie usterki — formularz | housekeeping.spec.ts |
| HK-05 | HP [NEW] | Minibar (/housekeeping/minibar) — strona ładuje się | Lista pokojów z minibar |
| HK-06 | HP [NEW] | Minibar — zaznaczenie zużytych produktów | Produkty zaznaczone, opłata naliczona |
| HK-07 | HP [NEW] | Pranie (/housekeeping/laundry) — strona ładuje się | Formularz zlecenia prania |
| HK-08 | HP [NEW] | Pranie — utworzenie zlecenia | Zlecenie zapisane |
| HK-09 | HP [NEW] | Filtrowanie pokojów po piętrze | Tylko pokoje z wybranego piętra |
| HK-10 | HP [NEW] | Filtrowanie pokojów po statusie | Tylko pokoje o wybranym statusie |
| HK-11 | EC [NEW] | Zmiana statusu na CLEAN bez inspekcji | Ostrzeżenie lub blokada (jeśli wymagana inspekcja) |

---

## 10. Finanse — zaawansowane (`advanced-finance.spec.ts`)

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| FIN-01 | HP [EXISTING] | Strona Finance ładuje się | finance-flow.spec.ts |
| FIN-02 | HP [EXISTING] | Night Audit widoczny | finance-flow.spec.ts |
| FIN-03 | HP [EXISTING] | Blind Drop widoczny i działa | finance-flow.spec.ts |
| FIN-04 | HP [EXISTING] | Void Security widoczny | finance-flow.spec.ts |
| FIN-05 | HP [NEW] | Wystawienie faktury VAT | Formularz, dane nabywcy, PDF wygenerowany |
| FIN-06 | HP [NEW] | Wystawienie faktury korygującej | Korekta do istniejącej faktury |
| FIN-07 | HP [NEW] | Faktura proforma | Proforma wygenerowana |
| FIN-08 | HP [NEW] | Zmiana kasowa — otwarcie zmiany | Stan początkowy kasy zapisany |
| FIN-09 | HP [NEW] | Zmiana kasowa — zamknięcie zmiany | Porównanie stanów, raport różnic |
| FIN-10 | HP [NEW] | Link płatniczy — generowanie | Link wygenerowany |
| FIN-11 | HP [NEW] | Preautoryzacja karty — formularz | Kwota do zablokowania |
| FIN-12 | HP [NEW] | Przypomnienia płatności (/finance/przypomnienia) | Lista przypomnień |
| FIN-13 | HP [NEW] | Windykacja (/finance/windykacja) | Panel windykacji |
| FIN-14 | EC [NEW] | Night Audit — podwójne wykonanie | Blokada — już wykonany |
| FIN-15 | EC [NEW] | Blind Drop — kwota 0 | Walidacja |
| FIN-16 | HP [NEW] | Metody płatności: gotówka, karta, przelew | Każda metoda dostępna w formularzu |

---

## 11. Usługi dodatkowe (`services.spec.ts`)

### 11.1 SPA

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SVC-01 | HP [NEW] | Strona /spa ładuje się | Grafik zasobów SPA |
| SVC-02 | HP [NEW] | Nowa rezerwacja SPA — formularz | Pola: zabieg, terapeuta, godzina, gość |
| SVC-03 | EC [NEW] | Rezerwacja SPA na zajęty termin | Ostrzeżenie o konflikcie |

### 11.2 Gastronomia

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SVC-04 | HP [NEW] | Strona /gastronomy ładuje się | Menu restauracji |
| SVC-05 | HP [NEW] | Tworzenie zamówienia | Zamówienie zapisane |

### 11.3 Room Service

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SVC-06 | HP [NEW] | Strona /room-service ładuje się | Formularz zamówienia |
| SVC-07 | HP [NEW] | Złożenie zamówienia room service | Zamówienie zapisane, opłata na folio |

### 11.4 Posiłki

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SVC-08 | HP [NEW] | Strona /meals ładuje się | Rejestracja posiłków |
| SVC-09 | HP [NEW] | Rejestracja zużycia posiłku | Posiłek zarejestrowany |

### 11.5 Transfery

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SVC-10 | HP [NEW] | Strona /transfers ładuje się | Lista/formularz transferów |
| SVC-11 | HP [NEW] | Rezerwacja transferu | Transfer zapisany |

### 11.6 Atrakcje

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SVC-12 | HP [NEW] | Strona /attractions ładuje się | Lista atrakcji |
| SVC-13 | HP [NEW] | Rezerwacja atrakcji | Rezerwacja zapisana |

### 11.7 Wypożyczalnia

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SVC-14 | HP [NEW] | Strona /rentals ładuje się | Lista sprzętu |
| SVC-15 | HP [NEW] | Wypożyczenie sprzętu | Wypożyczenie zarejestrowane |

### 11.8 Parking

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SVC-16 | HP [NEW] | Strona /parking ładuje się | Mapa/lista miejsc parkingowych |
| SVC-17 | HP [NEW] | Przypisanie miejsca parkingowego | Miejsce przypisane do gościa |

### 11.9 Camping

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SVC-18 | HP [NEW] | Strona /camping ładuje się | Lista miejsc kempingowych |
| SVC-19 | HP [NEW] | Rezerwacja miejsca kempingowego | Rezerwacja zapisana |

---

## 12. MICE — Konferencje i eventy (`mice.spec.ts`)

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| MICE-01 | HP [NEW] | Strona /mice ładuje się | Moduł MICE widoczny |
| MICE-02 | HP [NEW] | Eventy (/mice/eventy) — lista eventów | Tabela/lista eventów |
| MICE-03 | HP [NEW] | Nowy event — formularz | Pola: nazwa, organizator, daty, uczestnicy, sale |
| MICE-04 | HP [NEW] | Kosztorysy (/mice/kosztorysy) — lista | Tabela kosztorysów |
| MICE-05 | HP [NEW] | Nowy kosztorys — formularz | Formularz wyceny |
| MICE-06 | HP [NEW] | Zlecenia (/mice/zlecenia) — lista | Tabela zleceń |
| MICE-07 | HP [NEW] | Grafik sal (/mice/grafik) — kalendarz | Widok kalendarza sal |
| MICE-08 | EC [NEW] | Event na zajętą salę | Ostrzeżenie o konflikcie |

---

## 13. Raporty — zaawansowane (`advanced-reports.spec.ts`)

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| RPT-01 | HP [EXISTING] | Strona Reports ładuje się | reports.spec.ts |
| RPT-02 | HP [EXISTING] | Generowanie raportu z datą | reports.spec.ts |
| RPT-03 | HP [EXISTING] | Zaplanowany raport | reports.spec.ts |
| RPT-04 | HP [NEW] | Audit Trail (/reports/audit-trail) | Lista zmian z użytkownikiem i datą |
| RPT-05 | HP [NEW] | Raport logowań (/reports/logins) | Historia logowań |
| RPT-06 | HP [NEW] | Akcje użytkowników (/reports/user-actions) | Log operacji |
| RPT-07 | HP [NEW] | Eksport raportu do PDF | Przycisk eksportu, plik generowany |
| RPT-08 | HP [NEW] | Eksport raportu do Excel | Przycisk eksportu XLSX |
| RPT-09 | EC [NEW] | Raport dla przyszłej daty | Raport pusty lub z prognozą |
| RPT-10 | EC [NEW] | Raport z zakresem dat: od > do | Walidacja dat |

---

## 14. Channel Manager (`channel-manager.spec.ts`)

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| CM-01 | HP [NEW] | Strona /channel-manager ładuje się | Panel Channel Manager |
| CM-02 | HP [NEW] | Lista kanałów (Booking.com, Expedia) | Kanały widoczne z statusem |
| CM-03 | HP [NEW] | Mapowanie typów pokojów | Formularz mapowania |
| CM-04 | EC [NEW] | Kanał bez konfiguracji — status disconnected | Informacja o braku połączenia |

---

## 15. Aplikacja gościa i Web Check-in (`guest-app.spec.ts`)

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| GA-01 | HP [NEW] | Web Check-in (/check-in/guest/[token]) — formularz | Pola: dane osobowe, dokument, preferencje |
| GA-02 | HP [NEW] | Strona płatności (/pay/[token]) — formularz | Formularz płatności online |
| GA-03 | EC [NEW] | Web Check-in — nieprawidłowy token | Komunikat o błędzie |
| GA-04 | EC [NEW] | Strona płatności — nieprawidłowy token | Komunikat o błędzie |
| GA-05 | HP [NEW] | Booking engine (/booking) — wyszukiwanie | [EXISTING] booking-engine.spec.ts |

---

## 16. Ustawienia systemu (`settings.spec.ts`)

### 16.1 Dane hotelu

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SET-01 | HP [NEW] | Strona /ustawienia/dane-hotelu ładuje się | Formularz z danymi hotelu |
| SET-02 | HP [NEW] | Edycja nazwy hotelu | Zmiana zapisana |

### 16.2 Użytkownicy

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SET-03 | HP [EXISTING] | Dodanie użytkownika — dropdown ról | dialog-dropdowns.spec.ts |
| SET-04 | HP [NEW] | Lista użytkowników (/ustawienia/uzytkownicy) | Tabela użytkowników |
| SET-05 | HP [NEW] | Dodanie nowego użytkownika | Formularz, zapis, użytkownik na liście |
| SET-06 | HP [NEW] | Edycja roli użytkownika | Zmiana roli, zapis |
| SET-07 | EC [NEW] | Dodanie użytkownika z duplikatem loginu | Walidacja — login zajęty |

### 16.3 Szablony

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SET-08 | HP [NEW] | Szablony dokumentów (/ustawienia/szablony) | Lista szablonów |
| SET-09 | HP [NEW] | Szablony email (/ustawienia/szablony-email) | Lista szablonów email |

### 16.4 Numeracja

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SET-10 | HP [NEW] | Numeracja dokumentów (/ustawienia/numeracja) | Konfiguracja formatów |

### 16.5 Sezony

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SET-11 | HP [NEW] | Sezony (/ustawienia/sezony) | Lista sezonów z datami |
| SET-12 | HP [NEW] | Dodanie nowego sezonu | Formularz, zapis |
| SET-13 | EC [NEW] | Nakładające się sezony | Ostrzeżenie o konflikcie |

### 16.6 Piętra

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SET-14 | HP [NEW] | Piętra (/ustawienia/pietra) | Lista pięter |
| SET-15 | HP [NEW] | Dodanie nowego piętra | Piętro na liście |

### 16.7 Słowniki

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SET-16 | HP [NEW] | Słowniki (/ustawienia/slowniki) | Lista słowników (źródła, segmenty, itp.) |

### 16.8 Polityka anulacji

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SET-17 | HP [NEW] | Polityka anulacji (/ustawienia/polityka-anulacji) | Konfiguracja zasad |

### 16.9 KSeF

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SET-18 | HP [NEW] | KSeF (/ustawienia/ksef) | Panel konfiguracji KSeF |

### 16.10 SMS

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SET-19 | HP [NEW] | SMS (/ustawienia/sms) | Konfiguracja bramki SMS |

### 16.11 Import

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SET-20 | HP [NEW] | Import danych (/ustawienia/import) | Formularz importu CSV/Excel |
| SET-21 | EC [NEW] | Import pustego pliku | Komunikat o błędzie |

### 16.12 Kasa fiskalna

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SET-22 | HP [NEW] | Kasa fiskalna (/ustawienia/kasa-fiskalna) | Panel konfiguracji |

### 16.13 2FA

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| SET-23 | HP [NEW] | 2FA (/ustawienia/2fa) | Panel konfiguracji 2FA |

---

## 17. Skróty klawiaturowe (rozproszone po testach)

| ID | Typ | Scenariusz | Oczekiwany rezultat |
|----|-----|-----------|---------------------|
| KB-01 | HP [EXISTING] | Ctrl+K — paleta komend | command-palette.spec.ts |
| KB-02 | HP [EXISTING] | Ctrl+Z / Ctrl+Y — undo/redo | reception-flow.spec.ts |
| KB-03 | HP [EXISTING] | N — nowa rezerwacja | create-reservation.spec.ts |
| KB-04 | HP [NEW] | Esc — zamknięcie okna/panelu | Dialog/Sheet zamknięty |
| KB-05 | HP [NEW] | ←/→ — nawigacja po datach na Tape Chart | Data zmienia się |

---

## Podsumowanie pokrycia

| Moduł | Istniejące testy | Nowe testy | Łącznie |
|-------|-----------------|------------|---------|
| Auth & Nawigacja | 5 | 8 | 13 |
| Dashboard | 5 | 4 | 9 |
| Front Office | 9 | 5 | 14 |
| Rezerwacje | 8 | 10 | 18 |
| Check-in/out | 5 | 5 | 10 |
| Goście & Kontrahenci | 0 | 14 | 14 |
| Pokoje | 4 | 6 | 10 |
| Cennik | 0 | 8 | 8 |
| Housekeeping | 4 | 7 | 11 |
| Finanse | 4 | 12 | 16 |
| Usługi | 0 | 19 | 19 |
| MICE | 0 | 8 | 8 |
| Raporty | 3 | 7 | 10 |
| Channel Manager | 0 | 4 | 4 |
| Guest App | 1 | 4 | 5 |
| Ustawienia | 1 | 22 | 23 |
| Skróty klawiszowe | 3 | 2 | 5 |
| **RAZEM** | **52** | **145** | **197** |
