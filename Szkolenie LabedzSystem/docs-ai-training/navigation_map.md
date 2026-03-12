# Mapa nawigacji — struktura poruszania się po systemie

**Dokument:** navigation_map.md  
**Przeznaczenie:** Materiał szkoleniowy AI — opis głównej ścieżki pracy recepcjonisty i kiedy używa każdego obszaru.

---

## Główna ścieżka pracy recepcji

```
Login → Dashboard → Tape Chart → Rezerwacja → Pokój → Płatności
```

---

## 1. Login (`/login`)

### Co to jest

Punkt wejścia do systemu. Wybór użytkownika i uwierzytelnienie PIN-em (4 cyfry).

### Kiedy pracownik używa

- **Na początku zmiany** — po przyjściu do pracy recepcjonista loguje się, aby uzyskać dostęp do systemu.
- **Po wylogowaniu** — po zmianie użytkownika lub zakończeniu sesji.
- **Po przekroczeniu limitu bezczynności** — system wymusza ponowne logowanie przy timeout sesji.

### Typowy przebieg

1. Recepcjonista klika przycisk ze swoim imieniem (np. Aneta, Recepcja).
2. Wpisuje PIN (np. 1234).
3. System przekierowuje na `/front-office` (główny grafik).

---

## 2. Dashboard (`/` lub `/dashboard`)

### Co to jest

„Centrum dowodzenia” — podsumowanie dnia: KPI (obłożenie, ADR, RevPAR), alerty operacyjne, mapa funkcji, wykresy.

### Kiedy pracownik używa

- **Na start dnia** — szybki przegląd sytuacji: ile meldunków, wyjazdów, VIP, pokoi do sprzątania.
- **Podczas zmiany** — sprawdzenie trendów i porównań (vs wczoraj, tydzień temu).
- **Jako skrót do modułów** — kafelki prowadzą do Recepcji, Kontrahentów, Housekeeping, Finansów itd.

### Typowy przebieg

1. Recepcjonista wchodzi na Dashboard (lub zostaje przekierowany po logowaniu).
2. Sprawdza „Sytuację dnia” — meldunki, wyjazdy, VIP, OOO.
3. Klika **Otwórz grafik** lub kafelek Recepcja → przechodzi do Tape Chart.

---

## 3. Tape Chart (`/front-office`)

### Co to jest

Grafik rezerwacji (widok Gantta) — wiersze = pokoje, kolumny = dni, paski = rezerwacje.

### Kiedy pracownik używa

- **Cały czas w trakcie zmiany** — główny ekran pracy recepcji.
- **Przy sprawdzaniu dostępności** — gość dzwoni lub jest na miejscu; recepcjonista patrzy na grafik, czy są wolne pokoje.
- **Przy tworzeniu rezerwacji** — klik w pustą komórkę lub przycisk „+ Zarezerwuj”.
- **Przy meldowaniu / wymeldowaniu** — klik w pasek otwiera okno rezerwacji.
- **Przy zmianie pokoju/dat** — drag & drop paska na inny pokój lub dzień.

### Typowy przebieg

1. Recepcjonista widzi grafik z pokojami i rezerwacjami.
2. Klika pustą komórkę lub „+ Zarezerwuj” → przechodzi do formularza **Rezerwacji**.
3. Klika pasek rezerwacji → otwiera okno rezerwacji (dane gościa, pokój, płatności).

---

## 4. Rezerwacja (okno/dialog z Tape Chart)

### Co to jest

Okno rezerwacji otwierane po kliknięciu w pasek na grafiku. Zawiera dane gościa, pokoju, okresu pobytu i zakładki: Rozliczenie, Dokumenty, Posiłki, Meldunek itd.

### Kiedy pracownik używa

- **Tworzenie nowej rezerwacji** — po kliknięciu w pustą komórkę lub „+ Zarezerwuj”.
- **Edycja rezerwacji** — zmiana dat, pokoju, gościa, uwag.
- **Meldowanie gościa** — zakładka Meldunek; wypełnienie danych, „Zamelduj”.
- **Wymeldowanie** — menu kontekstowe na pasku lub zakładka Rozliczenie.
- **Pobieranie płatności** — zakładka Rozliczenie.
- **Wystawianie dokumentów** — zakładka Dokumenty (faktura, proforma, rachunek).

