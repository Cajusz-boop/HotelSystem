# MODUŁ: Rozbudowa Cennika — Pełna specyfikacja + Implementacja

> **CEL:** Rozbudować istniejący moduł cennika do poziomu KWHotel.
> **STAN OBECNY:** RatePlan z validFrom/validTo/price/minStay/maxStay/isNonRefundable/isWeekendHoliday.
> Brak: grup wiekowych, cen dziennych, CTA/CTD, sezonów, posiłków w planie, cenników godzinowych.
> **ZASADA:** Przeczytaj CAŁY dokument. Implementuj WSZYSTKO. Nie pomijaj sekcji.

---

## ISTNIEJĄCE ZASOBY (NIE USUWAJ, ROZBUDUJ)

### Modele Prisma (obecne):
```
RoomType    { id, name (unique), basePrice, sortOrder }
RatePlan    { id, roomTypeId, validFrom, validTo, price, minStayNights, maxStayNights, isNonRefundable, isWeekendHoliday }
DerivedRateRule { id, name, type (PERCENT_ADD|FIXED_ADD), value, description }
RateCode    { id, code, name, ... }
CennikConfig { ... waluta, VAT, ceny netto ... }
HotelConfig { ... seasons (Json) ... }
```

### Server Actions (obecne w `app/actions/rooms.ts`):
- `getEffectivePriceForRoomOnDate` — oblicza cenę pokoju na datę
- `getRatePlansForDate` — plany cenowe na datę
- `getCennikForDate` — cennik na datę
- `createRatePlan` — tworzenie planu
- `copyRatePlansFromYearToYear` — kopiowanie planów

### Inne pliki:
- `app/actions/cennik-config.ts` — konfiguracja cennika
- `app/actions/rate-codes.ts` — kody cenowe
- `app/actions/derived-rates.ts` — reguły pochodne
- `app/actions/seasons.ts` — sezony (sprawdź co jest)
- `app/cennik/page.tsx` — strona cennika
- `app/cennik/reguly-pochodne/page.tsx` — reguły pochodne
- `app/cennik/wydruk/page.tsx` — wydruk cennika
- `app/ustawienia/sezony/page.tsx` — konfiguracja sezonów

---

# CZĘŚĆ A: ZMIANY W SCHEMACIE BAZY DANYCH

## A1. Rozbudowa modelu `RatePlan`

Dodaj nowe pola do istniejącego modelu `RatePlan` w `prisma/schema.prisma`:

```prisma
model RatePlan {
  // === ISTNIEJĄCE POLA (nie zmieniaj) ===
  id                Int       @id @default(autoincrement())
  roomTypeId        Int
  validFrom         DateTime
  validTo           DateTime
  price             Decimal   @db.Decimal(10, 2)
  minStayNights     Int?
  maxStayNights     Int?
  isNonRefundable   Boolean   @default(false)
  isWeekendHoliday  Boolean   @default(false)
  // ... inne istniejące pola ...

  // === NOWE POLA — DODAJ ===

  // Cena za osobę (oprócz ceny bazowej za pokój)
  pricePerPerson      Decimal?  @db.Decimal(10, 2)

  // Grupy wiekowe — cena per osoba w grupie
  adultPrice          Decimal?  @db.Decimal(10, 2)   // cena za dorosłego
  child1Price         Decimal?  @db.Decimal(10, 2)   // dziecko grupa 1 (np. 0-6 lat)
  child2Price         Decimal?  @db.Decimal(10, 2)   // dziecko grupa 2 (np. 7-12 lat)
  child3Price         Decimal?  @db.Decimal(10, 2)   // dziecko grupa 3 (np. 13-17 lat)

  // Restrykcje
  closedToArrival     Boolean   @default(false)      // zakaz zameldowania w tym okresie
  closedToDeparture   Boolean   @default(false)      // zakaz wymeldowania w tym okresie

  // Powiązanie z sezonem (opcjonalne)
  seasonId            Int?

  // Posiłki wliczone w cenę
  includedMealPlan    String?   // np. "BB", "HB", "FB", "AI" — jaki plan wyżywienia wchodzi w cenę

  // Relacje
  roomType  RoomType  @relation(fields: [roomTypeId], references: [id])
  season    Season?   @relation(fields: [seasonId], references: [id])
}
```

## A2. Nowy model `Season` (jeśli nie istnieje jako osobna tabela)

Sprawdź najpierw: `HotelConfig.seasons` jest Json. Potrzebujemy PRAWDZIWEJ tabeli żeby powiązać z RatePlan.

