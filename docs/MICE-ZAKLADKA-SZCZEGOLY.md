# Zakładka MICE – szczegółowy opis dla AI

> Dokumentacja techniczna modułu MICE (Meetings, Incentives, Conferences, Events) w HotelSystem.  
> Napisana z myślą o innym AI pracującym nad tym kodem.

---

## 1. Wprowadzenie

MICE to moduł obsługi **konferencji, bankietów i imprez** (wesela, komunie, stypy itd.). W projekcie ma własną sekcję w bocznym menu (sidebar) oraz stronę główną `/mice`, z podstronami: grafik sal, kosztorysy, eventy, zlecenia realizacji.

**Uprawnienie:** `module.mice` – kontroluje widoczność całej sekcji.

---

## 2. Nawigacja i struktura URL

| URL | Opis |
|-----|------|
| `/mice` | Strona główna MICE – hub z linkami do podmodułów |
| `/mice/grafik` | Grafik sal konferencyjnych (tape chart) |
| `/mice/kosztorysy` | Kosztorysy grupowe |
| `/mice/eventy` | Eventy – widok zleceń według typu eventu |
| `/mice/zlecenia` | Zlecenia realizacji – główna lista i formularz CRUD |
| `/events` | Lista imprez (EventOrder) – tabela z datą, typem, klientem |
| `/events/new` | Nowa impreza – formularz tworzenia |
| `/events/[id]` | Szczegóły imprezy |
| `/events/[id]/edit` | Edycja imprezy |

**Sidebar (components/app-sidebar.tsx):**
- Sekcja: `sidebar.sectionMice` → "Konferencje"
- Główny link: `/mice` (sidebar.mice → "MICE")
- Podstrony: eventy, kosztorysy, zlecenia realizacji

---

## 3. Modele bazy danych (Prisma)

### 3.1. EventOrder

Model `EventOrder` to główna encja imprezy. Zawiera rozbudowane pola:

- **Podstawowe:** `id`, `name`, `eventType`, `clientName`, `clientPhone`, `eventDate`, `timeStart`, `timeEnd`, `roomName`
- **Goście:** `guestCount`, `adultsCount`, `children03`, `children47`, `orchestraCount`, `cameramanCount`, `photographerCount`
- **Wesele:** `churchTime`, `brideGroomTable`, `orchestraTable`
- **Menu:** `packageId`, `cakesAndDesserts`, `menu` (JSON)
- **Tort:** `cakeOrderedAt`, `cakeArrivalTime`, `cakeServedAt`
- **Alkohol/napoje:** `drinksArrival`, `drinksStorage`, `champagneStorage`, `alcoholUnderStairs`, itd.
- **Dekoracje:** `cakesSwedishTable`, `fruitsSwedishTable`, `ownFlowers`, `decorationColor`, `placeCards`, `tableLayout`, itd.
- **Afterparty:** `afterpartyEnabled`, `afterpartyTimeFrom`, `afterpartyTimeTo`, `afterpartyGuests`, `afterpartyMenu`, `afterpartyMusic`
- **Google:** `googleCalendarEventId`, `googleCalendarCalId`, `googleCalendarEvents`, `googleCalendarSynced`, `checklistDocId`, `menuDocId`
- **Finanse:** `depositAmount`, `depositPaid`
- **Poprawiny:** `isPoprawiny`, `parentEventId`
- **Status:** `quoteId`, `roomIds` (JSON), `dateFrom`, `dateTo`, `status` (DRAFT|CONFIRMED|DONE|CANCELLED), `notes`

**eventType (pełna lista):** WESELE, KOMUNIA, CHRZCINY, URODZINY, STYPA, FIRMOWA, SYLWESTER, INNE

**Uwaga:** Strona `/mice/eventy` używa etykiet WEDDING, CONFERENCE, BANQUET, OTHER – może być mapowanie lub historyczna różnica; EventOrder ma WESELE, KOMUNIA itd.

### 3.2. GroupQuote

Model `GroupQuote` – kosztorysy grupowe:

- `id`, `name`, `validUntil`, `totalAmount`, `items` (JSON: `[{ name, quantity, unitPrice, amount }]`)
- Brak relacji FK do EventOrder – `quoteId` w EventOrder to zwykły string (ID GroupQuote).

---

## 4. Podstrony MICE

### 4.1. `/mice` (app/mice/page.tsx)

Strona główna – hub z czterema sekcjami (card):

1. **Grafik sal konferencyjnych** – link do `/mice/grafik`
2. **Kosztorysy grupowe** – link do `/mice/kosztorysy`
3. **Imprezy** – linki do `/events` i `/mice/eventy`
4. **Zlecenia realizacji** – link do `/mice/zlecenia`

### 4.2. `/mice/grafik` (app/mice/grafik/)

- Wykorzystuje **TapeChart** – ten sam komponent co dla pokoi noclegowych.
- Pokazuje rezerwacje sal typu **Sala** (pokoje z `type: "Sala"` w module Pokoje).
- Pobiera dane przez `getTapeChartData({ roomIds })`.
- Jeśli brak pokoi typu Sala: komunikat „Brak pokoi typu Sala. Dodaj sale konferencyjne w module Pokoje.”

### 4.3. `/mice/kosztorysy` (app/mice/kosztorysy/)

- Lista `GroupQuote` + formularz `KosztorysForm` (kosztorys-form.tsx).
- Server actions: `createGroupQuote`, `updateGroupQuote`, `deleteGroupQuote` z `app/actions/mice.ts`.
- Pozycje kosztorysu: name, quantity, unitPrice, amount (struktura `GroupQuoteItem`).