### Typowy przebieg

1. Recepcjonista otwiera rezerwację z grafiku (klik w pasek).
2. Uzupełnia/edyuje dane gościa, pokój, daty.
3. W zakładce **Meldunek** — melduje gościa.
4. W zakładce **Rozliczenie** — przechodzi do **Płatności**.

---

## 5. Pokój (`/pokoje`)

### Co to jest

Lista pokoi z numerem, typem, statusem (CLEAN, DIRTY, OOO, INSPECTION, MAINTENANCE). Edycja pokoi, typów, pięter.

### Kiedy pracownik używa

- **Zarządzanie statusami** — zmiana statusu pokoju po sprzątaniu (DIRTY → CLEAN), remoncie (OOO), inspekcji.
- **Konsultacja z housekeeping** — sprawdzenie, które pokoje są gotowe na meldunek.
- **Planowanie remontów** — ustawienie OOO (Out of Order) z powodem.
- **Dodawanie/edycja pokoi** — rzadziej, zwykle przez administratora.
- **Sprawdzenie wyposażenia** — typ pokoju, łóżka, widok itd.

### Typowy przebieg

1. Recepcjonista wchodzi na `/pokoje` (z menu lub z Dashboard).
2. Sprawdza statusy pokoi — np. które są CLEAN na dziś.
3. Opcjonalnie zmienia status (np. po informacji od sprzątania).

---

## 6. Płatności (`/finance` oraz zakładka Rozliczenie w oknie rezerwacji)

### Co to jest

- **`/finance`** — moduł finansowy: lista transakcji, przypomnienia, windykacja, integracje księgowe.
- **Zakładka Rozliczenie** — folio rezerwacji: obciążenia, wpłaty, saldo, wystawienie faktury/rachunku.

### Kiedy pracownik używa

- **Przy meldunku / wymeldunku** — rejestracja wpłaty w oknie rezerwacji (zakładka Rozliczenie).
- **Przy checkout** — sprawdzenie salda, przyjęcie ostatniej wpłaty, wystawienie faktury.
- **Zaliczki i kaucje** — wpłata zaliczki przy rezerwacji, kaucja przy meldunku.
- **Raportowanie** — moduł `/finance` do podsumowań zmian, eksportu, windykacji.
- **Przypomnienia o płatności** — sprawdzenie listy nieopłaconych rezerwacji.

### Typowy przebieg

1. Recepcjonista otwiera rezerwację → zakładka **Rozliczenie**.
2. Sprawdza saldo folio (obciążenia minus wpłaty).
3. Klika „Dodaj wpłatę” — wybiera kwotę, metodę (gotówka, karta, przelew).
4. Przy wymeldowaniu — wystawia fakturę/rachunek (zakładka Dokumenty lub Rozliczenie).
5. Do raportów — wchodzi na `/finance` (lista transakcji, zmiana, eksport).

---

## Skróty i alternatywne ścieżki

| Ścieżka | URL | Kiedy używać |
|---------|-----|--------------|
| **Księga meldunkowa** | `/ksiega-meldunkowa` | Lista rezerwacji z filtrami, eksport, wyszukiwanie po gościu |
| **Meldunek (szybki)** | `/check-in` | Szybki meldunek bez grafiku (formularz, MRZ, walk-in) |
| **Kontrahenci** | `/kontrahenci` | Baza gości i firm; wyszukiwanie, karty gości |
| **Housekeeping** | `/housekeeping` | Sprzątanie, minibar, posiłki, pralnia |
| **Zmiana zmiany** | `/zmiana` | Podsumowanie zmiany dla następnego recepcjonisty |

---

## Schemat przepływu (typowy dzień recepcjonisty)

```
1. Login
   ↓
2. Dashboard (szybki przegląd dnia)
   ↓
3. Tape Chart (główny ekran)
   ↓
4. Rezerwacja (klik w pasek / nowa rezerwacja)
   ├── Meldunek (zakładka Meldunek)
   ├── Płatności (zakładka Rozliczenie)
   └── Dokumenty (faktura, rachunek)
   ↓
5. Pokój (sprawdzenie statusu — w razie potrzeby)
   ↓
6. Płatności /finance (raporty, zmiana — na koniec)
```
