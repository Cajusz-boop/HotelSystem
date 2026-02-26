# Jak używać tych promptów z Cursor AI

## Strategia: SPEC + TASK

Zamiast jednego mega-promptu (który Cursor pomija w 50%), mamy:

- **1 × SPEC** — dokument referencyjny (pełna wizja, layout, kolumny, API)
- **5 × TASK** — małe prompty do sekwencyjnego wykonania

---

## Jak wrzucać do Cursora:

### Krok 1: Dodaj SPEC do kontekstu
- Skopiuj `SPEC-ksiega-meldunkowa.md` do folderu `docs/` w projekcie
- Lub dodaj jako plik do `.cursor/rules/`
- SPEC to REFERENCJA — Cursor ma go czytać, nie implementować

### Krok 2: Wrzuć TASK-01
- Otwórz Cursor chat
- Wklej zawartość `TASK-01-server-action-i-szkielet.md`
- Na początku powiedz: "Przeczytaj docs/SPEC-ksiega-meldunkowa.md i zrób TASK 1"
- Poczekaj aż skończy
- **SPRAWDŹ CHECKLISTĘ** — jeśli coś brakuje, kazuj poprawić ZANIM przejdziesz dalej

### Krok 3: Wrzuć TASK-02
- NOWY chat (czysta konwersacja)
- "Przeczytaj docs/SPEC-ksiega-meldunkowa.md i zrób TASK 2"
- Sprawdź checklistę

### Krok 4-5: Analogicznie TASK-03, TASK-04, TASK-05

---

## Ważne zasady:

1. **Nowy chat na każdy TASK** — Cursor gubi kontekst w długich konwersacjach
2. **SPEC zawsze w kontekście** — każdy TASK odwołuje się do SPEC
3. **Checklist obowiązkowy** — nie idź dalej jeśli ❌
4. **Jeśli Cursor pominie coś** — skopiuj brakujący punkt z checklisty i powiedz: "Pominąłeś ten punkt. Napraw teraz."

---

## Kolejność plików:

```
1. SPEC-ksiega-meldunkowa.md     ← referencja (dodaj do docs/)
2. TASK-01-server-action-i-szkielet.md  ← backend + page shell
3. TASK-02-panel-filtrow.md             ← filtry
4. TASK-03-tabela-kolumny-sortowanie.md ← tabela + kolumny
5. TASK-04-toolbar-eksport-druk.md      ← toolbar + CSV/Excel + print
6. TASK-05-polerowanie-i-weryfikacja.md ← QA + responsywność
```
# SPEC: Księga Meldunkowa — Dokument referencyjny

> **TEN DOKUMENT TO SPECYFIKACJA — NIE IMPLEMENTUJ GO BEZPOŚREDNIO.**
> Przeczytaj go i zapamiętaj. Implementację będziesz robić z osobnych TASK promptów
> które odwołują się do tego dokumentu.

---

## CEL

Dedykowana strona `/ksiega-meldunkowa` — centralne narzędzie recepcji do przeglądania
WSZYSTKICH rezerwacji z filtrami, konfigurowalnymi kolumnami, eksportem i drukiem.

Dane już istnieją w DB (Reservation + Guest + Room + Transaction).
Nie trzeba zmieniać schematu Prisma — trzeba zbudować UI + server action.

---

## DOCELOWY LAYOUT

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  📖 Księga Meldunkowa                                      [Karczma Łabędź] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ FILTRY (zwijane) ──────────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  Tryb:  (●) Wszystkie  (○) Przyjazdy  (○) Wyjazdy  (○) In-house       │ │
│  │         (○) No-show   (○) Anulowane                                    │ │
│  │                                                                         │ │
│  │  Data od: [📅 ________]  Data do: [📅 ________]                        │ │
│  │  [Dziś] [Jutro] [Ten tydzień] [Ten miesiąc] [Poprzedni mies.] [Rok]   │ │
│  │                                                                         │ │
│  │  Pokój: [▼ Wszystkie]  Typ: [▼ Wszystkie]   Status: [▼ Wszystkie]     │ │
│  │  Źródło:[▼ Wszystkie]  Segment:[▼ Wszystkie] Kanał: [▼ Wszystkie]     │ │
│  │  Wyżywienie: [▼ Wszystkie]                                             │ │
│  │                                                                         │ │
│  │  Szukaj gościa: [🔍 Nazwisko, email, telefon...              ]         │ │
│  │                                                                         │ │
│  │  [🔄 Szukaj]   [✕ Wyczyść filtry]                  [▲ Zwiń filtry]     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─ TOOLBAR ───────────────────────────────────────────────────────────────┐ │
│  │  Znaleziono: 147                                                        │ │
│  │  Przyjazdy: 12 │ Wyjazdy: 8 │ In-house: 45 │ No-show: 2 │ Anul.: 3   │ │
│  │                                     [⚙️ Kolumny] [CSV] [Excel] [🖨️]   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─ TABELA ───────────────────────────────────────────────────────────────┐  │
│  │  # │ ID  │ Gość         │ Pokój │ Typ     │ Check-in  │ Check-out │…  │  │
│  │  ──┼─────┼──────────────┼───────┼─────────┼───────────┼───────────┼── │  │
│  │  1 │1042 │⭐Kowalski J. │ 101   │ Comfort │ 27.02     │ 01.03    │…  │  │
│  │  2 │1043 │Nowak Anna    │ 205   │ Suite   │ 27.02     │ 28.02    │…  │  │
│  │                                                                        │  │
│  │  ◀ 1/6 ▶                                      Pokaż: [▼ 25] na str.  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## FILTRY — pełna specyfikacja

### Tryby (radio, jedna linia):
| Tryb | Query logika |
|------|-------------|
| Wszystkie | checkIn <= dateTo AND checkOut >= dateFrom |
| Przyjazdy | checkIn >= dateFrom AND checkIn <= dateTo |
| Wyjazdy | checkOut >= dateFrom AND checkOut <= dateTo |
| In-house | status = CHECKED_IN AND checkIn <= today AND checkOut >= today |
| No-show | status = NO_SHOW AND checkIn >= dateFrom AND checkIn <= dateTo |
| Anulowane | status = CANCELLED AND checkIn >= dateFrom AND checkIn <= dateTo |

### Dropdowny:
| Filtr | Dane z | Pierwsza opcja |
|-------|--------|----------------|
| Pokój | Room.number (property) | "Wszystkie" |
| Typ pokoju | RoomType.name | "Wszystkie" |
| Status | ReservationStatus enum | "Wszystkie" |
| Źródło | Reservation.source | "Wszystkie" |
| Segment | Reservation.marketSegment | "Wszystkie" |
| Kanał | Reservation.channel | "Wszystkie" |
| Wyżywienie | Reservation.mealPlan | "Wszystkie" |

