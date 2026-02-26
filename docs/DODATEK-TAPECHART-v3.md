# DODATEK DO PLANU TESTÓW v3 — WSZYSTKO PRZEZ TAPECHART

## ZASADA GŁÓWNA

Recepcjonistka pracuje CAŁY DZIEŃ na jednym widoku: `/front-office` (TapeChart).
NIE przechodzi na osobne strony żeby robić codzienne zadania.
Wszystkie testy E2E muszą to odzwierciedlać.

**Widok TapeChart zawiera:**
- Grafik pokoi (tabela: pokoje × daty)
- Paski rezerwacji (kolorowe, z nazwiskiem gościa)
- Przycisk `+ Zarezerwuj` (górny prawy, zielony)
- Przycisk `Szukaj pokoju` (górny prawy)
- Statystyki: Przyjazdy, Wyjazdy, Do sprzątania, Zameldowani
- Widoki: Dzień / Tydzień / Miesiąc / Rok
- Nawigacja dat: strzałki ← → oraz przycisk "Dziś"

---

## JAK RECEPCJONISTKA WYKONUJE ZADANIA — POPRAWIONE ŚCIEŻKI

### NOWA REZERWACJA
```
NIE: wchodzi na /reservations/new
TAK: na /front-office klika "+ Zarezerwuj" → otwiera się dialog → wypełnia → zapisuje
ALT: klika na pustą komórkę w grafiku (pokój × data) → otwiera się dialog z datami i pokojem wstępnie wypełnionymi
```

### OTWARCIE ISTNIEJĄCEJ REZERWACJI
```
NIE: wchodzi na /reservations/123
TAK: na /front-office double-click na pasek rezerwacji → otwiera się dialog z zakładkami
ALT: right-click na pasek → menu kontekstowe (Otwórz, Zamelduj, Wymelduj, Anuluj)
```

### CHECK-IN (zameldowanie)
```
NIE: wchodzi na /check-in
TAK: na /front-office double-click na pasek → dialog → przycisk "Melduj gościa"
ALT: right-click na pasek → menu → "Zamelduj"
```

### OBCIĄŻENIA / FOLIO / PŁATNOŚCI
```
NIE: wchodzi na /finance/folio/123
TAK: na /front-office double-click na pasek → dialog → zakładka "Rozliczenie"
     → dodaje obciążenia, rejestruje płatności, widzi saldo
```

### PARAGON / FAKTURA
```
NIE: wchodzi na /finance/new-invoice
TAK: na /front-office double-click na pasek → dialog → zakładka "Rozliczenie"
     → przycisk "Wystaw paragon" lub "Wystaw fakturę"
ALT: jeśli faktura wymaga osobnej strony — sprawdź czy jest link/przycisk z dialogu rezerwacji
```

### CHECK-OUT (wymeldowanie)
```
NIE: wchodzi na /checkout
TAK: na /front-office double-click na pasek → dialog → przycisk "Wymelduj"
ALT: right-click na pasek → menu → "Wymelduj"
WARUNEK: przed wymeldowaniem sprawdza saldo (zakładka Rozliczenie), płaci resztę, wystawia dokument
```

### ZMIANA DAT / POKOJU
```
NIE: wchodzi na /reservations/123/edit
TAK: na /front-office double-click na pasek → dialog → zmienia daty/pokój → zapisuje
ALT: drag & drop paska na grafiku (przesunięcie = zmiana dat, przesuniecie góra/dół = zmiana pokoju)
```

### ANULOWANIE
```
TAK: na /front-office double-click na pasek → dialog → przycisk "Anuluj" lub status CANCELLED
ALT: right-click na pasek → menu → "Anuluj"
```

### LISTA PRZYJAZDÓW / WYJAZDÓW
```
TAK: na /front-office — statystyki na górze (Przyjazdy: X, Wyjazdy: X)
     → kliknij na "Przyjazdy: X" → lista przyjazdów
     → kliknij na "Wyjazdy: X" → lista wyjazdów
ALT: jeśli nie da się kliknąć — sprawdź czy jest sidebar/panel z listą
```

### HOUSEKEEPING (status pokoi)
```
TAK: na /front-office — ikony przy pokojach (zielone = czyste, pomarańczowe = brudne, czerwone = OOO)
     → kliknij na ikonę → zmień status
ALT: kliknij na numer pokoju → panel ze szczegółami pokoju → zmień status
```

---

## POPRAWIONE SCENARIUSZE TESTOWE

Cursor: gdy piszesz testy E2E z planu v3, użyj tych ścieżek:

### Scenariusz: Pełny dzień recepcji (jeden ciągły test)
```
CAŁY TEST NA JEDNEJ STRONIE: /front-office

1. PORANEK — statystyki (Przyjazdy, Wyjazdy, Zameldowani, Do sprzątania)
2. NOWA REZERWACJA TELEFONICZNA — "+ Zarezerwuj" → formularz → zapis → pasek na grafiku
3. CHECK-IN — double-click na pasek → "Melduj gościa"
4. OBCIĄŻENIA — double-click → zakładka "Rozliczenie" → Dodaj obciążenie
5. PŁATNOŚĆ — ten sam dialog → "Dodaj płatność"
6. PARAGON — ten sam dialog → "Wystaw paragon" / "Wystaw dokument"
7. CHECK-OUT — ten sam dialog → "Wymelduj"
```

### Wyjątki — strony testowane osobno:
- /kontrahenci, /finance, /ksiega-meldunkowa, /cennik, /booking, /zmiana, /rooms