### 4.4. `/mice/eventy` (app/mice/eventy/)

- Wyświetla `EventOrder` w widoku grupowym według typu (WEDDING, CONFERENCE, BANQUET, OTHER).
- Komponent kliencki: `EventyClient` z filtrami: typ eventu, data od, data do.
- Link do zarządzania zleceniami: `/mice/zlecenia`.
- Używa `roomIds` z EventOrder – mapowanie na numery sal z `Room` (type: "Sala").

### 4.5. `/mice/zlecenia` (app/mice/zlecenia/)

- Główna strona CRUD zleceń realizacji.
- Formularz `ZlecenieForm` (zlecenie-form.tsx) – tworzenie/edycja EventOrder.
- Lista: salaRooms (pokoje typu Sala), quotes (GroupQuote), orders (EventOrder).
- Zlecenie może być powiązane z kosztorysem (`quoteId`) i salami (`roomIds`).

### 4.6. `/events` i `/events/new`, `/events/[id]`, `/events/[id]/edit`

- Lista imprez – tabela z: data, typ, klient, sala, goście, status, zadatek, akcje (Szczegóły, Edytuj).
- Obsługa **poprawin** – pole `isPoprawiny`, `parentEventId`.
- Nowa impreza: formularz w `/events/new`.
- API: `app/api/event-orders/route.ts` – POST (create), PATCH (update), GET (lista).

---

## 5. API i Server Actions

### 5.1. API event-orders (app/api/event-orders/route.ts)

- **POST** – tworzenie EventOrder (sanitizeEventData, syncEventToGoogle, createChecklistDoc, createMenuDoc).
- **PATCH** – aktualizacja EventOrder.
- **GET** – lista zleceń.

Funkcja `parseRooms(roomName)` – parsuje nazwy sal z pola tekstowego.

### 5.2. Server Actions (app/actions/mice.ts)

- `createGroupQuote(name, validUntil, items)` 
- `updateGroupQuote(id, name, validUntil, items)`
- `deleteGroupQuote(id)`

`GroupQuoteItem`: `{ name: string; quantity: number; unitPrice: number; amount: number }`.

---

## 6. Integracje

- **Google Calendar** – EventOrder ma pola `googleCalendarEventId`, `googleCalendarEvents`, `googleCalendarSynced`, itd. API event-orders wywołuje `createCalendarEvent`, synchronizację.
- **Google Docs** – `checklistDocId`, `menuDocId`, `createChecklistDoc`, `createMenuDoc`.
- **TapeChart** – wspólny komponent do grafiku pokoi i sal, `getTapeChartData` z `app/actions/tape-chart`.

---

## 7. Pokoje typu Sala

- Pokoje konferencyjne to `Room` z `type: "Sala"` i `activeForSale: true`.
- Dodawane w module Pokoje, nie w MICE.
- Używane w: mice/grafik, mice/zlecenia, mice/eventy (mapowanie roomIds → room.number).

---

## 8. i18n (translations.ts)

- `sidebar.mice` → MICE  
- `sidebar.miceEvents` → Eventy  
- `sidebar.miceQuotes` → Kosztorysy  
- `sidebar.miceOrders` → Zlecenia realizacji  
- `sidebar.sectionMice` → Konferencje  

---

## 9. Testy (Test/mice.spec.ts)

- MICE-01: strona /mice ładuje się
- MICE-02: eventy – lista eventów
- MICE-03: nowy event – formularz z polami
- MICE-04: kosztorysy – lista
- MICE-05: nowy kosztorys – formularz
- MICE-06: zlecenia – lista

---

## 10. Powiązane pliki – mapa

| Obszar | Pliki |
|--------|-------|
| Strony MICE | app/mice/page.tsx, app/mice/grafik/page.tsx, app/mice/kosztorysy/page.tsx, app/mice/eventy/page.tsx, app/mice/zlecenia/page.tsx |
| Klienty | app/mice/eventy/eventy-client.tsx, app/mice/kosztorysy/kosztorys-form.tsx, app/mice/zlecenia/zlecenie-form.tsx, app/mice/grafik/mice-grafik-client.tsx |
| Imprezy | app/events/page.tsx, app/events/new/page.tsx, app/events/[id]/, app/events/[id]/edit/ |
| API | app/api/event-orders/route.ts |
| Actions | app/actions/mice.ts |
| Modele | prisma/schema.prisma: EventOrder, GroupQuote |
| Sidebar | components/app-sidebar.tsx (sekcja mice) |
| Dashboard | components/Dashboard.tsx (kafelki MICE) |

---

## 11. Uwagi dla AI

1. **EventOrder vs Eventy** – EventOrder ma eventType WESELE, KOMUNIA itd. Strona eventy używa WEDDING, CONFERENCE, BANQUET, OTHER – sprawdź mapowanie w eventy/page.tsx (EVENT_TYPE_LABELS).
2. **roomIds** – w EventOrder to JSON (tablica ID sal). W eventy wyświetlane jako numery sal (room.number).
3. **quoteId** – łączy EventOrder z GroupQuote; brak FK w Prisma – ręczne sprawdzanie.
4. **Poprawiny** – EventOrder może mieć `isPoprawiny=true` i `parentEventId` wskazujący na główne wesele.
5. **Menu imprezowe** – szczegółowe menu (np. Karczma Łabędź) jest w `docs/MENU-IMPREZY-KARCZMA-LABEDZ.md`, nie w kodzie.
