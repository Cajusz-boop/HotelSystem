# Plan testów – Hotel PMS

**Cel:** Zapewnienie 100% poprawności działania programu poprzez kompleksowe testy.

## 1. Warstwy testów

| Warstwa | Narzędzie | Zakres | Uruchomienie |
|---------|-----------|--------|--------------|
| **Testy jednostkowe (Python)** | pytest | `manager.py`, `supervisor.py` | `pytest tests/` |
| **Testy E2E (Frontend)** | Playwright | Aplikacja Next.js, UI | `npm run test:e2e` |
| **Smoke (krytyczne ścieżki)** | Playwright | check-in-flow, ci-gap | `npm run test:e2e` |

---

## 2. Testy jednostkowe (manager.py)

### 2.1 Zakres

- `get_first_unchecked_task()` – parsowanie TASKS.md, znajdowanie `- [ ]` zadania
- `mark_task_done()` – zamiana `- [ ]` na `- [x]`
- `read_state()` / `write_state()` – odczyt/zapis licznika Safety Stop
- `check_batch_limit()` – wyjście z kodem 0 przy osiągnięciu BATCH_LIMIT
- `increment_batch_count()` – inkrementacja licznika
- Komenda `next` – brak zadań, Safety Stop, zwrócenie zadania
- Komenda `done` – sukces, brak zadania w pliku

### 2.2 Uruchomienie

```bash
# Instalacja zależności
pip install -r requirements-dev.txt

# Uruchomienie testów
pytest tests/ -v

# Z pokryciem kodu
pytest tests/ -v --cov=manager --cov-report=term-missing
```

---

## 3. Testy E2E (Playwright)

### 3.1 Wymagania

- Aplikacja uruchomiona: `npm run dev` (port 3011)
- Baza zseedowana: `npm run db:seed:kwhotel`
- Zmienna `PLAYWRIGHT_BASE_URL` (opcjonalnie, domyślnie localhost:3011)

### 3.2 Scenariusze (wg MASTER-TEST-PLAN.md)

| Moduł | Plik | Priorytet |
|-------|------|-----------|
| Meldunek (flow) | `check-in-flow.spec.ts` | Krytyczny |
| Meldunek (gap) | `ci-gap.spec.ts` | Krytyczny |
| Nawigacja | `navigation.spec.ts` | Wysoki |
| Tape Chart | `reception-flow.spec.ts` | Wysoki |
| Finance | `finance-flow.spec.ts` | Wysoki |
| Housekeeping | `housekeeping.spec.ts` | Średni |
| Raporty | `reports.spec.ts` | Średni |
| Command Palette | `command-palette.spec.ts` | Średni |

### 3.3 Uruchomienie

```bash
# Pełny zestaw (check-in-flow + ci-gap, wszystkie przeglądarki)
npm run test:e2e

# Tylko Chromium
PLAYWRIGHT_PROJECTS=chromium npm run test:e2e

# Surowy Playwright (bez seedowania przed każdym plikiem)
npm run test:e2e:raw

# Interfejs UI
npm run test:e2e:ui
```

---

## 4. Kolejność wykonywania (CI)

1. `npm install`
2. `npm run db:seed:kwhotel` (jeśli potrzebne)
3. `npm run build` – weryfikacja kompilacji
4. `pytest tests/ -v` – testy Python
5. Start aplikacji w tle: `npm run dev`
6. `npm run test:e2e` – testy E2E

---

## 5. Typowe błędy i rozwiązania

| Błąd | Rozwiązanie |
|------|-------------|
| `Cannot find module '@playwright/test'` | `npm install` |
| Testy E2E timeout / auth failed | Uruchomić `npm run dev`, sprawdzić `PLAYWRIGHT_BASE_URL` |
| Brak wolnych pokoi w testach meldunku | `npm run db:seed:kwhotel` – seed ustawia daty i pokoje |
| Python not found | Zainstalować Python 3.10+ (lub py launcher) |
| pytest: ModuleNotFoundError | `pip install -r requirements-dev.txt` |

---

## 6. Biblioteki testowe

| Projekt | Biblioteka | Wersja |
|---------|------------|--------|
| Python | pytest | ≥8.0 |
| Python | pytest-cov | (opcjonalnie) |
| TypeScript/Next.js | @playwright/test | ^1.58.2 |

---

**Koniec planu.**
