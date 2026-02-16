# Dlaczego testy nie wychwyciły błędu i jak to poprawić

## Dlaczego błąd „use server” nie wyszedł w testach?

1. **E2E domyślnie uruchamia tylko część speców**  
   `npm run test:e2e` (skrypt `run-e2e.ts`) uruchamia tylko `check-in-flow.spec.ts` i `ci-gap.spec.ts`. Spec `Test/check-in.spec.ts` (który wchodzi na `/check-in` i sprawdza nagłówek) **nie jest** w domyślnej liście – więc pełne wejście na stronę Meldunek mogło nie być testowane w Twoim typowym uruchomieniu.

2. **Błąd pojawia się przy pierwszym załadowaniu strony**  
   Next.js waliduje pliki `"use server"` przy **bundlowaniu** – gdy strona (np. `/check-in`) po raz pierwszy ładuje komponent korzystający z `hotel-config.ts`. Jeśli testy nie wchodzą na tę stronę albo nie czekają na pełne załadowanie (łącznie z server actions), błąd może nie wystąpić w przeglądarce testowej.

3. **`next build` nie był uruchamiany przed wdrożeniem**  
   Komenda `next build` buduje całą aplikację (serwer + klient). Przy takim buildzie Next.js od razu wykrywa nieprawidłowe eksporty w plikach `"use server"` (np. eksport obiektu zamiast async funkcji). Jeśli przed wdrożeniem nie uruchamiasz `npm run build`, ten błąd wychodzi dopiero w przeglądarce przy pierwszym wejściu na daną ścieżkę.

---

## Co zrobić, żeby takie błędy wychwytywać?

### 1. Przed release’em / deployem: **`npm run build`**

```bash
npm run build
```

Jeśli w projekcie jest nieprawidłowy eksport w pliku `"use server"`, build się wyłoży lub błąd ujawni się przy budowaniu. Wprowadź zasadę: **przed mergem lub deployem zawsze uruchamiany jest build.**

### 2. Walidacja plików „use server”: **`npm run check:use-server`**

W projekcie jest skrypt, który sprawdza, że w plikach z `"use server"` w `app/actions` eksportowane są tylko dozwolone elementy (async funkcje i typy):

```bash
npm run check:use-server
```

Dodaj to do CI (np. obok `lint`) albo uruchamiaj lokalnie przed commitem. Wtedy błędy typu „eksport obiektu w pliku use server” wychwycone są **zanim** uruchomisz aplikację.

### 3. E2E: wejście na kluczowe ścieżki + wykrywanie błędów w przeglądarce

- **Rozszerz domyślną listę speców** w `scripts/run-e2e.ts` tak, aby obejmowała np. `Test/check-in.spec.ts` (strona Meldunek). Dzięki temu każde uruchomienie E2E będzie wchodzić na `/check-in` i ładować server actions z `hotel-config`.
- **Smoke test krytycznych tras:** dodaj jeden spec (np. `Test/smoke-critical-routes.spec.ts`), który tylko wchodzi na kilka kluczowych URLi (np. `/`, `/check-in`, `/recepcja`, `/ustawienia`) z `waitUntil: 'networkidle'` lub `'load'` – żeby Next.js zdążył zbudować i zwalidować server actions dla tych stron.
- **Błędy runtime w Playwright:** w testach możesz zbierąć błędy z konsoli i failować test przy „Unhandled Runtime Error”:

```ts
// W beforeEach lub w globalSetup – przykład
page.on("pageerror", (err) => {
  if (err.message.includes("use server") || err.message.includes("Unhandled Runtime Error")) {
    throw err;
  }
});
```

Wtedy każdy taki błąd na stronie od razu przerwie test.

### 4. W CI: build + lint + check:use-server + E2E

Przykładowa sekwencja w pipeline (GitHub Actions, GitLab CI itd.):

1. `npm ci`
2. `npx prisma generate`
3. `npm run lint`
4. `npm run check:use-server`
5. `npm run build`
6. (opcjonalnie) `npm run test:e2e` (z uruchomioną aplikacją lub po `npm run start`)

Dzięki temu błędy typu „use server – found object” będą łapane na etapie builda lub checka, a nie dopiero w przeglądarce u użytkownika.

---

## Podsumowanie

| Środek | Co wykrywa |
|--------|------------|
| `npm run build` | Błędy bundlowania, w tym nieprawidłowe eksporty w „use server”. |
| `npm run check:use-server` | Eksporty const/let/obiektów w plikach „use server” – przed uruchomieniem appki. |
| E2E na `/check-in` i inne krytyczne trasy | Błędy runtime przy faktycznym wejściu na stronę. |
| `page.on("pageerror", …)` w Playwright | Nieobsłużone błędy JS w przeglądarce (np. overlay Next.js). |

Wprowadzenie tych kroków znacząco zmniejszy ryzyko, że podobne błędy wyjdą dopiero „na produkcji” lub po ręcznym wejściu na daną stronę.