### Szukaj gościa:
- Input z debounce 300ms
- Szuka po: Guest.name LIKE, Guest.email LIKE, Guest.phone LIKE

### Skróty dat:
Małe pill-buttons pod date pickerami: Dziś, Jutro, Ten tydzień, Ten miesiąc, Poprzedni miesiąc, Ten rok.

---

## KOLUMNY TABELI — pełna lista

| ID kolumny | Label | Pole DB | Domyślnie widoczna | Sortowalna |
|------------|-------|---------|-------------------|------------|
| lp | # | (numer na stronie) | ✅ | ❌ |
| id | ID rez. | Reservation.id | ✅ | ✅ |
| confirmation | Nr potw. | Reservation.confirmationNumber | ❌ | ✅ |
| guest | Gość | Guest.name | ✅ | ✅ |
| email | Email | Guest.email | ❌ | ✅ |
| phone | Telefon | Guest.phone | ❌ | ❌ |
| company | Firma | Company.name | ❌ | ✅ |
| companyNip | NIP | Company.nip | ❌ | ❌ |
| room | Pokój | Room.number | ✅ | ✅ |
| roomType | Typ | RoomType.name | ✅ | ✅ |
| checkIn | Check-in | Reservation.checkIn | ✅ | ✅ |
| checkOut | Check-out | Reservation.checkOut | ✅ | ✅ |
| nights | Noce | (checkOut - checkIn) | ✅ | ✅ |
| adults | Dorośli | Reservation.adults | ❌ | ✅ |
| children | Dzieci | Reservation.children | ❌ | ✅ |
| pax | Pax | (adults + children) | ❌ | ✅ |
| status | Status | Reservation.status | ✅ | ✅ |
| source | Źródło | Reservation.source | ❌ | ✅ |
| channel | Kanał | Reservation.channel | ❌ | ✅ |
| segment | Segment | Reservation.marketSegment | ❌ | ✅ |
| mealPlan | Wyżywienie | Reservation.mealPlan | ❌ | ✅ |
| price | Cena | sum(Transaction) | ✅ | ✅ |
| paid | Zapłacono | sum(payments) | ❌ | ✅ |
| remaining | Pozostało | (price - paid) | ❌ | ✅ |
| notes | Uwagi | Reservation.notes (50 zn.) | ❌ | ❌ |
| internalNotes | Uwagi wewn. | Reservation.internalNotes | ❌ | ❌ |
| country | Kraj | Guest.country | ❌ | ✅ |
| nationality | Narodowość | Guest.nationality | ❌ | ✅ |
| dob | Data ur. | Guest.dateOfBirth | ❌ | ✅ |
| gender | Płeć | Guest.gender | ❌ | ✅ |
| docNumber | Nr dok. | Guest.documentNumber | ❌ | ❌ |
| docType | Typ dok. | Guest.documentType | ❌ | ❌ |
| vip | VIP | Guest.isVip (⭐) | ❌ | ✅ |
| blacklist | Czarna lista | Guest.isBlacklisted (🚫) | ❌ | ✅ |
| rateCode | Rate code | RateCode.code | ❌ | ✅ |
| createdAt | Utworzono | Reservation.createdAt | ❌ | ✅ |

### Konfiguracja kolumn (dialog ⚙️):
- Checkboxy z dwukolumnowym layoutem
- [Zaznacz wszystkie] [Odznacz] [Domyślne]
- Checkbox "Zapamiętaj wybór" → zapis do localStorage klucz `logbook-columns`
- Domyślne kolumny: lp, id, guest, room, roomType, checkIn, checkOut, nights, status, price

---

## TOOLBAR — specyfikacja

- Lewa: "Znaleziono: X" + podsumowanie (Przyjazdy/Wyjazdy/In-house/No-show/Anul.)
- Prawa: [⚙️ Kolumny] [📥 CSV] [📥 Excel] [🖨️ Drukuj]
- Podsumowanie liczy się z WYFILTROWANYCH danych

---

## EKSPORT — specyfikacja

### CSV:
- Wszystkie wyfiltrowane rekordy (nie tylko strona)
- Kolumny = te widoczne w tabeli
- UTF-8 z BOM, separator `;`
- Nazwa: `ksiega-meldunkowa-YYYY-MM-DD.csv`

### Excel:
- Jak CSV ale `.xlsx`
- Użyj istniejącego `lib/export-excel.ts`

---

## DRUK — specyfikacja

Nagłówek: "KARCZMA ŁABĘDŹ — KSIĘGA MELDUNKOWA" + okres + filtry + data generowania.
Treść: tabela z widocznymi kolumnami.
Stopka: podsumowanie + numer strony.
Implementacja: `@media print` CSS ukrywające sidebar/filtry/toolbar. `window.print()`.

---

## TABELA — zachowania

- Klik nagłówek → sort ASC → ponownie DESC → ponownie brak. Ikonka ▲/▼.
- Domyślne sortowanie: checkIn DESC
- Paginacja server-side: 10/25/50/100 per stronę (domyślnie 25)
- Klik na wiersz → otwórz okno edycji rezerwacji (istniejący dialog)
- Hover → bg-gray-50
- Status → kolorowy Badge (CONFIRMED żółty, CHECKED_IN zielony, CHECKED_OUT szary, CANCELLED czerwony, NO_SHOW pomarańczowy)
- VIP → ⭐ przy nazwisku, Blacklist → 🚫 przy nazwisku
- Daty: DD.MM.YYYY (polski)
- Ceny: 1 234,50 PLN

---

## PLIKI DO UTWORZENIA

```
app/ksiega-meldunkowa/
├── page.tsx                     — SSR wrapper (session check, initial data)
├── ksiega-meldunkowa-client.tsx — główny komponent kliencki
├── filter-panel.tsx             — panel filtrów
├── columns-config.tsx           — dialog konfiguracji kolumn + hook useVisibleColumns
├── data-table.tsx               — tabela z sortowaniem i paginacją
├── toolbar.tsx                  — pasek narzędzi z podsumowaniem i przyciskami
├── export-utils.ts              — funkcje exportToCSV, exportToExcel
└── print-styles.css             — style @media print
```

### Modyfikacja istniejących:
- `app/actions/dashboard.ts` — dodaj `getLogbookData` server action
- `components/app-sidebar.tsx` — dodaj link (ikona BookOpen z lucide-react)

---

## SERVER ACTION `getLogbookData`

Lokalizacja: `app/actions/dashboard.ts`