```prisma
model Season {
  id          Int       @id @default(autoincrement())
  propertyId  Int
  name        String              // np. "Sezon wysoki", "Sezon niski", "Święta"
  color       String?             // kolor na grafiku/cenniku (#FF5733)
  dateFrom    DateTime
  dateTo      DateTime
  year        Int                 // rok (sezony definiowane per rok)
  sortOrder   Int       @default(0)
  isActive    Boolean   @default(true)

  // Relacje
  property    Property  @relation(fields: [propertyId], references: [id])
  ratePlans   RatePlan[]

  @@unique([propertyId, name, year])
}
```

**UWAGA:** Jeśli `app/actions/seasons.ts` i `/ustawienia/sezony` już istnieją z własnym modelem — NIE twórz duplikatu. Rozbuduj istniejący model o brakujące pola (color, year, relacja do RatePlan). Sprawdź schema.prisma PRZED dodaniem.

## A3. Nowy model `DailyRateOverride`

Nadpisanie ceny z RatePlan na konkretny dzień (np. Sylwester, długi weekend):

```prisma
model DailyRateOverride {
  id            Int       @id @default(autoincrement())
  propertyId    Int
  roomTypeId    Int
  date          DateTime  @db.Date    // konkretny dzień
  price         Decimal?  @db.Decimal(10, 2)   // nadpisana cena bazowa (null = bez nadpisania)
  pricePerPerson  Decimal?  @db.Decimal(10, 2) // nadpisana cena za osobę
  adultPrice    Decimal?  @db.Decimal(10, 2)
  child1Price   Decimal?  @db.Decimal(10, 2)
  child2Price   Decimal?  @db.Decimal(10, 2)
  child3Price   Decimal?  @db.Decimal(10, 2)
  closedToArrival   Boolean @default(false)
  closedToDeparture Boolean @default(false)
  isClosed      Boolean   @default(false)    // dzień całkowicie zamknięty na sprzedaż
  reason        String?                       // powód nadpisania (np. "Sylwester")
  createdBy     Int?
  createdAt     DateTime  @default(now())

  property  Property  @relation(fields: [propertyId], references: [id])
  roomType  RoomType  @relation(fields: [roomTypeId], references: [id])

  @@unique([propertyId, roomTypeId, date])
}
```

## A4. Nowy model `AgeGroupConfig`

Konfiguracja zakresów wiekowych (globalna dla hotelu):

```prisma
model AgeGroupConfig {
  id          Int     @id @default(autoincrement())
  propertyId  Int
  group       String  // "ADULT", "CHILD1", "CHILD2", "CHILD3"
  label       String  // "Dorosły", "Dziecko 0-6", "Dziecko 7-12", "Dziecko 13-17"
  ageFrom     Int     // dolna granica wieku (włącznie)
  ageTo       Int     // górna granica wieku (włącznie)
  sortOrder   Int     @default(0)

  property    Property @relation(fields: [propertyId], references: [id])

  @@unique([propertyId, group])
}
```

## A5. Nowy model `LongStayDiscount`

Rabaty za długie pobyty:

```prisma
model LongStayDiscount {
  id              Int     @id @default(autoincrement())
  propertyId      Int
  minNights       Int             // np. 7, 14, 30
  discountPercent Decimal? @db.Decimal(5, 2)  // rabat procentowy (np. 10.00 = 10%)
  discountFixed   Decimal? @db.Decimal(10, 2) // lub rabat kwotowy za dobę
  isActive        Boolean @default(true)

  property Property @relation(fields: [propertyId], references: [id])

  @@unique([propertyId, minNights])
}
```

## A6. Nowy model `ServiceRate`

Cenniki za usługi stałe (parking, zwierzęta, dostawka):

```prisma
model ServiceRate {
  id              Int     @id @default(autoincrement())
  propertyId      Int
  name            String            // "Parking", "Zwierzę", "Dostawka"
  code            String            // "PARKING", "PET", "EXTRA_BED"
  price           Decimal @db.Decimal(10, 2)
  calculationMethod String @default("PER_NIGHT") // PER_NIGHT, PER_STAY, PER_PERSON_PER_NIGHT, ONE_TIME
  vatRate         Decimal? @db.Decimal(5, 2)
  isActive        Boolean @default(true)
  sortOrder       Int     @default(0)

  property Property @relation(fields: [propertyId], references: [id])

  @@unique([propertyId, code])
}
```

## A7. Nowy model `HourlyRate` (opcjonalnie — dla sal konferencyjnych)

```prisma
model HourlyRate {
  id          Int     @id @default(autoincrement())
  propertyId  Int
  roomTypeId  Int
  pricePerHour Decimal @db.Decimal(10, 2)
  minHours    Int     @default(1)
  maxHours    Int?
  isActive    Boolean @default(true)

  property  Property @relation(fields: [propertyId], references: [id])
  roomType  RoomType @relation(fields: [roomTypeId], references: [id])

  @@unique([propertyId, roomTypeId])
}
```

