# Bridge Symplex Bistro → API postingu (dania na pokój)

Mały skrypt przetwarzający **pliki z eksportu** (np. z Symplex Bistro) i wysyłający obciążenia na pokój do API systemu hotelowego (`POST /api/v1/external/posting`).

## Kiedy używać

- Bistro eksportuje zamknięte rachunki „na pokój” do wskazanego folderu (np. EDI lub CSV).
- Bridge okresowo czyta ten folder, parsuje pliki i wywołuje API hotelu.
- W systemie hotelowym pojawiają się transakcje („dania na pokój”) przy odpowiednich rezerwacjach.

## Konfiguracja (zmienne środowiska)

| Zmienna | Opis |
|--------|------|
| `POSTING_URL` | Pełny URL API postingu, np. `https://twoj-hotel.example.com/api/v1/external/posting` |
| `EXTERNAL_API_KEY` | Klucz API (taki sam jak w `.env` aplikacji hotelowej) |
| `SYMPLEX_WATCH_DIR` | Folder, z którego bridge czyta pliki (np. eksport Bistro) |
| `SYMPLEX_PROCESSED_DIR` | Folder na przetworzone pliki (domyślnie: `SYMPLEX_WATCH_DIR/processed`) |

## Format pliku wejściowego (domyślny)

Domyślny parser oczekuje pliku tekstowego z liniami w formacie:

```
roomNumber;amount;description
```

np.:

```
101;89.50;Restauracja obiad
203;24.00;Bar
```

- separator: średnik (`;`)
- pierwsza linia może być nagłówkiem (pomijana, jeśli nie pasuje do wzorca liczby)
- puste linie są pomijane

Jeśli Bistro eksportuje w **formacie EDI Symplex** ([opis](http://symplex.eu/?q=node%2F80)), trzeba dopisać parser sekcji `[Dokument]` / `[PozX]` w `run.mjs` i wyciągać z nich numer pokoju (np. z pola Uwagi, NazwaKontrahenta lub dedykowanego pola „Pokój”) oraz kwotę Brutto/Netto.

## Uruchomienie

Jednorazowe przetworzenie folderu:

```bash
node symplex-bridge/run.mjs
```

Zaplanowane (np. co minutę) – w **Windows (Harmonogram zadań)** lub **cron** (Linux):

```bash
node c:\ścieżka\do\HotelSystem\symplex-bridge\run.mjs
```

Opcjonalnie: tryb watch (ciągłe nasłuchiwanie na nowe pliki) – można dodać w przyszłości z `fs.watch` lub `chokidar`.

## Zabezpieczenia

- Używaj `EXTERNAL_API_KEY` i trzymaj go tylko po stronie bridge’a i `.env` hotelu.
- `POSTING_URL` powinien być HTTPS w produkcji.
- Folder `SYMPLEX_WATCH_DIR` powinien być dostępny tylko dla usługi bridge (np. katalog na serwerze z Bistro lub współdzielony).