```typescript
// Parametry
interface LogbookParams {
  propertyId: number;
  mode: 'all' | 'arrivals' | 'departures' | 'inhouse' | 'noshow' | 'cancelled';
  dateFrom: string;        // ISO
  dateTo: string;          // ISO
  roomId?: number;
  roomTypeId?: number;
  status?: string;
  source?: string;
  segment?: string;
  channel?: string;
  mealPlan?: string;
  guestSearch?: string;    // szuka w name/email/phone
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;           // 1-based
  pageSize?: number;
}

// Odpowiedź
interface LogbookResponse {
  data: LogbookEntry[];
  total: number;
  summary: {
    arrivals: number;
    departures: number;
    inhouse: number;
    noshow: number;
    cancelled: number;
  };
}

// Wpis
interface LogbookEntry {
  reservationId: number;
  confirmationNumber: string | null;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestCountry: string | null;
  guestNationality: string | null;
  guestDateOfBirth: string | null;
  guestGender: string | null;
  guestDocumentType: string | null;
  guestDocumentNumber: string | null;
  guestIsVip: boolean;
  guestIsBlacklisted: boolean;
  companyName: string | null;
  companyNip: string | null;
  roomNumber: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  status: string;
  source: string | null;
  channel: string | null;
  marketSegment: string | null;
  mealPlan: string | null;
  rateCode: string | null;
  totalPrice: number;
  totalPaid: number;
  remaining: number;
  notes: string | null;
  internalNotes: string | null;
  createdAt: string;
}
```# TASK 1: Server Action + Szkielet strony

> **Przeczytaj NAJPIERW** plik `SPEC-ksiega-meldunkowa.md` — tam jest pełna specyfikacja.
> W tym tasku robisz TYLKO to co opisane poniżej. Nic więcej.

---

## Co robisz w tym tasku (3 rzeczy):

### 1. Server Action `getLogbookData`

Otwórz `app/actions/dashboard.ts` i **na końcu pliku** dodaj:

- Interfejsy: `LogbookParams`, `LogbookResponse`, `LogbookEntry` — dokładnie jak w SPEC
- Funkcję `getLogbookData(params: LogbookParams): Promise<LogbookResponse>`

Logika query (Prisma) — warunki WHERE w zależności od `mode`:
- `'all'`: `checkIn <= dateTo AND checkOut >= dateFrom` (rezerwacje zachodzące na okres)
- `'arrivals'`: `checkIn >= dateFrom AND checkIn <= dateTo`
- `'departures'`: `checkOut >= dateFrom AND checkOut <= dateTo`
- `'inhouse'`: `status = 'CHECKED_IN' AND checkIn <= new Date() AND checkOut >= new Date()`
- `'noshow'`: `status = 'NO_SHOW' AND checkIn >= dateFrom AND checkIn <= dateTo`
- `'cancelled'`: `status = 'CANCELLED' AND checkIn >= dateFrom AND checkIn <= dateTo`

Dodatkowe filtry (każdy OPCJONALNY — dodaj do WHERE tylko jeśli wartość podana):
- `roomId` → `reservation.roomId = roomId`
- `roomTypeId` → `reservation.room.roomType.id = roomTypeId` (sprawdź jak wygląda relacja w schema.prisma — może być room.type)
- `status` → `reservation.status = status`
- `source` → `reservation.source = source`
- `segment` → `reservation.marketSegment = segment`
- `channel` → `reservation.channel = channel`
- `mealPlan` → `reservation.mealPlan = mealPlan`
- `guestSearch` → `OR: [{ guest.name CONTAINS search }, { guest.email CONTAINS search }, { guest.phone CONTAINS search }]`

Include: guest, room (+ roomType jeśli relacja), company, rateCode, transactions.

Obliczanie pól pochodnych:
- `nights` = różnica dni checkOut - checkIn
- `totalPrice` = suma transaction.amount WHERE status = 'ACTIVE'
- `totalPaid` = suma transaction.amount WHERE status = 'ACTIVE' AND paymentMethod IS NOT NULL
  **WAŻNE:** Sprawdź jak `settlement-tab.tsx` oblicza saldo — użyj TEJ SAMEJ logiki, nie wymyślaj nowej.
- `remaining` = totalPrice - totalPaid

Sortowanie: `orderBy: { [sortBy]: sortDir }` — domyślnie `checkIn: 'desc'`.
Paginacja: `skip: (page - 1) * pageSize`, `take: pageSize`.

Summary: osobny `groupBy` lub `count` na tych samych filtrach (bez paginacji):
- arrivals: count where checkIn = today
- departures: count where checkOut = today
- inhouse: count where status = CHECKED_IN
- noshow: count where status = NO_SHOW (w zakresie)
- cancelled: count where status = CANCELLED (w zakresie)

Uprawnienia: Na początku funkcji sprawdź sesję i uprawnienie. Jeśli `logbook.view` nie istnieje w permissions, dodaj je (INSERT do tabeli Permission, dodaj do MANAGER i OWNER w RolePermission). Jeśli nie chcesz dodawać teraz — użyj `reports.view`.

### 2. Strona `/ksiega-meldunkowa/page.tsx`

Utwórz `app/ksiega-meldunkowa/page.tsx`:

```tsx
// Server Component
// 1. Sprawdź sesję (getSession), redirect do /login jeśli brak
// 2. Pobierz propertyId (getEffectivePropertyId)
// 3. Pobierz listę pokoi (getRoomsForProperty lub getRooms) — do filtrów
// 4. Pobierz listę typów pokoi — do filtrów
// 5. Pobierz początkowe dane: getLogbookData z domyślnymi filtrami
//    (mode='all', dateFrom=pierwszy dzień miesiąca, dateTo=ostatni dzień miesiąca)
// 6. Renderuj <KsiegaMeldunkowaClient initialData={...} rooms={...} roomTypes={...} />
```

### 3. Szkielet `ksiega-meldunkowa-client.tsx`

Utwórz `app/ksiega-meldunkowa/ksiega-meldunkowa-client.tsx`:

```tsx
'use client';

// Stan:
// - filters (mode, dateFrom, dateTo, roomId, roomTypeId, status, source, segment, channel, mealPlan, guestSearch)
// - sortBy, sortDir
// - page, pageSize
// - data (z serwera)
// - isLoading (useTransition)

// Render (na razie PROSTY — detale w kolejnych taskach):
// - Nagłówek: "📖 Księga Meldunkowa"
// - Placeholder: "[Tu będą filtry]"
// - Placeholder: "[Tu będzie toolbar]"
// - PROSTA tabela z danymi (bez konfiguracji kolumn — to w TASK 3)
//   Kolumny na razie hardcoded: #, ID, Gość, Pokój, Typ, Check-in, Check-out, Noce, Status, Cena
// - Prosta paginacja: ◀ Strona X z Y ▶

// Funkcja fetchData():
// - wywołuje getLogbookData z aktualnymi filtrami
// - ustawia data i total w state
```