---

## Po dodaniu modeli — uruchom migrację:
```bash
npx prisma migrate dev --name add-pricing-expansion
```

---

# CZĘŚĆ B: SERVER ACTIONS

## B1. Rozbudowa `app/actions/rooms.ts`

### Nowa funkcja: `getEffectivePriceForRoomOnDate` — ROZBUDUJ istniejącą

Obecna logika prawdopodobnie: znajdź RatePlan dla roomType na datę → zwróć price.

**Nowa logika (priorytet cen):**

```
1. Sprawdź DailyRateOverride dla (roomTypeId, date)
   → Jeśli istnieje i ma price → użyj tych cen (nadpisanie ma najwyższy priorytet)
   → Jeśli isClosed = true → zwróć null/error (dzień zamknięty)
2. Jeśli brak override → sprawdź RatePlan dla (roomTypeId, date)
   → Znajdź plan WHERE validFrom <= date AND validTo >= date
   → Jeśli isWeekendHoliday = true → tylko dla Sob/Nie
   → Jeśli closedToArrival = true i date === checkIn → zwróć informację o restrykcji
   → Jeśli closedToDeparture = true i date === checkOut → zwróć informację o restrykcji
3. Jeśli brak planu → użyj RoomType.basePrice
4. Zastosuj LongStayDiscount jeśli pobyt >= minNights
5. Zastosuj DerivedRateRule jeśli istnieje
```

**Zwracany obiekt powinien zawierać:**
```typescript
interface EffectivePrice {
  basePrice: number;           // cena za pokój
  pricePerPerson: number | null; // cena za osobę
  adultPrice: number | null;
  child1Price: number | null;
  child2Price: number | null;
  child3Price: number | null;
  source: 'OVERRIDE' | 'RATE_PLAN' | 'BASE_PRICE'; // skąd cena
  ratePlanId: number | null;
  seasonName: string | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  isClosed: boolean;
  longStayDiscount: number | null; // procent rabatu
  includedMealPlan: string | null;
}
```

### Nowe funkcje — dodaj w `rooms.ts`:

```typescript
// --- DAILY RATE OVERRIDES ---

export async function getDailyRateOverrides(params: {
  propertyId: number;
  roomTypeId?: number;
  dateFrom: string;
  dateTo: string;
}): Promise<DailyRateOverride[]>
// Query: WHERE propertyId AND date >= dateFrom AND date <= dateTo
// Opcjonalnie filtruj po roomTypeId

export async function setDailyRateOverride(params: {
  propertyId: number;
  roomTypeId: number;
  date: string;
  price?: number;
  pricePerPerson?: number;
  adultPrice?: number;
  child1Price?: number;
  child2Price?: number;
  child3Price?: number;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  isClosed?: boolean;
  reason?: string;
}): Promise<DailyRateOverride>
// Upsert: jeśli istnieje → update, jeśli nie → create

export async function deleteDailyRateOverride(params: {
  propertyId: number;
  roomTypeId: number;
  date: string;
}): Promise<void>

export async function bulkSetDailyRateOverrides(params: {
  propertyId: number;
  roomTypeIds: number[];    // wiele typów naraz
  dateFrom: string;
  dateTo: string;
  price?: number;
  adjustmentType?: 'SET' | 'PERCENT_ADD' | 'FIXED_ADD';  // ustaw / dodaj % / dodaj kwotę
  adjustmentValue?: number;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  isClosed?: boolean;
  reason?: string;
}): Promise<{ created: number; updated: number }>
// Dla każdego dnia w zakresie × każdego roomType → upsert override

// --- LONG STAY DISCOUNTS ---

export async function getLongStayDiscounts(propertyId: number): Promise<LongStayDiscount[]>

export async function saveLongStayDiscount(params: {
  propertyId: number;
  minNights: number;
  discountPercent?: number;
  discountFixed?: number;
  isActive: boolean;
}): Promise<LongStayDiscount>
// Upsert po (propertyId, minNights)

export async function deleteLongStayDiscount(id: number): Promise<void>

// --- SERVICE RATES ---

export async function getServiceRates(propertyId: number): Promise<ServiceRate[]>

export async function saveServiceRate(params: {
  id?: number;
  propertyId: number;
  name: string;
  code: string;
  price: number;
  calculationMethod: string;
  vatRate?: number;
  isActive: boolean;
}): Promise<ServiceRate>

export async function deleteServiceRate(id: number): Promise<void>

// --- AGE GROUPS ---

export async function getAgeGroupConfig(propertyId: number): Promise<AgeGroupConfig[]>

export async function saveAgeGroupConfig(params: {
  propertyId: number;
  groups: Array<{
    group: string;
    label: string;
    ageFrom: number;
    ageTo: number;
  }>;
}): Promise<AgeGroupConfig[]>
// Usuń stare i wstaw nowe (deleteMany + createMany)
```

