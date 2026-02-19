# Synchronizacja Bistro → HotelSystem

Synchronizacja karty dań i rachunków "na pokój" z Bistro (KW Hotel / Symplex) do HotelSystem.

## Co jest synchronizowane

1. **Karta dań** — tabela `assortment` → `MenuItem` (nazwa, cena, kategoria)
2. **Rachunki na pokój** — dokumenty sprzedaży Bistro → obciążenie rezerwacji w HotelSystem

## Konfiguracja

### 1. Baza Bistro

Utwórz plik `bistro-sync/.env` na podstawie `.env.example`:

```
BISTRO_DATABASE_URL=mysql://admin:gracho123@10.119.169.20:3306/kwhotel
MENU_SYNC_URL=https://hotel.karczma-labedz.pl/api/v1/external/menu-sync
EXTERNAL_API_KEY=twoj-klucz-api
```

- **BISTRO_DATABASE_URL** — baza, w której jest tabela `assortment` (może być `kwhotel` lub `hoteldat`)
- **MENU_SYNC_URL** — URL Twojej aplikacji HotelSystem + `/api/v1/external/menu-sync`
- **EXTERNAL_API_KEY** — ten sam klucz co w `.env` aplikacji (EXTERNAL_API_KEY)

### 2. Rachunki (symplex-bridge)

Utwórz lub zaktualizuj `symplex-bridge/.env`:

```
KW_DATABASE_URL=mysql://admin:gracho123@10.119.169.20:3306/kwhotel
OCCUPIED_ROOMS_URL=https://hotel.karczma-labedz.pl/api/v1/external/occupied-rooms
POSTING_URL=https://hotel.karczma-labedz.pl/api/v1/external/posting
EXTERNAL_API_KEY=twoj-klucz-api
```

### 3. Dostęp sieciowy

Komputer, na którym uruchamiasz sync, musi mieć dostęp do:

- bazy Bistro (`10.119.169.20`, port 3306 lub 8806),
- API HotelSystem (np. `https://hotel.karczma-labedz.pl`).

Jeśli Bistro jest za firewallem, sync musi działać na maszynie w tej samej sieci (np. przez AnyDesk / VPN).

## Uruchomienie

### Ręcznie (test)

```powershell
# Tylko karta dań
node bistro-sync/sync-menu.mjs --once

# Pełna synchronizacja (menu + rachunki + pokoje)
node bistro-sync/run-sync.mjs
```

### Automatycznie (Harmonogram Zadań)

```powershell
powershell -ExecutionPolicy Bypass -File bistro-sync\setup-scheduler.ps1
```

Zadanie uruchamia się co 2 minuty. Aby zmienić interwał, edytuj `$IntervalMinutes` w skrypcie.

## Schema bazy

Skrypt oczekuje tabeli `assortment` (lub `assertyment`) z kolumnami:

- `AssortmentID` — ID produktu
- `Nazwa` — nazwa dania
- `Brutto` — cena brutto (PLN)
- `Kategoria` — kategoria (np. "Napoje")
- `Active` — 1 = aktywny, synchronizowany

## Migracja bazy HotelSystem

Przed pierwszym syncem uruchom lokalnie:

```powershell
npx prisma db push
```

Dodaje kolumnę `externalId` do tabeli `MenuItem`.