---

## Sidebar — dodaj link

W `components/app-sidebar.tsx` dodaj w odpowiedniej sekcji:
```tsx
{ title: "Księga meldunkowa", url: "/ksiega-meldunkowa", icon: BookOpen }
```
Import: `import { BookOpen } from 'lucide-react'`

---

## CHECKLIST — sprawdź ZANIM przejdziesz dalej

- [ ] `getLogbookData` istnieje w `app/actions/dashboard.ts`
- [ ] Funkcja przyjmuje WSZYSTKIE parametry z LogbookParams
- [ ] Funkcja zwraca data + total + summary
- [ ] Mode `'all'` zwraca rezerwacje overlapping z zakresem dat
- [ ] Mode `'arrivals'` filtruje po checkIn w zakresie
- [ ] Mode `'inhouse'` filtruje po status CHECKED_IN
- [ ] guestSearch szuka po name, email, phone (OR)
- [ ] Sortowanie działa (domyślnie checkIn DESC)
- [ ] Paginacja działa (skip/take)
- [ ] Strona `/ksiega-meldunkowa` istnieje i się ładuje bez błędów
- [ ] Prosta tabela wyświetla dane z DB (choćby 10 kolumn)
- [ ] Link w sidebarze działa i prowadzi do strony

**Jeśli cokolwiek z powyższej listy nie działa — napraw TERAZ zanim uznasz task za skończony.**
# TASK 2: Panel filtrów

> **Przeczytaj NAJPIERW** `SPEC-ksiega-meldunkowa.md` sekcja "FILTRY".
> Upewnij się że TASK 1 jest skończony (server action działa, strona się ładuje).

---

## Co robisz w tym tasku:

### Utwórz `app/ksiega-meldunkowa/filter-panel.tsx`

Komponent `FilterPanel` z props:
```tsx
interface FilterPanelProps {
  filters: LogbookFilters;
  onChange: (filters: LogbookFilters) => void;
  onSearch: () => void;
  onClear: () => void;
  rooms: { id: number; number: string }[];
  roomTypes: { id: number; name: string }[];
}
```

### Wewnątrz komponentu — od góry do dołu:

**Wiersz 1 — Tryb (radio buttons w jednej linii):**
```
Tryb:  (●) Wszystkie  (○) Przyjazdy  (○) Wyjazdy  (○) In-house  (○) No-show  (○) Anulowane
```
- Użyj shadcn/ui RadioGroup lub zwykłych `<input type="radio">`
- Flex row, gap-4
- Zmiana trybu → `onChange({ ...filters, mode: newMode })`

**Wiersz 2 — Zakres dat:**
- Dwa date pickery obok siebie: "Data od" i "Data do"
- Użyj istniejącego date pickera z projektu (sprawdź czy jest shadcn/ui Calendar/DatePicker albo inny)
- Jeśli nie ma — użyj `<input type="date">` z formatowaniem
- Domyślne: pierwszy i ostatni dzień bieżącego miesiąca

**Wiersz 3 — Skróty dat (pill buttons):**
```
[Dziś] [Jutro] [Ten tydzień] [Ten miesiąc] [Poprzedni miesiąc] [Ten rok]
```
- Małe przyciski: `text-xs border rounded-full px-2 py-0.5 hover:bg-gray-100`
- Klik → ustawia dateFrom i dateTo:
  - Dziś: today → today
  - Jutro: tomorrow → tomorrow
  - Ten tydzień: poniedziałek → niedziela bieżącego tygodnia
  - Ten miesiąc: 1. → ostatni dzień miesiąca
  - Poprzedni miesiąc: 1. → ostatni dzień poprzedniego miesiąca
  - Ten rok: 1 stycznia → 31 grudnia

**Wiersz 4-5 — Dropdowny (grid 3 kolumny na desktop, 1 na mobile):**

Każdy dropdown to shadcn/ui `<Select>`:
1. **Pokój** — opcje z props.rooms (`room.number`), pierwsza opcja "Wszystkie" (value="")
2. **Typ pokoju** — opcje z props.roomTypes (`roomType.name`), pierwsza "Wszystkie"
3. **Status** — opcje hardcoded: CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW + "Wszystkie"
4. **Źródło** — opcje hardcoded (sprawdź jakie wartości są w DB): PHONE, EMAIL, WALK_IN, BOOKING_COM, WEBSITE, AGENCY, OTA, inne + "Wszystkie"
5. **Segment** — opcje: BUSINESS, LEISURE, VIP, GROUP, EVENT + "Wszystkie"
6. **Kanał** — opcje: DIRECT, OTA, AGENCY, CORPORATE + "Wszystkie"
7. **Wyżywienie** — opcje: RO, BB, HB, FB, AI + "Wszystkie"

Labele nad każdym: `text-xs font-medium text-gray-500 mb-1`

**Wiersz 6 — Szukaj gościa:**
```
Szukaj gościa: [🔍 ___________________________________]
```
- shadcn/ui Input z ikoną Search (lucide-react)
- Placeholder: "Nazwisko, email lub telefon..."
- Pełna szerokość
- onChange z debounce 300ms → `onChange({ ...filters, guestSearch: value })`

**Wiersz 7 — Przyciski:**
```
[🔄 Szukaj]   [✕ Wyczyść filtry]                              [▲ Zwiń filtry]
```
- Szukaj: Button variant="default" (primary, niebieski). Klik → `onSearch()`
- Wyczyść: Button variant="ghost". Klik → `onClear()`
- Zwiń/Rozwiń: Button variant="ghost" po prawej (ml-auto). Toggle state `isCollapsed`

### Zwijanie panelu filtrów:
- Stan `isCollapsed` — domyślnie `false` (rozwinięte)
- Zapis do localStorage klucz `logbook-filters-collapsed`
- Gdy zwinięte: widoczny TYLKO wiersz z trybem (radio) + przycisk "▼ Rozwiń filtry"
- Animacja: CSS `max-height` transition lub `overflow-hidden` z height animation

### Styl:
- Cały panel: `bg-white border border-gray-200 rounded-lg p-4`
- Grid dropdownów: `grid grid-cols-3 gap-3` na desktop, `grid-cols-1` na mobile
- Responsive breakpoint: `md:grid-cols-3`

---

## Podłącz do `ksiega-meldunkowa-client.tsx`