## B2. Rozbudowa tworzenia RatePlan

Istniejąca funkcja `createRatePlan` w `rooms.ts` — rozbuduj o nowe pola:

```typescript
export async function createRatePlan(params: {
  roomTypeId: number;
  validFrom: string;
  validTo: string;
  price: number;
  // === NOWE POLA ===
  pricePerPerson?: number;
  adultPrice?: number;
  child1Price?: number;
  child2Price?: number;
  child3Price?: number;
  minStayNights?: number;
  maxStayNights?: number;
  isNonRefundable?: boolean;
  isWeekendHoliday?: boolean;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  seasonId?: number;
  includedMealPlan?: string;
}): Promise<RatePlan>
```

Analogicznie rozbuduj `updateRatePlan` (jeśli istnieje) lub dodaj.

## B3. Kopiowanie planów cenowych z modyfikacją

```typescript
export async function copyRatePlansWithModification(params: {
  sourceRoomTypeId: number;
  targetRoomTypeId: number;        // może być ten sam (kopiowanie dat)
  sourceDateFrom: string;
  sourceDateTo: string;
  targetDateFrom: string;          // nowe daty
  targetDateTo: string;
  adjustmentType: 'NONE' | 'PERCENT' | 'FIXED'; // bez zmian / +/- % / +/- kwota
  adjustmentValue: number;         // np. 10 = +10%, -5 = -5 PLN
}): Promise<{ copied: number }>
```

---

# CZĘŚĆ C: ROZBUDOWA UI — STRONA CENNIKA

## C1. Layout strony `/cennik` — DOCELOWY WIDOK

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  💰 Cennik                                                     [Karczma Łabędź] │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─ ZAKŁADKI ────────────────────────────────────────────────────────────────┐   │
│  │  [Plany cenowe]  [Ceny dzienne]  [Sezony]  [Grupy wiekowe]               │   │
│  │  [Usługi stałe]  [Długie pobyty]  [Reguły pochodne]  [Wydruk]            │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  (zawartość zależna od wybranej zakładki — opisane poniżej)                      │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Uwaga: Zakładki "Reguły pochodne" i "Wydruk" JUŻ ISTNIEJĄ jako osobne strony (`/cennik/reguly-pochodne`, `/cennik/wydruk`). Zamień na zakładki w ramach jednej strony LUB zostaw jako linki w nawigacji — zdecyduj co jest prostsze. Preferowane: zakładki (Tabs).

## C2. Zakładka "Plany cenowe" — rozbudowa istniejącego widoku

Istniejący widok prawdopodobnie pokazuje listę planów. Rozbuduj o:

### Formularz tworzenia/edycji RatePlan:

