# Specyfikacja techniczna: Raport KT-1 (GUS) — Sprawozdanie o wykorzystaniu turystycznego obiektu noclegowego

**Wersja:** 1.0  
**Data:** 2026-03-15  
**Kontekst:** HotelSystem (Next.js 14, Prisma, MySQL) — hotel.karczma-labedz.pl

---

## Spis treści

1. [Podsumowanie analizy repozytorium](#a-podsumowanie-analizy-repozytorium)
2. [Zmiany w schemacie bazy danych](#b-zmiany-w-schemacie-bazy-danych)
3. [API: GET /api/reports/kt1](#c-api-endpoint-get-apireportskt1)
4. [Strona UI: /reports/kt1](#d-strona-ui-reportskt1)
5. [Generowanie PDF](#e-generowanie-pdf)
6. [Nawigacja](#f-nawigacja)
7. [Dane stałe Karczmy Łabędź](#g-dane-stałe-karczmy-łabędź)
8. [Edge cases i failure modes](#h-edge-cases-i-failure-modes)

---

## A. Podsumowanie analizy repozytorium

### Modele Prisma używane w raporcie KT-1

| Model | Kluczowe pola | Uwagi |
|-------|----------------|--------|
| **Reservation** | `id`, `guestId`, `roomId`, `checkIn`, `checkOut`, `status`, `pax` | `checkIn`/`checkOut` — `@db.Date`; konwencja: checkOut = ostatni dzień pobytu + 1 (ARCHITECTURE.md). Dla KT-1 liczymy tylko rezerwacje ze statusem `CHECKED_IN` lub `CHECKED_OUT` (gość faktycznie nocował). |
| **Guest** | `id`, `name`, `country`, `nationality` | `country` (String?) — kraj zamieszkania (kod ISO, np. PL, DE). `nationality` (String?) — obywatelstwo. Dla KT-1 „turysta zagraniczny” = kraj stałego zamieszkania ≠ Polska — **używamy `Guest.country`**; brak/empty traktujemy jako PL. |
| **Room** | `id`, `number`, `beds`, `maxOccupancy`, `isDeleted` | Jedna rezerwacja = jeden pokój (`Reservation.roomId`). Pokoje z `isDeleted: true` nie wliczamy do nominalnej liczby. |
| **HotelConfig** | `id`, `name`, `address`, `postalCode`, `city`, `email`, `phone`, `website` | Obecnie **brak**: REGON, województwo, powiat, gmina, rodzaj obiektu, kategoria, całoroczny, nominalna liczba miejsc/pokoi — te dane muszą być w **GusConfig** (patrz sekcja B). |

### Enum ReservationStatus (fragment schema.prisma)

```prisma
enum ReservationStatus {
  PENDING
  CONFIRMED
  CHECKED_IN   // gość zameldowany
  CHECKED_OUT  // gość wymeldowany (nocował)
  CANCELLED
  NO_SHOW
}
```

Dla KT-1 uznajemy tylko rezerwacje **zrealizowane** = `status IN ('CHECKED_IN', 'CHECKED_OUT')`.

### Istniejące wzorce kodu

- **API routes:** `app/api/` (App Router). Przykłady: `app/api/reports/gus/route.ts`, `app/api/reports/police/route.ts`.
- **Autoryzacja:** `getSession()` z `@/lib/auth`; uprawnienia: `can(session.role, "reports.official")` z `@/lib/permissions`. Brak sesji → 401, brak uprawnienia → 403.
- **Raporty prawne:** logika w `app/actions/reports-legal.ts` — `getGusReport(dateFrom, dateTo)` (obecnie zwraca uproszczony raport CSV: room-nights, person-nights, wiersze per dzień). **Nie** zwraca unikalnych gości ani podziału na kraj.
- **PDF:** `lib/invoice-html.ts` — `generatePdfFromHtml(html: string): Promise<Buffer>`. Używa Puppeteer, `PUPPETEER_EXECUTABLE_PATH` lub `/usr/bin/chromium-browser`, `page.setContent(html)` + `page.pdf()`.
- **UI raportów:** `app/reports/page.tsx` → `ReportsPageClient` w `app/reports/reports-page-client.tsx`. Sekcja „Raporty urzędowe” (uprawnienie `reports.official`): GUS CSV (od–do), raport policyjny (data). Komponenty: shadcn (Label, Input, Button, Card), ikona FileText.

### Luki w danych i propozycje

| Luka | Rozwiązanie |
|------|-------------|
| Brak danych GUS w HotelConfig | Nowy model **GusConfig** (jedna rekord na obiekt) — REGON, województwo, powiat, gmina, rodzaj obiektu, kategoria, całoroczny, nominalna liczba miejsc i pokoi. |
| Gość bez kraju | Traktować `Guest.country` null/empty jako Polska (PL) — wliczany do „ogółem” i do „kraj: Polska” w Dziale 5. |
| Rezerwacja bez pax | Użyć `Reservation.pax ?? 1` przy liczeniu osobonoce i gości (spójnie z `getGusReport`). |

---

## B. Zmiany w schemacie bazy danych

### Nowy model GusConfig

Przechowuje **dane stałe** do formularza KT-1 (Dział 1 i stałe wartości Działu 4). Singleton — jedna rekord na obiekt (`id = 1`).

```prisma
model GusConfig {
  id                    Int      @id @default(1)
  objectName            String
  address               String?
  postalCode            String?
  city                  String?
  gmina                 String?
  powiat                String?
  voivodeship           String?
  regon                 String?
  objectType            Int      @default(1)
  category              Int      @default(3)
  isYearRound           Boolean  @default(true)
  nominalPlaces         Int      @default(70)
  nominalRooms          Int      @default(28)
  email                 String?
  updatedAt             DateTime @updatedAt

  @@map("gus_config")
}
```

- **Migracja:** po dodaniu modelu wykonać `npx prisma db push` (projekt używa db push, nie migrate).
- **Odczyt w kodzie:** `prisma.gusConfig.findUnique({ where: { id: 1 } })`.
- **Seed:** wstawić jeden rekord z danymi Karczmy Łabędź (sekcja G), np. w `prisma/seed.ts` lub ręcznie przez UI ustawień.

### Brak zmian w modelu Guest

Pola `Guest.country` i `Guest.nationality` już istnieją — wystarczające do Działu 5 (kraj stałego zamieszkania = `country`).

---

## C. API Endpoint: GET /api/reports/kt1

### Ścieżka i parametry

- **URL:** `GET /api/reports/kt1?month=1&year=2026`
- **Query params:**
  - `month` (wymagany): 1–12
  - `year` (wymagany): np. 2026 (liczba lub string parsowalna do liczby)
- **Autoryzacja:** jak `app/api/reports/gus/route.ts` — sesja + `can(session.role, "reports.official")`. 401 bez sesji, 403 bez uprawnienia.
- **Response:** `200` — JSON z pełnym obiektem danych KT-1; `400` — błąd walidacji (np. brak month/year, month poza 1–12); `404` — brak GusConfig; `500` — błąd serwera.

### Logika zapytań Prisma

**1. Zakres dat miesiąca (UTC):**

- `monthStart = new Date(Date.UTC(year, month - 1, 1))` — pierwszy dzień miesiąca 00:00:00 UTC
- `nextMonthStart = new Date(Date.UTC(year, month, 1))` — pierwszy dzień **następnego** miesiąca (koniec zakresu exclusive)
- Konwencja: `checkOut` = dzień po ostatniej nocy (ARCHITECTURE.md), więc rezerwacja ma noce w miesiącu, gdy `checkIn < nextMonthStart && checkOut > monthStart`.

**2. Pobranie rezerwacji:**

- Rezerwacje **zrealizowane** (gość nocował): `status IN ['CHECKED_IN', 'CHECKED_OUT']`.
- Przecinające się z miesiącem: `checkIn < nextMonthStart && checkOut > monthStart`.

Przykładowe zapytanie (nazwy pól z schema.prisma):

```ts
const monthStart = new Date(Date.UTC(year, month - 1, 1));
const nextMonthStart = new Date(Date.UTC(year, month, 1));

const reservations = await prisma.reservation.findMany({
  where: {
    status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
    checkIn: { lt: nextMonthStart },
    checkOut: { gt: monthStart },
  },
  include: {
    guest: { select: { id: true, country: true } },
    room: { select: { id: true } },
  },
});
```

**3. Liczenie wskaźników (w pamięci po pobraniu rezerwacji):**

Pomocniczo: `isForeign(guest)` = `guest.country != null && guest.country.trim().toUpperCase() !== 'PL'`.

- **Poz. 1 — Liczba dni działalności:** dla obiektu całorocznego = liczba dni w miesiącu (np. 31). Czyli `daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()`. Jeśli kiedyś obsługa sezonowa: z GusConfig lub kalendarza.

- **Poz. 4 — Liczba osób korzystających z noclegów (ogółem i zagraniczni):**  
  GUS liczy **liczbę osób** (pax), a nie unikalne osoby kontaktowe. Jedna rezerwacja = `pax` osób. Filtr SQL zwraca tylko rezerwacje mające co najmniej jedną noc w miesiącu — nie trzeba iterować po dniach ani sprawdzać zakresu.

```
guestsTotal = 0
guestsForeign = 0

for each reservation:
  pax = reservation.pax ?? 1
  guestsTotal += pax
  if isForeign(reservation.guest):
    guestsForeign += pax
```

- **Poz. 5 — Udzielone noclegi (osobonoce) i Poz. 6 — Liczba wynajętych pokoi (pokojo-dni):**  
  Używamy arytmetyki dat; `checkOut` jest exclusive (dzień po ostatniej nocy), więc liczba nocy = różnica między datami początku i końca okresu (exclusive end).

```
effectiveStart = max(checkIn, monthStart)
effectiveEnd = min(checkOut, nextMonthStart)   // checkOut już jest „dzień po ostatniej nocy”
nightsInMonth = (effectiveEnd.getTime() - effectiveStart.getTime()) / MS_PER_DAY   // liczba pełnych dni = liczba nocy
```

Stała: `const MS_PER_DAY = 24 * 60 * 60 * 1000`.

Dla każdej rezerwacji:
- `personNightsTotal += nightsInMonth * (pax ?? 1)`
- `roomNightsTotal += nightsInMonth`
- jeśli `isForeign(reservation.guest)`: `personNightsForeign += nightsInMonth * (pax ?? 1)`, `roomNightsForeign += nightsInMonth`

**4. Dział 5 — Turyści zagraniczni według kraju:**

- Dla każdej rezerwacji z gościem zagranicznym: kraj = znormalizowany kod (`guest.country.toUpperCase().trim()`). Jeśli kod nie występuje na liście KT1_COUNTRIES (poza "OTHER"), wliczamy do wiersza "Pozostałe kraje" (kod `OTHER`).
- Per kraj sumujemy: liczbę osób (dla tej rezerwacji `pax ?? 1` — rezerwacja ma noc w miesiącu, więc dodajemy raz przy budowaniu section5) oraz osobonoce i ewentualnie pokojo-dni według potrzeb tabeli. Wiersz "Ogółem" na górze = suma wszystkich zagranicznych.
- Lista krajów: stała **KT1_COUNTRIES**:

```ts
export const KT1_COUNTRIES: { code: string; label: string }[] = [
  { code: "DE", label: "Niemcy" },
  { code: "GB", label: "Wielka Brytania" },
  { code: "RU", label: "Rosja" },
  { code: "UA", label: "Ukraina" },
  { code: "BY", label: "Białoruś" },
  { code: "LT", label: "Litwa" },
  { code: "CZ", label: "Czechy" },
  { code: "FR", label: "Francja" },
  { code: "IT", label: "Włochy" },
  { code: "NL", label: "Holandia" },
  { code: "ES", label: "Hiszpania" },
  { code: "SE", label: "Szwecja" },
  { code: "DK", label: "Dania" },
  { code: "NO", label: "Norwegia" },
  { code: "US", label: "USA" },
  { code: "IL", label: "Izrael" },
  { code: "JP", label: "Japonia" },
  { code: "OTHER", label: "Pozostałe kraje" },
];
```

Goście z krajem spoza tej listy (i nie PL) trafiają do wiersza „Pozostałe kraje”. Wiersz „Ogółem” na górze = suma wszystkich zagranicznych.

### Struktura odpowiedzi JSON (TypeScript)

```ts
interface Kt1ReportResponse {
  // Dział 1 (z GusConfig)
  section1: {
    objectName: string;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    gmina: string | null;
    powiat: string | null;
    voivodeship: string | null;
    regon: string | null;
    objectType: number;
    category: number;
    isYearRound: boolean;
    email: string | null;
  };
  // Dział 3 — tylko w lipcu, null w pozostałych miesiącach (forward-compatible)
  section3: {
    totalRooms: number;
    totalPlaces: number;
    roomsWithBathroom: number;
    roomsAccessible: number;
    placesYearRound: number;
    placesSeasonal: number;
  } | null;
  // Dział 4
  section4: {
    daysActive: number;           // poz. 1
    nominalPlaces: number;       // poz. 2
    nominalRooms: number;        // poz. 3
    guestsTotal: number;         // poz. 4 ogółem
    guestsForeign: number;       // poz. 4 w tym zagraniczni
    personNightsTotal: number;   // poz. 5 ogółem
    personNightsForeign: number; // poz. 5 zagraniczni
    roomNightsTotal: number;     // poz. 6 ogółem
    roomNightsForeign: number;  // poz. 6 zagraniczni
  };
  // Dział 5 — wiersze tabeli (kraj, turyści, noclegi); pierwszy wiersz = "Ogółem"
  section5: Array<{
    countryCode: string;         // "OGOŁEM" lub kod ISO
    countryLabel: string;         // etykieta do wyświetlenia
    guests: number;
    personNights: number;
  }>;
  meta: {
    month: number;
    year: number;
    generatedAt: string;         // ISO 8601
  };
}
```

Na start: `section3: null` dla każdego miesiąca. W przyszłości: wypełniane gdy `month === 7`.

### Uwagi implementacyjne (timezone i daty)

**WAŻNE:** Pola `checkIn` i `checkOut` to `@db.Date` — Prisma zwraca je jako `Date` z godziną 00:00 UTC. Wszystkie porównania dat muszą być w UTC. Przy obliczaniu `monthStart` i `nextMonthStart` używaj **`Date.UTC()`**, nie `new Date(year, month - 1, 1)` (który używa lokalnego timezone serwera).

```ts
const monthStart = new Date(Date.UTC(year, month - 1, 1));
const nextMonthStart = new Date(Date.UTC(year, month, 1));
```

Filtr Prisma:
- `checkIn: { lt: nextMonthStart }` — rezerwacja zaczyna się przed końcem miesiąca
- `checkOut: { gt: monthStart }` — rezerwacja kończy się po początku miesiąca

W obliczeniach `nightsInMonth`:
- `effectiveStart = max(checkIn, monthStart)`
- `effectiveEnd = min(checkOut, nextMonthStart)` — `checkOut` jest exclusive (dzień po ostatniej nocy)
- `nightsInMonth = Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / MS_PER_DAY)`

### Pliki do zmiany / utworzenia

- **Nowy plik:** `app/api/reports/kt1/route.ts` — GET, walidacja `month`/`year`, wywołanie logiki KT-1 (np. z `app/actions/reports-legal.ts` lub osobnego modułu `lib/kt1-report.ts`), zwrot JSON.
- **Logika:** albo rozszerzenie `app/actions/reports-legal.ts` o `getKt1Report(month: number, year: number)`, albo osobny plik `lib/kt1-report.ts` z funkcją `getKt1Report(month, year)` zwracającą powyższą strukturę (wymaga Prisma + odczytu GusConfig).

---

## D. Strona UI: /reports/kt1

### Ścieżka

- **Route:** `app/reports/kt1/page.tsx`. Ścieżka **`/reports/kt1`** — spójna z istniejącym `/reports`. Link w menu jak w sekcji F.
- **Layout:** strona wewnętrzna systemu (z sidebar), ten sam układ co np. `/reports` — nagłówek, biały/czysty styl (shadcn, bg-card).

### Elementy strony

1. **Nagłówek:** np. „Raport KT-1 (GUS)” + krótki opis (Sprawozdanie o wykorzystaniu turystycznego obiektu noclegowego).
2. **Selektor miesiąca/roku:**  
   - `month`: select 1–12 (nazwy miesięcy po polsku) lub dwa osobne selecty (miesiąc, rok).  
   - `year`: input number lub select (np. bieżący rok ± 2).  
   - Po zmianie miesiąca/roku — pobranie danych `GET /api/reports/kt1?month=...&year=...` i wyświetlenie podglądu.
3. **Podgląd danych** w układzie zbliżonym do formularza KT-1:  
   - Dział 1: tylko do odczytu (nazwa, adres, REGON, rodzaj, kategoria, całoroczny).  
   - Dział 4: poz. 1–6 w czytelnej tabeli lub listach (np. „Liczba dni działalności: 31”, „Nominalna liczba miejsc: 70”, …).  
   - Dział 5: tabela z kolumnami Kraj / Turyści korzystający z noclegów / Udzielone noclegi (osobonoce). Pierwszy wiersz = Ogółem (zagraniczni).  
   - Styl: czysty, biały, spójny z resztą systemu (np. `rounded-lg border bg-card p-6`).
4. **Przycisk „Generuj PDF”:**  
   - Otwiera w nowej karcie lub pobiera: `GET /api/reports/kt1/pdf?month=...&year=...` (z tymi samymi parametrami co podgląd). Zwraca plik PDF (Content-Disposition: attachment).
5. **Przycisk „Kopiuj dane”:**  
   - Kopiuje do schowka tekst w formacie umożliwiającym wklejenie na portal GUS (np. wartości pozycji 1–6 + Dział 5 w ustalonym formacie CSV/TSV lub jednym blokiem tekstu). Dokładny format można doprecyzować po konsultacji z użytkownikiem (np. „pozycja1;pozycja2;...”). Minimum: skopiowanie JSON lub czytelnego tekstu z wszystkimi liczbami.

### Autoryzacja

- Strona tylko dla użytkowników z uprawnieniem `reports.official`. Sprawdzenie po stronie klienta (np. ukrycie sekcji) i **koniecznie** po stronie API (GET /api/reports/kt1 i GET /api/reports/kt1/pdf). Bez uprawnienia przekierowanie na /reports lub komunikat „Brak uprawnień”.

### Komponenty

- Używać istniejących: `Button`, `Label`, `Input`, `Select`, `Card` (shadcn), ikony Lucide (np. `FileText`, `Download`, `Copy`). Nie wprowadzać nowych bibliotek UI.

---

## E. Generowanie PDF

### Endpoint

- **URL:** `GET /api/reports/kt1/pdf?month=1&year=2026`
- **Parametry:** jak w C (`month`, `year`).
- **Autoryzacja:** ta sama co GET /api/reports/kt1 (sesja + `reports.official`).
- **Response:** `200` — body = PDF (application/pdf), nagłówek `Content-Disposition: attachment; filename="kt1-YYYY-MM.pdf"`. `400`/`404`/`500` jak w C.

### Implementacja

1. Pobranie danych KT-1 (ta sama logika co GET /api/reports/kt1) — np. wywołanie wspólnej funkcji `getKt1Report(month, year)`.
2. Wygenerowanie HTML strony wyglądającej jak oficjalny formularz KT-1 (układ działów 1, 4, 5 — tabele, etykiety pozycji). HTML może być szablonem w pliku (np. `lib/kt1-pdf-template.ts`) lub generowany w kodzie (string/backtick).
3. Konwersja HTML → PDF: **`generatePdfFromHtml(html)`** z `@/lib/invoice-html`. Konfiguracja Puppeteer już jest: `PUPPETEER_EXECUTABLE_PATH` lub `/usr/bin/chromium-browser`, `page.setContent(html)` + `page.pdf()` (A4, printBackground, margins). Nie duplikować konfiguracji — tylko wywołać istniejącą funkcję.
4. Zwrócenie bufora PDF w NextResponse (Uint8Array, Content-Type: application/pdf).

### Szablon HTML

- Samodzielna strona (nie layout aplikacji): tylko treść formularza, czcionka czytelna (np. Arial/Helvetica), tabelki dla Działu 4 i 5. Można wzorować się na oficjalnym formularzu GUS (raport.stat.gov.pl) — bez kopiowania grafik; chodzi o układ i etykiety.

---

## F. Nawigacja

- **Gdzie dodać link:** W sekcji „Raporty” w sidebarze. Obecna struktura (`components/app-sidebar.tsx`): sekcja `id: "reports"` z `href: "/reports"` (BarChart3, `sidebar.reports`).  
  **Opcja A:** Dodać podlink „Raport KT-1 (GUS)” w sekcji Raporty (jeśli sidebar obsługuje children).  
  **Opcja B:** Na stronie `/reports` w bloku „Raporty urzędowe” dodać przycisk/link: „Raport KT-1 (GUS)” prowadzący do **`/reports/kt1`**.  
- **Etykieta:** „Raport KT-1 (GUS)” lub „KT-1 GUS”.  
- **Ikona:** np. `FileText` (jak przy „Raporty urzędowe”) lub `ScrollText`.  
- **Uprawnienie:** ten sam co przy istniejącym raporcie GUS — `reports.official` (widoczność linku tylko gdy użytkownik ma to uprawnienie).

---

## G. Dane stałe Karczmy Łabędź (do seedowania / konfiguracji)

Wartości do wstawienia do **GusConfig** (np. w seedzie lub formularzu ustawień):

| Pole | Wartość |
|------|--------|
| id | 1 |
| objectName | Karczma Łabędź Łukasz Wojenkowski |
| address | ul. Marsa 2, Nowa Wieś |
| postalCode | 14-200 |
| city | Iława |
| gmina | Iława |
| powiat | Iławski |
| voivodeship | Warmińsko-Mazurskie |
| regon | 280085232 |
| objectType | 1 |
| category | 3 |
| isYearRound | true |
| nominalPlaces | 70 |
| nominalRooms | 28 |
| email | hotel@karczma-labedz.pl |

---

## H. Edge cases i failure modes

| Scenariusz | Co się stanie | Obsługa |
|------------|----------------|---------|
| Rezerwacja „przechodzi” przez miesiąc (np. checkIn 28.02, checkOut 05.03) | Tylko noce 28.02, 01.03, 02.03 (i ewent. 03.03 zależnie od konwencji) wliczone do marca. | Liczyć noce w przedziale `[monthStart, monthEnd]` z uwzględnieniem konwencji checkOut = dzień po ostatniej nocy. W pętli: ostatni dzień pobytu = `checkOut - 1 dzień`; noc „należąca” do dnia D to noc D→D+1. |
| Rezerwacja anulowana (CANCELLED) lub NO_SHOW | Nie wliczana. | Filtr `status IN ('CHECKED_IN', 'CHECKED_OUT')` — już w specyfikacji. |
| Gość bez kraju (country null/empty) | Traktować jako Polska — wliczony do ogółu, w Dziale 5 w pozycji Polska (jeśli jest) lub nie w „zagraniczni”. | W kodzie: `const isForeign = guest.country && guest.country.trim().toUpperCase() !== 'PL'`. |
| Brak GusConfig | API zwraca 404 lub 500 z komunikatem „Brak konfiguracji GUS”. | Przed liczeniem: `const gusConfig = await prisma.gusConfig.findUnique({ where: { id: 1 } }); if (!gusConfig) return 404`. |
| Brak rezerwacji w miesiącu | Dział 4: zera (0 gości, 0 osobonoce, 0 pokojo-dni). Dział 5: tylko wiersz „Ogółem” z zerami. | Nie wymaga specjalnej obsługi — pętle dają 0. |
| Duża liczba rezerwacji (setki) | Jedno zapytanie `findMany` z include guest/room może być duże. | Na start bez paginacji; w razie potrzeby optymalizacja: osobne zapytanie tylko guestId + country, agregacje po stronie bazy (groupBy) — poza zakresem pierwszej wersji. |
| Miesiąc/rok w przyszłości | Dane Działu 4 będą zerowe (brak rezerwacji). | Dozwolone; użytkownik może wybrać przyszły miesiąc (np. do druku szablonu). |
| Dział 3 (pokoje/miejsca wg stanu na 31 lipca) | Wypełniany tylko w sprawozdaniu za lipiec. | Na start **pominąć** — w response `section3: null`. W przyszłości: wypełniać gdy `month === 7`, dane z Room (count nieusuniętych, sum beds). |
| Pokój z gośćmi o różnych narodowościach | Jedna rezerwacja = jeden `guestId` = jedno pole `country`; system nie rozróżnia osób w pokoju. | Liczymy wg kraju **osoby kontaktowej** rezerwacji. To ograniczenie udokumentować (np. w pomocy lub w opisie raportu). |

---

## Podsumowanie plików do utworzenia/modyfikacji

| Plik | Akcja |
|------|--------|
| `prisma/schema.prisma` | Dodać model `GusConfig`. |
| `app/api/reports/kt1/route.ts` | Nowy — GET, JSON. |
| `app/api/reports/kt1/pdf/route.ts` | Nowy — GET, PDF. |
| `app/actions/reports-legal.ts` lub `lib/kt1-report.ts` | Nowa funkcja `getKt1Report(month, year)` zwracająca pełną strukturę KT-1. |
| `app/reports/kt1/page.tsx` | Nowy — strona z selektorem, podglądem, przyciskami PDF i Kopiuj. |
| `lib/kt1-pdf-template.ts` (opcjonalnie) | Szablon HTML do PDF. |
| `app/reports/reports-page-client.tsx` | Dodać link do „Raport KT-1 (GUS)” w sekcji Raporty urzędowe (href: `/reports/kt1`). |
| Seed / migracja | Jednorazowe wstawienie rekordu GusConfig z `id: 1` (dane z sekcji G). |

Specyfikacja jest samowystarczalna dla implementacji: modele, pola, endpointy, logika liczenia, stała KT1_COUNTRIES i edge cases są opisane; koder może zrealizować zadanie bez dodatkowych pytań.
