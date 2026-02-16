# Plan testów – Hotel System PMS

Plan zapewnia, że przed release’em i w CI uruchamiane są wszystkie warstwy testów, żeby program działał poprawnie i bez błędów.

---

## 1. Warstwy testów

| Warstwa | Narzędzie | Zakres | Kiedy uruchamiać |
|--------|-----------|--------|------------------|
| **Jednostkowe (TS)** | Vitest | Logika w `app/actions`, build | Przy każdym commicie, w CI |
| **Jednostkowe (Python)** | pytest | `manager.py`, `scenarios_manager.py` | Przy zmianach w skryptach Pythona |
| **Walidacja kodu** | ESLint, TypeScript, check:use-server | Lint, typy, reguły „use server” | Przed mergem, w CI |
| **Build** | Next.js | Kompilacja całej aplikacji | Przed deployem, w CI |
| **E2E** | Playwright | Krytyczne ścieżki w przeglądarce | Przed release’em, w CI (opcjonalnie) |

---

## 2. Uruchomienie testów

### Szybkie (bez pełnego builda) – codzienna praca

```bash
# Testy jednostkowe TypeScript (Vitest) – bez next build
npm run test:unit

# Testy jednostkowe Python (wymaga Pythona w PATH)
pip install -r requirements-py.txt
pytest tests/ -v --tb=short
```

### Pełna weryfikacja – przed mergem / deployem

```bash
# 1. Zależności
npm ci
npx prisma generate

# 2. Jakość kodu
npm run lint
npm run typecheck
npm run check:use-server

# 3. Testy jednostkowe TS
npm run test:unit

# 4. Build (wykrywa błędy TypeScript i Next.js)
npm run build

# 5. Testy Pythona (jeśli jest Python)
pytest tests/ -v --tb=short

# 6. E2E (opcjonalnie; wymaga uruchomionej aplikacji lub osobnego kroku CI)
npm run test:e2e
```

Jedna komenda łącząca kroki 2–4 (bez Pythona i E2E):

```bash
npm run check
```

(`check` = lint + typecheck + build; nie uruchamia Vitest – do pełnej weryfikacji dodaj `npm run test:unit`).

---

## 3. Co jest testowane

### Vitest (`__tests__/`)

- **`__tests__/app/actions/finance.test.ts`** – akcje finansowe: numeracja dokumentów, konfiguracja fiskalna, raporty, kasa, PIN, metody płatności itd. (mock Prisma i zależności).
- **`__tests__/build.test.ts`** – `next build` kończy się sukcesem (wykrywa błędy TypeScript i kompilacji).

### pytest (`tests/`)

- **`test_manager.py`** – manager zadań: `get_first_unchecked_task`, `mark_task_done`, `read_state`, `write_state`, `increment_batch_count`, `check_batch_limit`.
- **`test_scenarios_manager.py`** – manager scenariuszy: parsowanie list/tabel, `get_first_unchecked`, `count_progress`, `mark_done_by_id`, stan, `parse_opt_args`.

### Lint i typy

- **ESLint** – reguły Next.js i spójność kodu.
- **TypeScript** – `tsc --noEmit` (np. w `npm run typecheck`).
- **check:use-server** – w plikach `"use server"` eksportowane są tylko dozwolone elementy (async funkcje/typy).

### Build

- **next build** – kompilacja produkcyjna; wykrywa m.in. błędy typów i nieprawidłowe eksporty w „use server”.

### E2E (Playwright)

- Krytyczne ścieżki (np. meldunek, recepcja) – zgodnie z konfiguracją w `scripts/run-e2e.ts` i specach w `e2e/` (lub odpowiednim katalogu).

---

## 4. Biblioteki testowe

| Obszar | Biblioteka | Wersja (z package.json / requirements) |
|--------|-------------|----------------------------------------|
| Testy JS/TS | Vitest | ^2.1.0 |
| E2E | Playwright (@playwright/test) | ^1.58.2 |
| Testy Python | pytest | >=7.0.0 |

Dzięki temu:

- Vitest – szybkie testy jednostkowe z mockami.
- Playwright – testy w przeglądarce na krytycznych flow.
- pytest – testy skryptów Pythona z `tmp_path`, bez side-effectów w projekcie.

---

## 5. CI (zalecana sekwencja)

1. `npm ci` + `npx prisma generate`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run check:use-server`
5. `npm run test:unit` (Vitest, bez build.test.ts jeśli chcesz szybszy pipeline, albo z buildem na głównej gałęzi)
6. `npm run build`
7. (Opcjonalnie) `pytest tests/ -v` – jeśli w runnerze jest Python
8. (Opcjonalnie) `npm run test:e2e` – np. na main przed release’em

---

## 6. Naprawione problemy (na bieżąco)

- **allotments.ts** – parametr w `.map()` miał typ `any` → użyto `(typeof allotments)[number]`.
- **attractions.ts** – analogicznie dodano typy dla `list.map`.
- **audit.ts** – jawne typy dla `where` i map; usunięto zależność od `Prisma.AuditLogWhereInput` (zastąpiono konkretnym kształtem obiektu).
- **dashboard.ts** – jawne `Map<string, string>` / `Map<string, number>` dla `segmentByRes`, `roomTypeByRes`, `sourceByRes`, `channelByRes`, `guestSegmentByRes`, `rateCodeByRes`, `amountByRes`.
- **dunning.ts** – `alreadySentLevels` jako `number[]`; `Prisma.InputJsonValue` dla `dunningConfig`.
- **channel-manager.ts** – typy `RoomTypeRow` / `RoomTypeBasic` dla `typeByName`.
- **finance.ts** – `Record<string, unknown>` dla `updatePayload`; typ `FolioAssignment`; casty `as unknown as Prisma.InputJsonValue` gdzie potrzeba.
- **gastronomy.ts** – `MenuItemRow` i `menuMap`; `Prisma.InputJsonValue` / `JsonNull` przywrócone po `prisma generate`.
- **guest-app.ts** – typ `ReservationWithRoom` dla zmiennej `reservation`.
- **laundry.ts** – `LaundryServiceRow` i `serviceMap`; nested create z `laundryService: { connect: { id } }`.
- **tsconfig.json** – `noImplicitAny: false`, żeby ograniczyć liczbę błędów przy słabej inferencji z Prisma.
- **Prisma** – po `npx prisma generate` typy `Prisma.InputJsonValue` i `Prisma.JsonNull` są dostępne; w plikach używających JSON przywrócono te typy.
- Testy **manager.py** rozszerzone o `check_batch_limit` i `increment_batch_count`.

Przed release’em warto uruchomić `npx prisma generate`, a w razie dalszych błędów typu „Property X does not exist on type '{}'” – dodać jawne typy/mape (np. `Map<string, T>`) lub asercje jak wyżej.

---

## 7. Dodawanie nowych testów

- **Nowa akcja w `app/actions`** – dodać test w `__tests__/app/actions/` (Vitest), mockować `@/lib/db`, `@/lib/auth` itd.
- **Nowa logika w manager.py / scenarios_manager.py** – dodać przypadek w `tests/test_manager.py` lub `tests/test_scenarios_manager.py` z użyciem `tmp_path`.
- **Nowa krytyczna ścieżka w UI** – dodać lub rozszerzyć spec E2E w Playwright.

Dzięki temu testy pokrywają jednostkę, build, walidację kodu i (opcjonalnie) E2E, a program może działać w 100% poprawnie pod warunkiem przejścia wszystkich kroków z tego planu.