```
┌─ Nowy Plan Cenowy ──────────────────────────────────────────────────────────────┐
│                                                                                  │
│  Typ pokoju: [▼ Comfort          ]   Sezon: [▼ Sezon wysoki    ]               │
│                                                                                  │
│  Data od: [📅 01.06.2026]   Data do: [📅 31.08.2026]                           │
│                                                                                  │
│  ┌─ CENY ─────────────────────────────────────────────────────────────────────┐  │
│  │                                                                             │  │
│  │  Tryb:  (●) Cena za pokój  (○) Cena za osobę  (○) Cena za pokój + osoby   │  │
│  │                                                                             │  │
│  │  Cena bazowa (za pokój/dobę):  [  350,00 ] PLN                             │  │
│  │                                                                             │  │
│  │  ── Ceny za osoby (jeśli tryb "za osoby" lub "pokój + osoby") ──          │  │
│  │  Cena za dorosłego:            [  150,00 ] PLN                             │  │
│  │  Cena za dziecko 0-6 lat:     [    0,00 ] PLN                             │  │
│  │  Cena za dziecko 7-12 lat:    [   75,00 ] PLN                             │  │
│  │  Cena za dziecko 13-17 lat:   [  120,00 ] PLN                             │  │
│  │                                                                             │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌─ RESTRYKCJE ───────────────────────────────────────────────────────────────┐  │
│  │  Min. pobyt: [  1 ] noce     Max. pobyt: [  30 ] noce                     │  │
│  │  ☐ Closed to Arrival (zakaz zameldowania w tym okresie)                     │  │
│  │  ☐ Closed to Departure (zakaz wymeldowania w tym okresie)                   │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌─ OPCJE ────────────────────────────────────────────────────────────────────┐  │
│  │  ☐ Tylko weekend / święta                                                   │  │
│  │  ☐ Bezzwrotny (non-refundable)                                              │  │
│  │  Wliczony plan wyżywienia: [▼ Brak ] (opcje: Brak, BB, HB, FB, AI)        │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  [Anuluj]  [Zapisz plan cenowy]                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Lista planów cenowych — tabela:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Typ pokoju │ Sezon         │ Od         │ Do         │ Cena baz. │ Za os. │ CTA│
│  ───────────┼───────────────┼────────────┼────────────┼───────────┼────────┼────│
│  Comfort    │ Sezon wysoki  │ 01.06.2026 │ 31.08.2026 │ 350,00    │ 150,00 │  - │
│  Comfort    │ Sezon niski   │ 01.09.2026 │ 31.05.2027 │ 250,00    │ 100,00 │  - │
│  Suite      │ Sezon wysoki  │ 01.06.2026 │ 31.08.2026 │ 600,00    │ 200,00 │  - │
│  Suite      │ Sylwester     │ 30.12.2026 │ 02.01.2027 │ 900,00    │ 300,00 │ ✓ │
│                                                                                  │
│  [+ Nowy plan]  [📋 Kopiuj z modyfikacją]                                       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- Klik na wiersz → edycja w formularzu powyżej
- Przycisk "Kopiuj z modyfikacją" → dialog (opisany w B3)

## C3. Zakładka "Ceny dzienne" — NOWY WIDOK

Widok kalendarza/siatki pokazujący ceny na każdy dzień z możliwością edycji:

```
┌─ Ceny dzienne ──────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  Miesiąc: [◀ Luty 2026 ▶]     Typ pokoju: [▼ Wszystkie]                        │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │           │ Pon 2  │ Wt 3   │ Śr 4   │ Czw 5  │ Pt 6   │ Sob 7  │ Nd 8  │ │
│  │  ─────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────│ │
│  │  Comfort  │ 250    │ 250    │ 250    │ 250    │ 250    │ *350*  │ *350* │ │
│  │  Suite    │ 450    │ 450    │ 450    │ 450    │ 450    │ *600*  │ *600* │ │
│  │  Standard │ 180    │ 180    │ 180    │ 180    │ 180    │ *220*  │ *220* │ │
│  │                                                                             │ │
│  │  *kursywa* = cena weekendowa    **bold** = nadpisanie dzienne               │ │
│  │  🔴 = zamknięty    🟡 = CTA    🟠 = CTD                                    │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  Klik na komórkę → edycja ceny na ten dzień                                      │
│  Zaznacz wiele komórek (Shift+klik lub drag) → hurtowa zmiana                    │
│                                                                                  │
│  [Zmiana hurtowa: Zaznaczone komórki]  [Wyczyść nadpisania za okres]             │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Dialog edycji ceny dziennej (klik na komórkę):

```
┌─ Cena na 07.02.2026 — Comfort ─────────────────────────┐
│                                                          │
│  Cena z planu cenowego: 250,00 PLN (Sezon niski)        │
│                                                          │
│  ☑ Nadpisz cenę na ten dzień                            │
│                                                          │
│  Cena bazowa:        [ 350,00 ] PLN                     │
│  Cena za dorosłego:  [ 150,00 ] PLN                     │
│  Dziecko 0-6:        [   0,00 ] PLN                     │
│  Dziecko 7-12:       [  75,00 ] PLN                     │
│  Dziecko 13-17:      [ 120,00 ] PLN                     │
│                                                          │
│  ☐ Closed to Arrival                                    │
│  ☐ Closed to Departure                                  │
│  ☐ Zamknięty (nie do sprzedaży)                         │
│                                                          │
│  Powód: [ Długi weekend _________________ ]             │
│                                                          │
│  [Usuń nadpisanie]  [Anuluj]  [Zapisz]                  │
└──────────────────────────────────────────────────────────┘
```

### Dialog zmiany hurtowej (wiele komórek):

```
┌─ Zmiana hurtowa ────────────────────────────────────────┐
│                                                          │
│  Zakres: 01.02.2026 — 28.02.2026                        │
│  Typy:   ☑ Comfort  ☑ Suite  ☐ Standard                │
│                                                          │
│  Operacja:                                               │
│  (○) Ustaw cenę:     [ ______ ] PLN                     │
│  (●) Dodaj procent:  [ +10    ] %                       │
│  (○) Dodaj kwotę:    [ ______ ] PLN                     │
│                                                          │
│  ☐ Closed to Arrival                                    │
│  ☐ Closed to Departure                                  │
│  ☐ Zamknij na sprzedaż                                  │
│                                                          │
│  Powód: [ _________________________________ ]           │
│                                                          │
│  Podgląd: 28 dni × 2 typy = 56 nadpisań                │
│                                                          │
│  [Anuluj]  [Zastosuj]                                    │
└──────────────────────────────────────────────────────────┘
```