Zamień placeholder `[Tu będą filtry]` na:
```tsx
<FilterPanel
  filters={filters}
  onChange={setFilters}
  onSearch={fetchData}
  onClear={handleClearFilters}
  rooms={rooms}
  roomTypes={roomTypes}
/>
```

`handleClearFilters`:
- Reset mode → 'all'
- Reset dateFrom/dateTo → bieżący miesiąc
- Reset wszystkie dropdowny → undefined/""
- Reset guestSearch → ""
- Wywołaj fetchData()

---

## CHECKLIST

- [ ] Panel filtrów renderuje się na stronie
- [ ] Radio buttons trybu: 6 opcji, działa przełączanie
- [ ] Date picker "Data od" i "Data do" działają
- [ ] Skróty dat: klik na "Dziś" ustawia obie daty na dziś
- [ ] Skróty dat: klik na "Ten miesiąc" ustawia zakres miesiąca
- [ ] Dropdown Pokój: pokazuje listę pokoi z DB
- [ ] Dropdown Typ pokoju: pokazuje typy z DB
- [ ] Dropdown Status: 5 opcji + Wszystkie
- [ ] Szukaj gościa: wpisanie tekstu filtruje (po kliknięciu Szukaj)
- [ ] Przycisk Szukaj: wywołuje getLogbookData z aktualnymi filtrami
- [ ] Przycisk Wyczyść: resetuje filtry i odświeża dane
- [ ] Zwijanie: klik na "Zwiń" chowa filtry, "Rozwiń" pokazuje
- [ ] Responsywność: 3 kolumny desktop, 1 kolumna mobile

**Napraw wszystko z listy ZANIM przejdziesz do TASK 3.**
# TASK 3: Tabela z konfigurowalnymi kolumnami + sortowanie + paginacja

> **Przeczytaj** `SPEC-ksiega-meldunkowa.md` sekcje "KOLUMNY TABELI" i "TABELA — zachowania".
> Upewnij się że TASK 1 i TASK 2 są skończone.

---

## Co robisz w tym tasku (3 rzeczy):

### 1. Utwórz `app/ksiega-meldunkowa/columns-config.tsx`

**A) Definicja kolumn — array `ALL_COLUMNS`:**

```tsx
interface ColumnDef {
  id: string;           // unikalny identyfikator
  label: string;        // wyświetlana nazwa
  defaultVisible: boolean;
  sortable: boolean;
  accessor: (entry: LogbookEntry) => React.ReactNode; // jak wyciągnąć wartość
  exportAccessor?: (entry: LogbookEntry) => string;   // wartość do eksportu CSV/Excel
}
```

Zdefiniuj WSZYSTKIE 33 kolumny z SPEC (sekcja "KOLUMNY TABELI"). Nie pomijaj żadnej.
Dla kolumn specjalnych:
- `status`: accessor zwraca kolorowy Badge (CONFIRMED→żółty, CHECKED_IN→zielony, CHECKED_OUT→szary, CANCELLED→czerwony, NO_SHOW→pomarańczowy). Użyj shadcn/ui Badge.
- `vip`: accessor zwraca ⭐ jeśli true, pusty string jeśli false
- `blacklist`: accessor zwraca 🚫 jeśli true
- `guest`: accessor zwraca `${entry.guestIsVip ? '⭐ ' : ''}${entry.guestIsBlacklisted ? '🚫 ' : ''}${entry.guestName}`
- `checkIn`, `checkOut`: format DD.MM.YYYY (`new Date(val).toLocaleDateString('pl-PL')`)
- `price`, `paid`, `remaining`: format `val.toLocaleString('pl-PL', { minimumFractionDigits: 2 })` + " PLN"
- `notes`, `internalNotes`: obetnij do 50 znaków + "..."

Domyślnie widoczne (10): lp, id, guest, room, roomType, checkIn, checkOut, nights, status, price.

**B) Hook `useVisibleColumns()`:**

```tsx
function useVisibleColumns() {
  // 1. Czytaj z localStorage klucz 'logbook-columns'
  // 2. Jeśli nie ma → użyj domyślnych (defaultVisible = true)
  // 3. Zwróć: visibleColumns, setVisibleColumns, resetToDefaults
  // 4. setVisibleColumns zapisuje do localStorage
}
```

**C) Dialog konfiguracji kolumn `ColumnsDialog`:**

Props: `{ open, onClose, visibleColumnIds, onApply, onReset }`

Layout dialogu:
```
┌─ Konfiguracja kolumn ──────────────────────┐
│                                              │
│  Dwukolumnowy grid checkboxów:               │
│  ☑ # (lp.)           ☑ ID rez.             │
│  ☐ Nr potwierdzenia  ☑ Gość               │
│  ☐ Email             ☐ Telefon             │
│  ... (WSZYSTKIE 33 kolumny)                  │
│                                              │
│  [Zaznacz wszystkie] [Odznacz] [Domyślne]   │
│                                              │
│          [Anuluj]  [Zastosuj]                │
└──────────────────────────────────────────────┘
```

- Shadcn/ui Dialog + Checkbox
- Grid: `grid grid-cols-2 gap-2`
- Przyciski: Zaznacz wszystkie, Odznacz wszystkie, Domyślne (reset)
- Anuluj zamyka bez zmian, Zastosuj zapisuje i zamyka

### 2. Utwórz `app/ksiega-meldunkowa/data-table.tsx`

Komponent `DataTable`:

Props:
```tsx
interface DataTableProps {
  data: LogbookEntry[];
  columns: ColumnDef[];        // tylko widoczne
  total: number;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (columnId: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRowClick: (reservationId: number) => void;
  isLoading: boolean;
}
```

**Nagłówki tabeli:**
- Klik na sortowalny nagłówek → wywołaj `onSort(columnId)`
- Logika w rodzicu (client.tsx): klik → jeśli ten sam column: toggle ASC/DESC. Jeśli inny: ASC.
- Ikonka przy aktywnym sortowaniu: ▲ (asc) lub ▼ (desc). Użyj ChevronUp/ChevronDown z lucide-react.
- Nagłówki niesortowalne: brak ikonki, brak cursor-pointer

**Wiersze:**
- Klik na wiersz → `onRowClick(entry.reservationId)` — otwiera okno edycji rezerwacji
- Hover: `hover:bg-gray-50`
- Cursor: `cursor-pointer`
- Loading: gdy `isLoading` → opacity-50 na tabeli + spinner

**Paginacja (na dole tabeli):**
```
◀ Strona 1 z 6 ▶                              Pokaż: [▼ 25] na stronę
```
- Lewa: przyciski ◀ (poprzednia) ▶ (następna) + "Strona X z Y"
- Disabled na pierwszej/ostatniej stronie
- Prawa: Select z opcjami 10, 25, 50, 100
- Zmiana pageSize → reset page do 1 → refetch
- Zapis pageSize do localStorage klucz `logbook-pageSize`

