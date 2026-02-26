# Naprawa dev servera – biała strona, 404 na chunki JS, 500 na /front-office

## Objawy (przed naprawą)

- **Biała strona** na `http://localhost:3011/front-office`
- **404 (Not Found)** na pliki JS: `webpack.js`, `react-refresh.js`, `vendors.js`, `main.js`, `error.js`, `app.js`
- **500 (Internal Server Error)** na request do `/front-office`

Typowa przyczyna: **uszkodzony lub nieaktualny cache buildu Next.js** (katalog `.next`). Stare chunki webpack/vendor nie zgadzają się z tym, czego oczekuje aplikacja, co daje 404 na assety i błędy po stronie serwera (500).

## Co zostało zrobione (kroki naprawy)

1. **Sprawdzenie zajętości portu 3011**
   - W PowerShell: `netstat -ano | Select-String ":3011 " | Select-String "LISTENING"`
   - Port był zajęty przez proces (PID 14800).

2. **Zatrzymanie procesu na porcie 3011**
   - W PowerShell: `Stop-Process -Id 14800 -Force -ErrorAction SilentlyContinue`
   - Umożliwia czysty start jednej instancji dev servera (unikanie EADDRINUSE).

3. **Czysty start dev servera**
   - Uruchomiono: `npm run dev:clean` (w katalogu projektu).
   - Skrypt `dev:clean` w `package.json`:
     - usuwa katalog `.next` (pełne usunięcie cache buildu),
     - uruchamia `prisma generate` i `prisma db push --skip-generate`,
     - uruchamia `npx tsx scripts/sync-config-on-start.ts`,
     - startuje `next dev -p 3011`.
   - Serwer został uruchomiony w tle; po ok. 25 s Next.js zgłosił „Ready” na `http://localhost:3011`.

4. **Rekomendacja dla użytkownika**
   - Otworzyć **http://localhost:3011/front-office** (http, nie https).
   - Zrobić **twarde odświeżenie** (Ctrl+Shift+R lub Ctrl+F5), żeby przeglądarka nie ładowała starych chunków z cache.

## Dla AI / przyszłej referencji

- Przy **białej stronie + 404 na pliki JS + 500 na konkretną stronę** w Next.js na localhost:
  1. Zatrzymać wszystko na porcie dev (np. 3011).
  2. Uruchomić **`npm run dev:clean`** (albo ręcznie usunąć `.next` i potem `npm run dev`).
  3. Poczekać na zakończenie kompilacji („Ready”).
  4. Zalecić użytkownikowi twarde odświeżenie (Ctrl+Shift+R).
- Zasady i komendy są opisane w `.cursor/rules/dev-server-troubleshooting.mdc`.

Data naprawy: 2026-02-26