## C4. Zakładka "Sezony"

Może już istnieć (`/ustawienia/sezony`). Jeśli tak — PRZENIEŚ do zakładki w cenniku lub dodaj link.

```
┌─ Sezony ────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  Rok: [▼ 2026]                                                                  │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  Nazwa           │ Kolor │ Od         │ Do         │ Aktywny │ Akcje      │ │
│  │  ────────────────┼───────┼────────────┼────────────┼─────────┼────────────│ │
│  │  Sezon wysoki    │ 🟥    │ 01.06.2026 │ 31.08.2026 │ ✅      │ [✏️] [🗑️] │ │
│  │  Sezon niski     │ 🟦    │ 01.09.2026 │ 31.05.2027 │ ✅      │ [✏️] [🗑️] │ │
│  │  Święta Bożonar. │ 🟨    │ 23.12.2026 │ 26.12.2026 │ ✅      │ [✏️] [🗑️] │ │
│  │  Sylwester       │ 🟧    │ 30.12.2026 │ 02.01.2027 │ ✅      │ [✏️] [🗑️] │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  [+ Nowy sezon]  [📋 Kopiuj sezony z poprzedniego roku]                         │
│                                                                                  │
│  ┌─ Podgląd wizualny (timeline) ───────────────────────────────────────────────┐ │
│  │  Sty  Lut  Mar  Kwi  Maj  Cze  Lip  Sie  Wrz  Paź  Lis  Gru              │ │
│  │  ─────────────────────────█████████████████████───────────────█──           │ │
│  │  🟦 niski                 🟥 wysoki            🟦 niski      🟨🟧          │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Timeline: prosty `<div>` z kolorowanymi segmentami proporcjonalnymi do dni w roku. Nie musi być interaktywny.

## C5. Zakładka "Grupy wiekowe"

```
┌─ Konfiguracja grup wiekowych ───────────────────────────────────────────────────┐
│                                                                                  │
│  Te grupy określają jak system liczy ceny za osoby w rezerwacjach.              │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  Grupa        │ Etykieta          │ Wiek od │ Wiek do │                    │ │
│  │  ─────────────┼───────────────────┼─────────┼─────────│                    │ │
│  │  Dorosły      │ [ Dorosły       ] │ [ 18  ] │ [ 99  ] │                    │ │
│  │  Dziecko gr.1 │ [ Dziecko 0-6   ] │ [  0  ] │ [  6  ] │                    │ │
│  │  Dziecko gr.2 │ [ Dziecko 7-12  ] │ [  7  ] │ [ 12  ] │                    │ │
│  │  Dziecko gr.3 │ [ Dziecko 13-17 ] │ [ 13  ] │ [ 17  ] │                    │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  ⚠️ Zmiana zakresów wpłynie na naliczanie cen w NOWYCH rezerwacjach.            │
│     Istniejące rezerwacje nie zostaną zmienione.                                 │
│                                                                                  │
│  [Zapisz]                                                                        │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## C6. Zakładka "Usługi stałe"

```
┌─ Cennik usług stałych ─────────────────────────────────────────────────────────┐
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  Nazwa       │ Kod      │ Cena    │ Naliczanie        │ VAT  │ Aktywna    │ │
│  │  ────────────┼──────────┼─────────┼───────────────────┼──────┼────────────│ │
│  │  Parking     │ PARKING  │  30,00  │ za dobę           │ 23%  │ ✅  [✏️🗑️]│ │
│  │  Zwierzę     │ PET      │  50,00  │ za pobyt          │ 23%  │ ✅  [✏️🗑️]│ │
│  │  Dostawka    │ EXTRA_BED│  80,00  │ za osobo-dobę     │  8%  │ ✅  [✏️🗑️]│ │
│  │  Łóżeczko dz.│BABY_COT │   0,00  │ za pobyt          │  -   │ ✅  [✏️🗑️]│ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  [+ Nowa usługa]                                                                 │
│                                                                                  │
│  Metody naliczania:                                                              │
│  • za dobę (PER_NIGHT) — cena × liczba nocy                                     │
│  • za pobyt (PER_STAY) — jednorazowo                                             │
│  • za osobo-dobę (PER_PERSON_PER_NIGHT) — cena × osoby × noce                   │
│  • jednorazowo (ONE_TIME) — raz przy zameldowaniu                                │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## C7. Zakładka "Długie pobyty"

```
┌─ Rabaty za długie pobyty ───────────────────────────────────────────────────────┐
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  Min. noce │ Rabat           │ Aktywny │ Akcje                             │ │
│  │  ──────────┼─────────────────┼─────────┼───────                            │ │
│  │  7         │ 5%              │ ✅      │ [✏️] [🗑️]                         │ │
│  │  14        │ 10%             │ ✅      │ [✏️] [🗑️]                         │ │
│  │  30        │ 15%             │ ✅      │ [✏️] [🗑️]                         │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  [+ Nowy próg rabatowy]                                                          │
│                                                                                  │
│  Przykład: Pobyt 10 nocy → rabat 5% (próg 7 nocy)                               │
│  Rabaty nie kumulują się — stosowany jest NAJWYŻSZY pasujący próg.              │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