**Pusta tabela:**
- Jeśli data.length === 0: wyświetl "Brak wyników dla wybranych filtrów" w środku tabeli

**Styl tabeli:**
- Użyj shadcn/ui Table (z `components/ui/table`)
- Nagłówki: `bg-gray-50 text-xs uppercase tracking-wider`
- Sticky header: `sticky top-0 z-10` (w obrębie scrollowalnego kontenera)
- Tekst: `text-sm`
- Tabela w kontenerze z `overflow-x-auto` (scroll na mobile)

### 3. Podłącz w `ksiega-meldunkowa-client.tsx`

Zamień prostą tabelę z TASK 1 na:
```tsx
const { visibleColumns, setVisibleColumns, resetToDefaults } = useVisibleColumns();
const columns = ALL_COLUMNS.filter(c => visibleColumns.includes(c.id));

// ... w renderze:
<DataTable
  data={data}
  columns={columns}
  total={total}
  page={page}
  pageSize={pageSize}
  sortBy={sortBy}
  sortDir={sortDir}
  onSort={handleSort}
  onPageChange={setPage}
  onPageSizeChange={handlePageSizeChange}
  onRowClick={handleRowClick}
  isLoading={isLoading}
/>
```

`handleSort`:
```tsx
function handleSort(columnId: string) {
  if (sortBy === columnId) {
    setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
  } else {
    setSortBy(columnId);
    setSortDir('asc');
  }
  setPage(1);
  // fetchData w useEffect reagującym na sortBy/sortDir
}
```

`handleRowClick`:
```tsx
function handleRowClick(reservationId: number) {
  // Otwórz istniejący dialog edycji rezerwacji
  // Sprawdź jak to robi tape-chart — prawdopodobnie:
  // setSelectedReservationId(reservationId) + otwarcie dialogu
  // LUB router.push(`/front-office?reservation=${reservationId}`)
  // Użyj tego co już istnieje w projekcie.
}
```

---

## CHECKLIST

- [ ] `ALL_COLUMNS` zawiera WSZYSTKIE 33 kolumny ze SPEC
- [ ] Status wyświetla się jako kolorowy Badge
- [ ] VIP/Blacklist wyświetla się jako ikonka przy nazwisku
- [ ] Daty w formacie DD.MM.YYYY
- [ ] Ceny w formacie "1 234,50 PLN"
- [ ] Klik na nagłówek kolumny sortuje dane (server-side)
- [ ] Ikonka ▲/▼ przy aktywnej kolumnie sortowania
- [ ] Paginacja działa: ◀ ▶ zmienia stronę
- [ ] Dropdown "Pokaż: 25" zmienia rozmiar strony
- [ ] Klik na wiersz otwiera okno edycji rezerwacji
- [ ] Dialog kolumn otwiera się z przyciskiem ⚙️
- [ ] Checkboxy w dialogu działają (zaznaczanie/odznaczanie kolumn)
- [ ] "Zastosuj" w dialogu zmienia widoczne kolumny
- [ ] "Domyślne" resetuje do 10 domyślnych kolumn
- [ ] Wybór kolumn zapisuje się w localStorage
- [ ] Pusta tabela: komunikat "Brak wyników"
- [ ] Loading: tabela ma opacity-50 podczas ładowania

**Napraw wszystko ZANIM przejdziesz do TASK 4.**
# TASK 4: Toolbar + Eksport CSV/Excel + Druk

> **Przeczytaj** `SPEC-ksiega-meldunkowa.md` sekcje "TOOLBAR", "EKSPORT", "DRUK".
> Upewnij się że TASK 1-3 są skończone i działają poprawnie.

---

## Co robisz w tym tasku (3 rzeczy):

### 1. Utwórz `app/ksiega-meldunkowa/toolbar.tsx`

Komponent `Toolbar`:

```tsx
interface ToolbarProps {
  total: number;
  summary: {
    arrivals: number;
    departures: number;
    inhouse: number;
    noshow: number;
    cancelled: number;
  };
  onColumnsClick: () => void;
  onExportCSV: () => void;
  onExportExcel: () => void;
  onPrint: () => void;
  isExporting: boolean;  // disable przyciski podczas eksportu
}
```

Layout:
```
┌────────────────────────────────────────────────────────────────────────────┐
│  Znaleziono: 147                                                           │
│  Przyjazdy: 12 │ Wyjazdy: 8 │ In-house: 45 │ No-show: 2 │ Anul.: 3      │
│                                         [⚙️ Kolumny] [CSV] [Excel] [🖨️]  │
└────────────────────────────────────────────────────────────────────────────┘
```

- Tło: `bg-gray-50 border border-gray-200 rounded-lg p-3`
- Flex row z justify-between
- Lewa strona:
  - "Znaleziono: **147**" — bold na liczbie
  - Pod tym: podsumowanie w jednej linii, rozdzielone ` │ `
  - Każdy element podsumowania: `text-sm text-gray-600`
- Prawa strona: 4 przyciski w row:
  - ⚙️ Kolumny — `Button variant="outline" size="sm"`, ikona `Settings` z lucide
  - 📥 CSV — `Button variant="outline" size="sm"`, ikona `Download`
  - 📥 Excel — `Button variant="outline" size="sm"`, ikona `FileSpreadsheet`
  - 🖨️ Drukuj — `Button variant="outline" size="sm"`, ikona `Printer`
  - Podczas eksportu: `disabled={isExporting}` + spinner na aktywnym przycisku

### 2. Utwórz `app/ksiega-meldunkowa/export-utils.ts`

**Funkcja `exportToCSV`:**

```tsx
export function exportToCSV(
  data: LogbookEntry[],
  columns: ColumnDef[],  // widoczne kolumny
  filename: string
): void {
  // 1. BOM na początku: '\uFEFF'
  // 2. Separator: ';' (standard PL dla Excela)
  // 3. Nagłówek: columns.map(c => c.label).join(';')
  // 4. Wiersze: data.map(row => columns.map(c =>
  //      c.exportAccessor ? c.exportAccessor(row) : String(c.accessor(row) ?? '')
  //    ).join(';'))
  // 5. Escapowanie: jeśli wartość zawiera ; lub " lub \n → otoczyć cudzysłowami
  // 6. Trigger download:
  //    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8' });
  //    const url = URL.createObjectURL(blob);
  //    const a = document.createElement('a');
  //    a.href = url; a.download = filename; a.click();
  //    URL.revokeObjectURL(url);
}
```

**Funkcja `exportToExcel`:**

