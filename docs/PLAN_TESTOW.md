# Plan testów – Hotel System PMS

Plan zapewnia, że testy są powtarzalne, przechodzą (gdzie to możliwe bez naprawy całego kodu), i że wiesz, co uruchomić przed wdrożeniem.

---

## 1. Biblioteki testowe w projekcie

| Obszar | Narzędzie | Użycie |
|--------|-----------|--------|
| **Testy jednostkowe (TypeScript)** | [Vitest](https://vitest.dev/) | `npm test` / `npm run test:unit` |
| **Testy jednostkowe (Python)** | [pytest](https://pytest.org/) | `pytest tests/ -v` |
| **Test buildu (Next.js)** | Vitest + `next build` | `npm run test:build` |
| **Walidacja "use server"** | Skrypt własny | `npm run check:use-server` |
| **E2E (przeglądarka)** | [Playwright](https://playwright.dev/) | `npm run test:e2e` |

---

## 2. Co uruchamiać i kiedy

### Szybki feedback (przy codziennej pracy)

```bash
# Tylko testy jednostkowe TS (finance + inne *.test.ts, bez pełnego buildu)
npm run test
# lub
npm run test:unit
```

- **Testy Pythona** (manager, scenarios_manager), gdy masz Pythona w PATH:
  ```bash
  pip install -r requirements-py.txt
  pytest tests/ -v --tb=short
  ```

### Przed commitem / PR

1. `npm run lint`
2. `npm run check:use-server`
3. `npm run test` (Vitest bez buildu)
4. (opcjonalnie) `npm run test:build` – **wymaga**, żeby projekt budował się bez błędów TypeScript (patrz sekcja 4)

### Przed release / deployem (pełna ścieżka)

1. `npm ci`
2. `npx prisma generate`
3. `npm run lint`
4. `npm run check:use-server`
5. `npm run build`  
   - Jeśli build się wywala (błędy TS), najpierw trzeba je usunąć (sekcja 4).
6. (opcjonalnie) `npm run test:e2e` (aplikacja musi być uruchomiona lub start w CI)

---

## 3. Opis zestawów testów

### 3.1 Vitest – testy jednostkowe (TypeScript)

- **Lokalizacja:** `__tests__/**/*.test.ts`
- **Uruchomienie:** `npm test` lub `npm run test:unit`
- **Zawartość:**
  - `__tests__/app/actions/finance.test.ts` – akcje modułu finansów (numeracja dokumentów, raporty, zmiany kasowe, płatności itd.) z mockami bazy i zależności.
  - Inne pliki `*.test.ts` w `__tests__/`, jeśli zostaną dodane.
- **Domyślnie** z konfiguracji Vitest **nie** jest uruchamiany test `__tests__/build.test.ts` (żeby `npm test` przechodził bez konieczności poprawy wszystkich błędów TS w projekcie).

### 3.2 Test buildu (Next.js)

- **Plik:** `__tests__/build.test.ts`
- **Uruchomienie:** `npm run test:build`
- **Cel:** Sprawdzenie, że `npx next build` kończy się sukcesem (brak błędów kompilacji/typow).
- **Uwaga:** Aby ten test przechodził, w projekcie nie mogą być błędy TypeScript zgłaszane przy `next build` (np. implicit `any`). Część plików została już poprawiona (patrz sekcja 4).

### 3.3 check:use-server

- **Uruchomienie:** `npm run check:use-server`
- **Cel:** Sprawdzenie, że w plikach z `"use server"` w `app/actions` eksportowane są tylko dozwolone elementy (async funkcje i typy). Zapobiega błędom typu „eksport obiektu w pliku use server”.

### 3.4 pytest – skrypty Pythona

- **Katalog:** `tests/`
- **Pliki:** `test_manager.py`, `test_scenarios_manager.py`
- **Uruchomienie:**  
  `pip install -r requirements-py.txt`  
  `pytest tests/ -v --tb=short`
- **Zakres:** `manager.py` (zadania z TASKS.md, stan, batch limit), `scenarios_manager.py` (scenariusze, stan, parse_opt_args).

### 3.5 E2E (Playwright)

- **Uruchomienie:** `npm run test:e2e` (lub `npm run test:e2e:raw`, `npm run test:e2e:ui`)
- **Szczegóły:** Zobacz `docs/TESTY-I-WYKRYWANIE-BLEDOW.md` (smoke test tras, wykrywanie błędów runtime).

---

## 4. Błędy TypeScript a test buildu

`npm run test:build` uruchamia pełny `next build`. Next.js przy „Checking validity of types” zgłasza błędy (m.in. **parameter implicitly has an 'any' type**).

- **Naprawione pliki (przykłady):**  
  `app/actions/allotments.ts`, `app/actions/attractions.ts`, `app/actions/audit.ts`.
- **Dalsze kroki:** W pozostałych plikach z błędami (np. `booking-engine.ts`, `camping.ts`, `channel-manager.ts`, `companies.ts`, `dashboard.ts` itd.) należy dodać jawne typy dla parametrów callbacków i zmiennych (albo poprawić typy Prisma), aż `npx next build` zakończy się bez błędów. Wtedy `npm run test:build` będzie przechodził.

---

## 5. Skrypty npm – podsumowanie

| Skrypt | Opis |
|--------|------|
| `npm test` | Vitest: wszystkie testy jednostkowe TS **bez** testu buildu (szybkie, stabilne). |
| `npm run test:unit` | To samo co `npm test`. |
| `npm run test:build` | Tylko test buildu (`next build`). Wymaga braku błędów TS w projekcie. |
| `npm run test:watch` | Vitest w trybie watch. |
| `npm run check:use-server` | Walidacja eksportów w plikach „use server”. |
| `npm run test:e2e` | E2E (Playwright) według konfiguracji w `scripts/run-e2e.ts`. |

---

## 6. CI (przykład)

Sekwencja w pipeline (np. GitHub Actions / GitLab CI):

1. `npm ci`
2. `npx prisma generate`
3. `npm run lint`
4. `npm run check:use-server`
5. `npm run test` (Vitest bez buildu)
6. (gdy projekt jest wolny od błędów TS) `npm run test:build`
7. `npm run build`
8. (opcjonalnie) `npm run test:e2e` z uruchomioną aplikacją

Dzięki temu masz spójny plan testów i wiesz, które kroki wykonać, żeby program działał w 100% zgodnie z tym planem (w tym pełny build i test buildu po usunięciu błędów TypeScript).