# CZĘŚĆ D: INTEGRACJA Z RESZTĄ SYSTEMU

## D1. Okno rezerwacji — cennik w formularzu

W istniejącym oknie edycji rezerwacji (tape-chart dialog, zakładka Rozliczenie):

1. **Dodaj trzeci radio button** w trybie cenowym:
   ```
   (●) Cena za pokój  (○) Cena za osobę  (○) Plan cenowy [▼ wybierz]
   ```
   Jeśli "Plan cenowy" wybrany → dropdown z listą RatePlan/RateCode → ceny auto-fill.

2. **Pokaż ceny grup wiekowych** gdy są dostępne:
   ```
   Dorośli: [2] × 150,00 = 300,00
   Dz. 0-6: [1] × 0,00 = 0,00
   Dz. 7-12: [0] × 75,00 = 0,00
   Dz. 13-17: [0] × 120,00 = 0,00
   Bazowa pokoju: 350,00
   Suma/dobę: 650,00
   ```

3. **Pokaż restrykcje** jeśli CTA/CTD aktywne:
   ```
   ⚠️ Closed to Arrival w dniu 15.06 — zameldowanie niedostępne
   ```

4. **Pokaż rabat za długi pobyt** jeśli pasuje:
   ```
   ℹ️ Rabat za długi pobyt (10 nocy): -5% = -32,50 PLN/dobę
   ```

## D2. TapeChart — ceny na grafiku

W istniejącym TapeChart (jeśli ceny na grafiku JUŻ działają — sprawdź):
- Korzystaj z nowej logiki `getEffectivePriceForRoomOnDate` żeby wyświetlać poprawne ceny
- Pokaż nadpisania dzienne BOLD, normalne zwykłą czcionką
- Pokaż CTA/CTD jako kolorowe znaczniki na dniach (opcjonalnie — jeśli czas pozwala)

## D3. Booking Engine — ceny z grup wiekowych

W `app/actions/booking-engine.ts`:
- `getRoomTypesForBooking` — uwzględnij ceny z grup wiekowych
- Zwracaj ceny per grupa w odpowiedzi
- Formularz booking: dodaj pola na liczbę dzieci per grupa wiekowa

---

# CZĘŚĆ E: PLIKI DO UTWORZENIA / MODYFIKACJI — PODSUMOWANIE

### Nowe pliki:
```
app/cennik/components/
├── rate-plan-form.tsx           — formularz tworzenia/edycji planu
├── rate-plan-list.tsx           — lista planów cenowych
├── daily-rates-grid.tsx         — siatka cen dziennych (kalendarza)
├── daily-rate-edit-dialog.tsx   — dialog edycji ceny na dzień
├── bulk-change-dialog.tsx       — dialog zmiany hurtowej
├── copy-plans-dialog.tsx        — dialog kopiowania planów z modyfikacją
├── seasons-tab.tsx              — zakładka Sezony (lub link do /ustawienia/sezony)
├── seasons-timeline.tsx         — wizualny timeline sezonów
├── age-groups-tab.tsx           — zakładka Grupy wiekowe
├── service-rates-tab.tsx        — zakładka Usługi stałe
├── long-stay-tab.tsx            — zakładka Długie pobyty
```

### Modyfikacja istniejących:
```
prisma/schema.prisma                — nowe modele + pola w RatePlan
app/actions/rooms.ts                — nowe server actions + rozbudowa getEffectivePriceForRoomOnDate
app/cennik/page.tsx                 — zamień na tabbed layout z zakładkami
components/tape-chart/tabs/settlement-tab.tsx — grupy wiekowe, trzeci tryb cenowy
app/actions/booking-engine.ts       — grupy wiekowe w booking
```

---

# CZĘŚĆ F: KOLEJNOŚĆ IMPLEMENTACJI