```tsx
export async function exportToExcel(
  data: LogbookEntry[],
  columns: ColumnDef[],
  filename: string
): Promise<void> {
  // Użyj istniejącego lib/export-excel.ts
  // Sprawdź jak ten plik działa — prawdopodobnie używa biblioteki 'xlsx'
  // Jeśli export-excel.ts ma helper np. exportToXlsx(data, headers) → użyj go
  // Jeśli nie — zbuduj sam:
  //   import * as XLSX from 'xlsx';
  //   const ws = XLSX.utils.json_to_sheet(rows);
  //   const wb = XLSX.utils.book_new();
  //   XLSX.utils.book_append_sheet(wb, ws, 'Księga meldunkowa');
  //   XLSX.writeFile(wb, filename);
}
```

**WAŻNE dla obu eksportów:**
- Eksportuj WSZYSTKIE wyfiltrowane rekordy — nie tylko aktualną stronę
- Musisz wywołać `getLogbookData` z pageSize = 99999 (lub bez paginacji)
- Zrób to w handleExport w client.tsx:
  1. Ustaw isExporting = true
  2. Wywołaj getLogbookData z tymi samymi filtrami ALE page=1, pageSize=99999
  3. Przekaż wynik do exportToCSV / exportToExcel
  4. Ustaw isExporting = false
- Nazwy plików: `ksiega-meldunkowa-YYYY-MM-DD.csv` / `.xlsx`

### 3. Druk (`@media print` CSS + logika)

**Utwórz `app/ksiega-meldunkowa/print-styles.css`:**

```css
@media print {
  /* Ukryj wszystko co nie jest treścią */
  nav, aside,
  [data-sidebar],
  .app-sidebar,
  [data-logbook-filters],
  [data-logbook-toolbar],
  [data-logbook-pagination] {
    display: none !important;
  }

  /* Pokaż nagłówek druku */
  [data-print-header] {
    display: block !important;
  }

  /* Tabela na pełną szerokość */
  [data-logbook-table] {
    width: 100% !important;
    font-size: 10pt !important;
  }

  /* Usuń tło, bordery zaokrąglone */
  * {
    box-shadow: none !important;
    border-radius: 0 !important;
  }

  /* Nagłówki na każdej stronie */
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }

  /* Strony */
  @page {
    margin: 1cm;
    size: A4 landscape;
  }
}
```

**Nagłówek druku (ukryty normalnie, widoczny przy print):**

Dodaj w `ksiega-meldunkowa-client.tsx`:
```tsx
{/* Nagłówek druku — ukryty normalnie */}
<div data-print-header className="hidden print:block mb-4">
  <h1 className="text-lg font-bold">KARCZMA ŁABĘDŹ — KSIĘGA MELDUNKOWA</h1>
  <p className="text-sm">
    Okres: {formatDate(filters.dateFrom)} — {formatDate(filters.dateTo)}
    {' | '}Tryb: {filters.mode}
    {filters.roomId && ` | Pokój: ${roomName}`}
  </p>
  <p className="text-xs text-gray-500">
    Wygenerowano: {new Date().toLocaleString('pl-PL')}
  </p>
</div>
```

**Obsługa przycisku Drukuj:**
```tsx
function handlePrint() {
  window.print();
}
```

**Dodaj atrybuty data-* do komponentów:**
- Panel filtrów: `data-logbook-filters`
- Toolbar: `data-logbook-toolbar`
- Tabela: `data-logbook-table`
- Paginacja: `data-logbook-pagination`
- Print header: `data-print-header`

**Importuj print-styles.css** w `ksiega-meldunkowa-client.tsx`:
```tsx
import './print-styles.css';
```

---

## Podłącz toolbar w `ksiega-meldunkowa-client.tsx`

Zamień placeholder `[Tu będzie toolbar]` na:
```tsx
<Toolbar
  total={total}
  summary={summary}
  onColumnsClick={() => setColumnsDialogOpen(true)}
  onExportCSV={handleExportCSV}
  onExportExcel={handleExportExcel}
  onPrint={handlePrint}
  isExporting={isExporting}
/>
```

---

## CHECKLIST

- [ ] Toolbar wyświetla "Znaleziono: X" z poprawną liczbą
- [ ] Toolbar wyświetla podsumowanie (Przyjazdy/Wyjazdy/In-house/No-show/Anul.)
- [ ] Podsumowanie zmienia się po zastosowaniu filtrów
- [ ] Przycisk ⚙️ Kolumny otwiera dialog z TASK 3
- [ ] Przycisk CSV pobiera plik `.csv`
- [ ] Plik CSV: ma BOM, separator `;`, polskie znaki działają w Excelu
- [ ] CSV zawiera WSZYSTKIE wyfiltrowane rekordy (nie tylko aktualną stronę)
- [ ] CSV zawiera TYLKO widoczne kolumny
- [ ] Przycisk Excel pobiera plik `.xlsx`
- [ ] Excel zawiera te same dane co CSV
- [ ] Przyciski CSV/Excel disabled podczas eksportu (isExporting)
- [ ] Przycisk 🖨️ Drukuj otwiera podgląd wydruku
- [ ] Na wydruku: brak sidebara, brak filtrów, brak toolbara
- [ ] Na wydruku: widoczny nagłówek "KARCZMA ŁABĘDŹ — KSIĘGA MELDUNKOWA"
- [ ] Na wydruku: widoczny okres, tryb, aktywne filtry
- [ ] Na wydruku: tabela z danymi czytelna
- [ ] Na wydruku: format A4 landscape

**Napraw wszystko ZANIM uznasz moduł za skończony.**
# TASK 5: Polerowanie + Testy + Weryfikacja końcowa

> Ten task jest OBOWIĄZKOWY. Nie pomijaj go — tutaj łapiemy błędy z TASK 1-4.

---

## Co robisz w tym tasku:

### 1. Responsywność

Przetestuj i napraw layout na 3 rozmiarach:

**Desktop (>1024px):**
- Filtry: grid 3 kolumny
- Tabela: pełna, bez scroll
- Toolbar: jedna linia

**Tablet (768-1024px):**
- Filtry: grid 2 kolumny
- Tabela: `overflow-x-auto` (scroll horyzontalny)
- Toolbar: może się zawijać na 2 linie

**Mobile (<768px):**
- Filtry: grid 1 kolumna
- Tabela: scroll horyzontalny
- Toolbar: przyciski w dropdown `[⋯ Więcej]` zamiast 4 osobnych
- Paginacja: kompaktowa (tylko ◀ ▶ bez "Strona X z Y")

