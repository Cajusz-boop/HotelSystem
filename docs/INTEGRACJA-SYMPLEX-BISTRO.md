# Integracja z Symplex Bistro – dania na pokój

Celem jest **widoczność w systemie hotelowym**, które dania/rachunki z restauracji (Symplex Bistro) były rozliczane **na pokój** – tak aby obciążenia pojawiały się w rezerwacji gościa.

## Stan obecny (na dzień dzisiejszy)

**Symplex Bistro jest obecnie połączony z KW Hotel** ([kwhotel.com](https://kwhotel.com)) – tam trafiają obciążenia „na pokój” z restauracji. Aby te same dania były widoczne w **tym** systemie hotelowym (HotelSystem), trzeba albo:

- **przełączyć** Bistro na wysyłanie do naszego API (jeśli Bistro / KW Hotel pozwala zmienić adres docelowy),  
- **albo** dodać bridge: eksport z Bistro (lub z KW Hotel) → nasze `POST /api/v1/external/posting`.

Poniżej opisane są API i sposoby połączenia Bistro z tym systemem.

## Stan po stronie systemu hotelowego

System ma gotowe **API postingu** do obciążania pokoju/rezerwacji:

- **Endpoint:** `POST /api/v1/external/posting`
- **Autoryzacja:** jeśli w `.env` ustawiono `EXTERNAL_API_KEY`, wymagany nagłówek `X-API-Key` lub `Authorization: Bearer <key>`.
- **Body (JSON):**
  - `roomNumber` (string) – numer pokoju **albo**
  - `reservationId` (string) – ID rezerwacji w systemie hotelowym
  - `amount` (number) – kwota do obciążenia
  - `type` (opcjonalnie) – np. `POSTING`, `RESTAURANT` (domyślnie `POSTING`)
  - `description` (opcjonalnie) – np. „Restauracja – obiad”, „Bar”

Przykład:

```json
{
  "roomNumber": "101",
  "amount": 89.50,
  "type": "RESTAURANT",
  "description": "Restauracja – obiad"
}
```

Odpowiedź sukcesu: `{ "success": true, "transactionId": "...", "reservationId": "...", "amount": 89.5, ... }`.

Dokładna specyfikacja i obsługa błędów: [KASA-FISKALNA.md](./KASA-FISKALNA.md) (sekcja Posting), plik `app/api/v1/external/posting/route.ts`.

---

## Po stronie Symplex Bistro

[Bistro](https://symplex.eu/node/128) to program gastronomiczny (restauracja, fast food, pizzeria). **Natywna integracja „na pokój”** jest wtedy, gdy używasz **Symplex Hotel** – wtedy Bistro i Hotel są w jednym systemie i rozliczenie obiektu (w tym gastronomia) jest powiązane z rezerwacją.

Ponieważ **używasz innego systemu hotelowego** (ten projekt), Bistro nie wywoła z siebie naszego API. Trzeba zapewnić **połączenie** w jednym z poniższych sposobów.

---

## Sposób 1: Eksport z Bistro → bridge → nasze API

Symplex udostępnia **wymianę danych przez pliki** (format EDI, eksporty):

- [Formaty plików do komunikacji](http://symplex.eu/?q=node%2F80) – sekcje `[Dokument]`, `[PozX]`, eksport uniwersalny EDI.
- W Bistro/Small Business można zwykle skonfigurować **eksport** (np. zamknięte rachunki, dokumenty sprzedaży) do wskazanego katalogu.

**Proponowany przepływ:**

1. W Bistro ustawić eksport zamkniętych rachunków „na pokój” do wspólnego folderu (np. co minutę lub po zamknięciu rachunku), w formacie EDI lub innym udokumentowanym przez Symplex.
2. **Bridge** (mały skrypt/serwis na maszynie z dostępem do tego folderu i do sieci hotelu):
   - czyta nowe pliki,
   - z pliku wyciąga: numer pokoju (lub identyfikator gościa), kwotę, ewentualnie opis,
   - wywołuje `POST /api/v1/external/posting` z tymi danymi,
   - po sukcesie usuwa/archiwizuje plik (żeby nie przetwarzać dwa razy).

W repozytorium jest **szkielet bridge’a** w katalogu `symplex-bridge/`: skrypt `run.mjs` czyta pliki z folderu (domyślny format: linie `roomNumber;amount;description`), wysyła posty do `POST /api/v1/external/posting` i przenosi przetworzone pliki do podfolderu `processed/`. Uruchomienie: `npm run symplex:bridge`. Konkretny format eksportu z Bistro (EDI lub inny) można dopasować w skrypcie – zob. [symplex-bridge/README.md](../symplex-bridge/README.md).

---

## Sposób 2: Zapytanie u Symplex (API / wtyczka)

Warto **zapytać Symplex** (dealer, support):

- Czy Bistro (lub Small Business z modułem Bistro) ma **API / WebService** do wysyłania zamkniętych rachunków (np. z informacją „rozliczenie na pokój” i numerem pokoju).
- Czy jest **wtyczka lub skrypt** wywoływany przy zamykaniu rachunku „na pokój”, do którego można podpiąć wywołanie HTTP do naszego `POST /api/v1/external/posting`.
- Czy w ramach **Sezam API** lub innego mechanizmu można przekazywać sprzedaż „na pokój” do zewnętrznego systemu hotelowego.

Jeśli Symplex udostępni taki kanał (HTTP callback lub skrypt z parametrami), integracja sprowadza się do podania URL i klucza API oraz ewentualnie mapowania pól (pokój, kwota, opis).

---

## Co trzeba ustalić z Bistro / Symplex / KW Hotel

1. **Obecna integracja z KW Hotel** – jak dokładnie Bistro łączy się z KW Hotel (API, pliki, wtyczka?). Czy da się **przełączyć** adres docelowy na nasze API albo **zduplikować** wysyłkę (do KW Hotel i do nas)?
2. **Identyfikator pokoju** – w jaki sposób w Bistro jest zapisywane „rozliczenie na pokój” (pole „pokój”, „rezerwacja”, stolik powiązany z pokojem?) i w jakiej formie trafia do KW Hotel / eksportu / API.
3. **Moment wysłania** – przy zamknięciu rachunku, czy w eksporcie dziennym (wtedy bridge może wysyłać wiele postów za jednym razem).
4. **Format eksportu** – jeśli będzie bridge: dokładna struktura pliku EDI (lub innego) z zamkniętymi rachunkami „na pokój”, żeby bridge mógł wyciągnąć `roomNumber` i `amount`.

---

## Konfiguracja po stronie hotelu

W `.env` aplikacji hotelowej:

```env
EXTERNAL_API_KEY=twoj-bezpieczny-klucz
```

Ten sam klucz musi być używany przez Bistro (lub bridge) w nagłówku `X-API-Key` lub `Authorization: Bearer <key>` przy wywołaniach `POST /api/v1/external/posting`.

Base URL API to adres Twojej aplikacji, np. `https://twoj-hotel.example.com/api/v1/external/posting`.

---

## Podsumowanie

| Element | Status |
|--------|--------|
| API w systemie hotelowym | Gotowe – `POST /api/v1/external/posting` |
| Widoczność „dania na pokój” | Transakcje z tego API pojawiają się w rezerwacji (Finanse, historia obciążeń) |
| Po stronie Bistro | Wymaga: eksportu do pliku + bridge **albo** API/skryptu od Symplex |

Rekomendacja: ustalić z Symplex format eksportu rachunków „na pokój” (lub dostęp do API), następnie podłączyć bridge wywołujący nasze API – wtedy w systemie hotelowym będzie widać, które dania były brane na pokój.
