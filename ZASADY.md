# Zasady projektu: Next.js + Prisma + MyDevil (FreeBSD)

## 1. Kontekst infrastruktury

- **Serwer:** MyDevil (FreeBSD 14).
- **Node:** Hostowany przez Passenger.
- **Baza danych:** MySQL (MariaDB).
- **Deploy:** Aplikacja działa w trybie `standalone`.

## 2. Zarządzanie bazą danych (krytyczne)

Każda zmiana w pliku `prisma/schema.prisma` **musi** być odzwierciedlona w bazie danych. Nie zakładaj, że baza zaktualizuje się sama.

### Workflow przy zmianie schematu

**Lokalnie (Windows):**

1. Po edycji `schema.prisma` uruchom: `npx prisma db push` (historia migracji jest niespójna).
2. Wygeneruj klienta: `npx prisma generate`.

**Produkcja (MyDevil):**

- **Używamy wyłącznie `npx prisma db push`** (nie `migrate deploy`) – historia migracji (`_prisma_migrations`) może być niekompletna po ręcznych naprawach SQL.
1. Po deployu plików aplikacji zaktualizuj strukturę bazy na serwerze.
2. **Metoda zalecana (automatyczna):** Skrypt `deploy-to-mydevil.ps1` na końcu uruchamia przez SSH `npx prisma db push` na serwerze – baza aktualizuje się przy każdym deployu (wymaga `DATABASE_URL` w `~/.bash_profile`).
3. **Metoda ręczna:** Jeśli deploy bez tego kroku – wejdź SSH i wpisz `npx prisma db push` w katalogu aplikacji.
4. **Metoda awaryjna (SQL):** Gdy `db push` nie jest możliwe – przygotuj zapytania SQL (`ALTER TABLE`, `CREATE TABLE`) do wykonania w PhpMyAdmin.

### Synchronizacja schema.prisma z produkcją (introspect)

Żeby lokalny plik `schema.prisma` był w 100% zgodny z bazą na serwerze (np. po ręcznych naprawach SQL na produkcji):

1. **Na serwerze (SSH):** W katalogu aplikacji (`~/domains/hotel.karczma-labedz.pl/public_nodejs` lub z `.env.deploy`) uruchom: `npx prisma db pull` – nadpisze tam `schema.prisma` stanem z bazy.
2. **Pobierz plik na Windows:** np. `scp karczma-labedz@panel5.mydevil.net:domains/hotel.karczma-labedz.pl/public_nodejs/prisma/schema.prisma prisma/schema.pulled.prisma` (użyj ścieżki z `.env.deploy`).
3. **Lokalnie:** Otwórz `schema.pulled.prisma`, skopiuj całą zawartość **z wyjątkiem** sekcji `generator client`. W `prisma/schema.prisma` zastąp wszystko (datasource, enums, modele) tą zawartością, ale **zachowaj** swoją sekcję `generator client` (z `binaryTargets = ["native", "freebsd14"]` i ewentualnie `engineType = "client"`).
4. **Opcjonalnie:** Uruchom `npx prisma db push` lokalnie (z `.env` wskazującym na lokalną bazę), żeby lokalna baza też była zgodna z tym schematem.
5. Usuń `schema.pulled.prisma` lub zostaw jako kopię zapasową.

## 3. Unikanie błędów runtime (Prisma)

W pliku `prisma/schema.prisma` w sekcji `generator client` **zawsze** muszą być ustawione `binaryTargets` dla obu środowisk:

```prisma
binaryTargets = ["native", "freebsd14"]
```

(Nawet przy `engineType = "client"` trzymaj te wartości dla spójności i na wypadek zmiany silnika.)