```
1. Schema Prisma (A1-A7) + migracja
2. Server actions — CRUD dla nowych modeli (B1-B3)
3. Zakładka "Grupy wiekowe" (C5) — najprostsza, pozwala przetestować pipeline
4. Zakładka "Usługi stałe" (C6) — CRUD prosty
5. Zakładka "Długie pobyty" (C7) — CRUD prosty
6. Zakładka "Sezony" (C4) — z timeline
7. Rozbudowa formularza planu cenowego (C2) — nowe pola, restrykcje
8. Zakładka "Ceny dzienne" (C3) — siatka + edycja + bulk
9. Integracja: getEffectivePriceForRoomOnDate (B1 — rozbudowa)
10. Integracja: okno rezerwacji (D1)
11. Integracja: booking engine (D3)
12. Testy i weryfikacja
```

---

# CZĘŚĆ G: CHECKLIST

## Schema i migracja:
- [ ] Model Season istnieje (lub rozbudowany istniejący)
- [ ] RatePlan ma nowe pola: pricePerPerson, adultPrice, child1-3Price, closedToArrival, closedToDeparture, seasonId, includedMealPlan
- [ ] Model DailyRateOverride istnieje
- [ ] Model AgeGroupConfig istnieje
- [ ] Model LongStayDiscount istnieje
- [ ] Model ServiceRate istnieje
- [ ] Model HourlyRate istnieje
- [ ] Migracja przeszła bez błędów

## Server actions:
- [ ] getDailyRateOverrides działa
- [ ] setDailyRateOverride działa (upsert)
- [ ] deleteDailyRateOverride działa
- [ ] bulkSetDailyRateOverrides działa
- [ ] getLongStayDiscounts działa
- [ ] saveLongStayDiscount działa
- [ ] deleteLongStayDiscount działa
- [ ] getServiceRates działa
- [ ] saveServiceRate działa
- [ ] deleteServiceRate działa
- [ ] getAgeGroupConfig działa
- [ ] saveAgeGroupConfig działa
- [ ] createRatePlan obsługuje NOWE pola
- [ ] copyRatePlansWithModification działa
- [ ] getEffectivePriceForRoomOnDate uwzględnia: overrides > ratePlan > basePrice + longStay + derived

## UI — zakładki cennika:
- [ ] Strona /cennik ma zakładki (Tabs)
- [ ] Zakładka "Plany cenowe": lista planów + formularz z NOWYMI polami
- [ ] Formularz: grupy wiekowe (4 pola cen) widoczne i działają
- [ ] Formularz: CTA/CTD checkboxy działają
- [ ] Formularz: dropdown sezonu działa
- [ ] Formularz: dropdown wyżywienia działa
- [ ] Zakładka "Ceny dzienne": siatka miesiąca z cenami
- [ ] Siatka: klik na komórkę → dialog edycji
- [ ] Siatka: bulk selection → dialog zmiany hurtowej
- [ ] Siatka: nadpisania bold, weekendy kursywa
- [ ] Siatka: CTA/CTD oznaczone kolorowo
- [ ] Zakładka "Sezony": lista + CRUD + timeline wizualny
- [ ] Zakładka "Grupy wiekowe": 4 grupy z etykietami i zakresami
- [ ] Zakładka "Usługi stałe": lista + CRUD
- [ ] Zakładka "Długie pobyty": lista progów + CRUD

## Integracja:
- [ ] Okno rezerwacji: trzeci tryb cenowy "Plan cenowy" działa
- [ ] Okno rezerwacji: ceny grup wiekowych wyświetlają się
- [ ] Okno rezerwacji: restrykcje CTA/CTD sygnalizowane
- [ ] Okno rezerwacji: rabat za długi pobyt wyświetla się
- [ ] Istniejące rezerwacje NIE są zepsute (ceny bez grup wiekowych nadal działają)
- [ ] TapeChart nadal działa
- [ ] Booking engine nadal działa

---

# WAŻNE OSTRZEŻENIA

- Nowe pola w RatePlan są OPCJONALNE (nullable) — istniejące plany nie muszą mieć grup wiekowych
- `getEffectivePriceForRoomOnDate` MUSI być backward-compatible — jeśli brak nowych pól, zachowuj się jak dotychczas
- NIE usuwaj istniejących server actions — rozbudowuj je
- NIE zmieniaj nazw istniejących pól w Prisma — tylko DODAWAJ nowe
- ServiceRate, LongStayDiscount, AgeGroupConfig — jeśli PODOBNE modele już istnieją pod innymi nazwami w schema.prisma → ROZBUDUJ istniejące zamiast tworzyć nowe
- Sprawdź `app/actions/seasons.ts` — jeśli Season model JUŻ ISTNIEJE → nie twórz duplikatu
- Sprawdź `HotelConfig.seasons` (Json) — może trzeba migrować dane z Json do tabeli Season