Sprawdź:
- [ ] Desktop layout OK
- [ ] Tablet layout OK
- [ ] Mobile layout OK
- [ ] Tabela scroll działa na mobile
- [ ] Przyciski toolbar nie wychodzą poza ekran na mobile

### 2. Edge cases

Przetestuj i obsłuż:

**Brak danych:**
- [ ] Puste filtry (brak rezerwacji w okresie) → komunikat "Brak wyników" w tabeli
- [ ] Podsumowanie pokazuje 0/0/0/0/0
- [ ] Eksport pustych danych → plik tylko z nagłówkami (nie error)

**Dużo danych:**
- [ ] 500+ rekordów → paginacja działa, nie lag
- [ ] Eksport 500+ → plik się pobiera (może chwilę)
- [ ] Sorting na 500+ → odświeża w <2s

**Brakujące dane w rekordach:**
- [ ] Rezerwacja bez gościa (guest = null) → nie crashuje, wyświetla "-"
- [ ] Rezerwacja bez pokoju (room = null) → nie crashuje
- [ ] Brak transakcji → cena = 0,00 PLN (nie NaN, nie undefined)
- [ ] Guest bez email/phone → puste pole, nie "null"

**Uprawnienia:**
- [ ] Użytkownik bez uprawnień → redirect lub komunikat "Brak dostępu"
- [ ] Test: zaloguj się jako RECEPTION, MANAGER, OWNER — strona działa

### 3. Integracja z resztą systemu

**Klik na wiersz:**
- [ ] Otwiera okno edycji rezerwacji
- [ ] Po zamknięciu okna → dane w tabeli się odświeżają (refetch)
- [ ] Jeśli dialog nie istnieje standalone → użyj `router.push('/front-office?reservation=ID')`

**Sidebar:**
- [ ] Link "Księga meldunkowa" jest w sidebar
- [ ] Ikona BookOpen widoczna
- [ ] Active state: link podświetlony gdy jesteśmy na `/ksiega-meldunkowa`

### 4. Wydajność

- [ ] Pierwsza ładowanie strony < 2s
- [ ] Zmiana filtrów + Szukaj < 1s
- [ ] Zmiana strony (paginacja) < 0.5s
- [ ] Jeśli wolno → sprawdź czy query Prisma nie robi N+1 (użyj `include` zamiast osobnych query)
- [ ] Dodaj `select` do Prisma query — pobieraj TYLKO potrzebne pola, nie cały Guest/Room/Transaction

### 5. Finalna weryfikacja — przejdź przez PEŁNĄ checklistę

Skopiuj poniższą listę i oznacz KAŻDY punkt ✅ lub ❌:

```
STRONA:
[ ] /ksiega-meldunkowa się ładuje
[ ] Link w sidebar działa
[ ] Tytuł "📖 Księga Meldunkowa" widoczny

FILTRY:
[ ] Tryb: 6 radio buttons działa
[ ] Data od/do: date pickery działają
[ ] Skróty: Dziś ustawia dziś-dziś
[ ] Skróty: Ten miesiąc ustawia zakres
[ ] Skróty: Poprzedni miesiąc ustawia zakres
[ ] Dropdown Pokój: lista z DB
[ ] Dropdown Typ pokoju: lista z DB
[ ] Dropdown Status: 5 opcji + Wszystkie
[ ] Dropdown Źródło: opcje + Wszystkie
[ ] Dropdown Segment: opcje + Wszystkie
[ ] Dropdown Kanał: opcje + Wszystkie
[ ] Dropdown Wyżywienie: opcje + Wszystkie
[ ] Szukaj gościa: filtruje po nazwisku
[ ] Szukaj gościa: filtruje po emailu
[ ] Szukaj gościa: filtruje po telefonie
[ ] Przycisk Szukaj: odświeża dane
[ ] Przycisk Wyczyść: resetuje wszystko
[ ] Zwijanie filtrów: działa (zapisuje do localStorage)

TABELA:
[ ] 33 kolumny zdefiniowane w ALL_COLUMNS
[ ] Domyślnie widoczne: 10 kolumn
[ ] Status: kolorowy Badge
[ ] VIP: ⭐ przy nazwisku
[ ] Blacklist: 🚫 przy nazwisku
[ ] Daty: format DD.MM.YYYY
[ ] Ceny: format "1 234,50 PLN"
[ ] Uwagi: obcięte do 50 znaków
[ ] Sortowanie: klik na nagłówek
[ ] Sortowanie: ikonka ▲/▼
[ ] Sortowanie: domyślnie checkIn DESC
[ ] Paginacja: ◀ ▶ działa
[ ] Paginacja: dropdown 10/25/50/100
[ ] Paginacja: zmiana pageSize resetuje do strony 1
[ ] Klik na wiersz: otwiera edycję rezerwacji
[ ] Hover: podświetlenie wiersza
[ ] Pusta tabela: "Brak wyników"

KOLUMNY:
[ ] Przycisk ⚙️ otwiera dialog
[ ] Dialog: checkboxy dla 33 kolumn
[ ] "Zaznacz wszystkie" działa
[ ] "Odznacz" działa
[ ] "Domyślne" resetuje do 10
[ ] "Zastosuj" zmienia widoczne kolumny
[ ] Zapis do localStorage

TOOLBAR:
[ ] "Znaleziono: X" poprawna liczba
[ ] Podsumowanie: Przyjazdy/Wyjazdy/In-house/No-show/Anul.
[ ] Podsumowanie zmienia się po filtrach

EKSPORT:
[ ] CSV: plik się pobiera
[ ] CSV: UTF-8 BOM + separator ';'
[ ] CSV: polskie znaki działają w Excelu
[ ] CSV: WSZYSTKIE wyfiltrowane rekordy
[ ] CSV: TYLKO widoczne kolumny
[ ] Excel: plik się pobiera
[ ] Excel: dane poprawne
[ ] Disabled podczas eksportu

DRUK:
[ ] Przycisk 🖨️ otwiera druk
[ ] Brak sidebar na wydruku
[ ] Brak filtrów na wydruku
[ ] Nagłówek: nazwa hotelu
[ ] Nagłówek: okres + filtry
[ ] Tabela czytelna

RESPONSYWNOŚĆ:
[ ] Desktop: 3-col filtry
[ ] Tablet: 2-col + scroll tabeli
[ ] Mobile: 1-col + scroll tabeli

NIE ZEPSUTE:
[ ] Dashboard nadal działa
[ ] TapeChart nadal działa
[ ] Inne strony nadal działają
```

**Dla każdego ❌ — napraw TERAZ. Nie kończ tasku z jakimkolwiek ❌.**

---

## Jeśli WSZYSTKO ✅ — Księga Meldunkowa jest gotowa! 🎉