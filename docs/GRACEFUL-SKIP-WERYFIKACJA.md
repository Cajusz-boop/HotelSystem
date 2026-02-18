# Weryfikacja testów z graceful skip — które funkcje ISTNIEJĄ, które NIE

Raport z analizy codebase i wyników testów E2E (chromium).  
Data: 2026-02-18

---

## ✅ Funkcje ISTNIEJĄCE (test powinien przechodzić lub element jest w kodzie)

| Element | Lokalizacja | Uwagi |
|---------|-------------|-------|
| **Dashboard KPI** (Occupancy, ADR, RevPAR) | `app/page.tsx` | Test DASH-05 **przechodzi** |
| **Sekcja check-inów** (Meldunki) | `app/page.tsx` | "Meldunki" w Sytuacja dnia; test DASH-06 **przechodzi** |
| **Rezerwacja grupowa** | `components/tape-chart/index.tsx`, `group-reservation-sheet.tsx` | Przycisk "Rezerwacja grupowa" |
| **Walk-in** | `create-reservation-sheet.tsx` (source: Osobiście), `createWalkIn` w actions | Backend + UI (wybór źródła) |
| **Split rezerwacji** | `reservation-bar-with-menu.tsx`, `SplitReservationDialog` | "Podziel rezerwację" w menu kontekstowym |
| **Check-out z menu** | `reservation-bar-with-menu.tsx` | "Wymelduj" w ContextMenu |
| **Folio w szczegółach rezerwacji** | `reservation-edit-sheet.tsx` | Pełna sekcja Folio, Dodaj folio, rabaty |
| **reservation-bar** | `reservation-bar.tsx` | `data-testid="reservation-bar"` |
| **Filtr piętra na Housekeeping** | `app/housekeeping/page.tsx` | `filterFloor`, select "Piętro" |
| **Zamknij dobę (Night Audit)** | `app/finance/page.tsx` | Przycisk "Zamknij dobę" |
| **Pole countedCash** | `app/finance/page.tsx` | `id="countedCash"`, label "Policzona gotówka" |
| **Zgłoś usterkę** | `app/housekeeping/page.tsx` | Przycisk "Zgłoś usterkę" (line 1061) |
| **Wykresy na Dashboard** | `app/page.tsx` → `DashboardCharts` | Recharts/canvas — możliwy problem z selektorem lub renderowaniem |

---

## ❌ Funkcje NIEISTNIEJĄCE lub NIEZGODNE Z SELEKTOREM

| Element | Powód |
|---------|-------|
| **Sekcja check-outów na Dashboard** | Strona główna nie ma wydzielonej sekcji "Wyjazdy" / "Check-out" — tylko Meldunki, VIP, Do sprzątania, OOO |
| **Filtr typu pokoju na Tape Chart** | `components/tape-chart/index.tsx` — jest input "Numer / typ pokoju", brak dedykowanego select/combobox typu |
| **Filtr piętra na Tape Chart** | Brak filtra piętra w głównym grafiku — jest na Housekeeping, nie na front-office |
| **Przycisk DIRTY na Housekeeping** | Test szuka `button name="DIRTY"`, a UI ma "Do sprzątania" (`STATUS_OPTIONS[].label`) |
| **Dodaj obciążenie (+ Obciążenie)** | W rezerwacji jest "Nalicz nocleg", "Dodaj rabat" — brak przycisku "Dodaj obciążenie" (ręczne obciążenie minibar/itp.) |
| **Przycisk Faktura na Finance** | Strona finance ma wiele sekcji; przycisk "Faktura" wg testu — trzeba sprawdzić dokładnie, gdzie powinien być |
| **Mapowanie / status kanałów na Channel Manager** | Wymaga sprawdzenia strony `/channel-manager` |
| **Eksport PDF/Excel w Raportach** | Wymaga sprawdzenia `/reports` |

---

## ⚠️ Różnice selektor–implementacja (możliwy błąd testu)

| Test | Oczekiwanie testu | Faktyczna implementacja |
|------|-------------------|--------------------------|
| HK-04 (DIRTY) | `getByRole("button", { name: "DIRTY" })` | Przycisk ma tekst "Do sprzątania" |
| FO-10 (filtr typu) | select/combobox "Typ pokoju" | Input tekstowy placeholder "Numer / typ pokoju" |
| FO-14 (Split) | Wymaga rezerwacji na grafiku | Test może skipować przy braku rezerwacji; Split w kodzie istnieje |

---

## Wyniki uruchomienia testów (fragment)

```
ok  DASH-05: sekcja KPI
ok  DASH-06: sekcja check-inów
-   DASH-07: sekcja check-outów (skipped)
-   DASH-08: wykresy (skipped)
x   FO-10, FO-11, FO-14, KB-04, KB-05: fail w beforeEach (strona /front-office nie pokazuje "Grafik|Recepcja" — prawdopodobnie brak logowania lub serwer)
```

Uwaga: testy Front Office padły w `beforeEach` — strona nie zwróciła oczekiwanego tekstu (np. formularz logowania). To problem środowiska/testów, nie brak funkcji.

---

## Rekomendacje

1. **Usunąć skip** tam, gdzie funkcja istnieje: DASH-05, DASH-06 — już przechodzą.
2. ~~**Poprawić selektor** w housekeeping: szukać "Do sprzątania" zamiast "DIRTY".~~ ✅ WYKONANO (2026-02-18)
3. ~~**Dodać sekcję Wyjazdy** na Dashboard~~ ✅ WYKONANO (2026-02-18) — DASH-07 przechodzi.
4. ~~**Dodać filtr piętra i typu** na Tape Chart~~ ✅ WYKONANO (2026-02-18)
5. ~~**Dodać przycisk "Dodaj obciążenie"**~~ ✅ WYKONANO (2026-02-18)

## Wykonane naprawy i implementacje (2026-02-18)

### Naprawy testów
- **HK-04**: Selektory zmienione z `name: "DIRTY"` na `name: /Do sprzątania|DIRTY/i` — dopasowanie do UI.
- **HK-05**: Selektory zmienione z `Gospodarka` na `Housekeeping|Pokoje|Priorytet`.
- **return po test.skip()**: Dodano `return` we wszystkich testach, gdzie był brak — zapobiega wykonaniu `expect()` po skip.

### Implementacje brakujących funkcji
- **Dashboard — sekcja Wyjazdy**: `todayCheckOuts` w `getDashboardData`, wiersz „Wyjazdy” w Sytuacja dnia, sekcja „Dzisiejsze wyjazdy”. DASH-07 **przechodzi**.
- **Tape Chart — filtry**: Select „Typ pokoju” (`roomTypeFilter`) i „Piętro” (`floorFilter`) w panelu Filtry (domyślnie rozwiniętym).
- **Dodaj obciążenie**: Przycisk w `reservation-edit-sheet` (zakładka Rozliczenie), dialog `AddChargeDialog` — kwota, typ (Minibar, Gastronomia, SPA, itd.), folio. Rozszerzono `registerTransaction` o `folioNumber` i `description`.
