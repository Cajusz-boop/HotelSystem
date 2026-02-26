# MODUŁ: Zarządzanie Pokojami — braki + Wydarzenia na Grafiku + Wyszukiwarka pokoi

> Trzy powiązane obszary w jednym dokumencie.
> Przeczytaj CAŁY. Zrób WSZYSTKO. Sprawdź checklistę na końcu.

---

# ═══════════════════════════════════════════════════════
# CZĘŚĆ 1: ROZBUDOWA ZARZĄDZANIA POKOJAMI
# ═══════════════════════════════════════════════════════

## CEL

Uzupełnić brakujące funkcje zarządzania pokojami z KWHotel: widoczność w statystykach,
priorytet sprzedaży, soft-delete, eksport CSV, tłumaczenia nazw typów pokoi.

## ISTNIEJĄCE ZASOBY

```
Modele:
  Room      { id, propertyId, number, type, status, price, activeForSale, roomFeatures,
              beds, surfaceArea, floor, building, view, cleaningPriority, maxOccupancy, ... }
  RoomType  { id, name (unique), basePrice, sortOrder }

Pliki:
  app/pokoje/page.tsx                     — strona zarządzania pokojami
  app/actions/rooms.ts                     — getRooms, getRoomsForManagement, create, update, delete
  components/tape-chart/index.tsx          — TapeChart (używa pokoi)
```

## A1. Nowe pola w modelu `RoomType`

Dodaj do `prisma/schema.prisma`:

```prisma
model RoomType {
  // ISTNIEJĄCE
  id        Int     @id @default(autoincrement())
  name      String  @unique
  basePrice Decimal @db.Decimal(10, 2)
  sortOrder Int     @default(0)

  // NOWE
  description       String?           // opis typu (np. "Pokój z balkonem i widokiem na jezioro")
  visibleInStats    Boolean @default(true)  // czy uwzględniać w raportach obłożenia
  translations      Json?             // { "en": "Comfort Room", "de": "Komfortzimmer" }
  photoUrl          String?           // zdjęcie główne typu
  maxOccupancy      Int?              // maks. osób dla tego typu
  bedsDescription   String?           // np. "2×DB" (2 podwójne łóżka)
}
```

## A2. Nowe pola w modelu `Room`

```prisma
model Room {
  // ISTNIEJĄCE — nie zmieniaj

  // NOWE
  sellPriority    Int       @default(0)    // kolejność propozycji (niższy = wyższy priorytet)
  isDeleted       Boolean   @default(false) // soft-delete
  deletedAt       DateTime?                 // kiedy usunięto
  deletedBy       Int?                      // kto usunął
  description     String?                   // dodatkowy opis pokoju
}
```

## A3. Rozbudowa Server Actions (`app/actions/rooms.ts`)

### Soft-delete pokoi:

```typescript
export async function softDeleteRoom(roomId: number, userId: number): Promise<void> {
  // Sprawdź czy pokój nie ma aktywnych rezerwacji (CONFIRMED lub CHECKED_IN)
  const activeReservations = await prisma.reservation.count({
    where: {
      roomId,
      status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      checkOut: { gte: new Date() },
    },
  });

  if (activeReservations > 0) {
    throw new Error(`Pokój ma ${activeReservations} aktywnych rezerwacji. Anuluj je najpierw.`);
  }

  await prisma.room.update({
    where: { id: roomId },
    data: { isDeleted: true, deletedAt: new Date(), deletedBy: userId, activeForSale: false },
  });
}

export async function restoreRoom(roomId: number): Promise<void> {
  await prisma.room.update({
    where: { id: roomId },
    data: { isDeleted: false, deletedAt: null, deletedBy: null },
  });
}

export async function getDeletedRooms(propertyId: number): Promise<Room[]> {
  return prisma.room.findMany({
    where: { propertyId, isDeleted: true },
    include: { roomType: true },
    orderBy: { deletedAt: 'desc' },
  });
}
```

### Eksport pokoi do CSV:

```typescript
export async function getRoomsForExport(propertyId: number): Promise<RoomExportEntry[]> {
  const rooms = await prisma.room.findMany({
    where: { propertyId, isDeleted: false },
    include: { roomType: true },
    orderBy: [{ floor: 'asc' }, { number: 'asc' }],
  });

  return rooms.map(r => ({
    number: r.number,
    type: r.roomType?.name || r.type,
    floor: r.floor || '',
    building: r.building || '',
    beds: r.beds || '',
    maxOccupancy: r.maxOccupancy || '',
    surfaceArea: r.surfaceArea || '',
    price: r.price?.toString() || '',
    status: r.status,
    activeForSale: r.activeForSale ? 'Tak' : 'Nie',
    features: r.roomFeatures || '',
    sellPriority: r.sellPriority,
    view: r.view || '',
  }));
}
```

### Update sell priority:

```typescript
export async function updateRoomSellPriority(roomId: number, priority: number): Promise<void> {
  await prisma.room.update({
    where: { id: roomId },
    data: { sellPriority: priority },
  });
}

export async function bulkUpdateSellPriority(updates: { roomId: number; priority: number }[]): Promise<void> {
  // Transaction: update wiele pokoi naraz
  await prisma.$transaction(
    updates.map(u => prisma.room.update({
      where: { id: u.roomId },
      data: { sellPriority: u.priority },
    }))
  );
}
```

### Modyfikacja istniejących query:

**WAŻNE:** Wszystkie istniejące query pokoi MUSZĄ teraz domyślnie filtrować `isDeleted: false`:
- `getRooms` → dodaj `where: { isDeleted: false, ... }`
- `getRoomsForManagement` → dodaj `where: { isDeleted: false, ... }`
- `getRoomsForHousekeeping` → dodaj `where: { isDeleted: false, ... }`
- TapeChart query → dodaj `where: { isDeleted: false, ... }`

Wyjątek: `getDeletedRooms` — tu właśnie filtrujemy `isDeleted: true`.

## A4. Rozbudowa UI strony `/pokoje`

### Dodaj do formularza pokoju:
```
Priorytet sprzedaży: [ 0 ]  (niższy = wyższy priorytet propozycji)
Opis: [textarea_________________________]
```

### Dodaj do formularza typu pokoju:
```
Opis:          [textarea_________________________]
Maks. osób:    [ 4 ]
Łóżka:         [ 2×DB ]
☑ Widoczny w statystykach
Tłumaczenia:   EN: [Comfort Room    ]  DE: [Komfortzimmer    ]
```

### Dodaj przyciski:
```
[📥 Eksport CSV]  [🗑️ Pokaż usunięte (3)]
```

**Eksport CSV:** Pobiera plik `pokoje-YYYY-MM-DD.csv` z UTF-8 BOM, separator `;`.

**Pokaż usunięte:** Toggle — pokazuje listę soft-deleted pokoi z przyciskiem [Przywróć].

### Drag & drop priorytetu (opcjonalnie):
Opcjonalnie: lista pokoi z drag & drop do ustalania kolejności (sellPriority).
Jeśli za dużo pracy → zwykłe pole numeryczne w formularzu.

## A5. Integracja

### Raporty obłożenia:
W raportach (`getOccupancyReport`, `getOccupancyForProperty` itp.):
```typescript
// Filtruj typy pokoi z visibleInStats = false
const roomTypes = await prisma.roomType.findMany({
  where: { visibleInStats: true },
});
// Używaj tych typów do obliczeń obłożenia
```

### Booking Engine:
W `getBookingAvailability` i `getRoomTypesForBooking`:
- Sortuj pokoje po `sellPriority` ASC (niższy priorytet = proponowany pierwszy)
- Wyświetlaj `RoomType.translations` w odpowiednim języku (jeśli booking engine obsługuje i18n)

### TapeChart:
- Nie wyświetlaj pokoi z `isDeleted: true`
- Sortowanie wierszy: najpierw po `roomType.sortOrder`, potem po `sellPriority`, potem po `number`

---

# ═══════════════════════════════════════════════════════
# CZĘŚĆ 2: WYDARZENIA SPECJALNE NA GRAFIKU
# ═══════════════════════════════════════════════════════

## CEL

Oznaczanie dni z wydarzeniami (np. "Targi", "Sylwester", "Festiwal") na osi czasu grafiku TapeChart.
Odpowiednik KWHotel punkt 2.9 audytu.

## ISTNIEJĄCE ZASOBY

```
Model:   HotelEvent (sprawdź w schema.prisma — prawdopodobnie istnieje)
Strona:  app/wydarzenia/page.tsx (istnieje)
Action:  app/actions/hotel-events.ts (istnieje)
```

**WAŻNE:** Sprawdź najpierw co JEST w `hotel-events.ts` i modelu `HotelEvent`. Jeśli model ma pola `dateFrom`, `dateTo`, `name`, `color` — to wystarczy. Jeśli nie — rozbuduj.

## Model (sprawdź/rozbuduj):

```prisma
model HotelEvent {
  id          Int       @id @default(autoincrement())
  propertyId  Int
  name        String              // "Targi Poznańskie", "Sylwester"
  dateFrom    DateTime
  dateTo      DateTime
  color       String?   @default("#3B82F6")  // kolor na grafiku
  description String?
  isPublic    Boolean   @default(true)  // widoczny na grafiku
  eventType   String?   // "FAIR", "HOLIDAY", "FESTIVAL", "CONFERENCE", "LOCAL", "OTHER"

  property    Property  @relation(fields: [propertyId], references: [id])
}
```

## Integracja z TapeChart

### W `app/actions/tape-chart.ts` — `getTapeChartData`:

Dodaj do zwracanych danych:
```typescript
// Pobierz wydarzenia w zakresie dat grafiku
const events = await prisma.hotelEvent.findMany({
  where: {
    propertyId,
    isPublic: true,
    dateFrom: { lte: dateTo },
    dateTo: { gte: dateFrom },
  },
  orderBy: { dateFrom: 'asc' },
});

return {
  ...existingData,
  events, // dodaj do response
};
```

### W `components/tape-chart/index.tsx` — renderowanie:

Nad główną siatką grafiku, dodaj pasek wydarzeń:

```
┌─ TapeChart ──────────────────────────────────────────────────────────┐
│  Wydarzenia: │        │ 🟦 Targi Poznańskie │        │ 🟨 Sylwester │
│  ────────────┼────────┼─────────────────────┼────────┼──────────────│
│  Pokoje/Dni  │ 25.02  │ 26.02    27.02      │ 28.02  │ 31.12  01.01│
│  ────────────┼────────┼─────────────────────┼────────┼──────────────│
│  101 Comfort │  ▓▓▓▓  │  ▓▓▓▓▓▓  ▓▓▓▓▓▓    │        │  ▓▓▓▓  ▓▓▓▓│
│  102 Suite   │        │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │        │  ▓▓▓▓▓▓▓▓▓▓│
```

Implementacja paska wydarzeń:
```tsx
{/* Wiersz wydarzeń — nad nagłówkami pokoi */}
<div className="flex h-6 border-b bg-gray-50">
  <div className="w-[200px] flex-shrink-0 text-xs text-gray-500 px-2 flex items-center">
    Wydarzenia
  </div>
  <div className="flex-1 relative">
    {events.map(event => {
      const startOffset = daysBetween(chartStartDate, event.dateFrom);
      const duration = daysBetween(event.dateFrom, event.dateTo) + 1;
      return (
        <div
          key={event.id}
          className="absolute top-0.5 h-5 rounded text-[10px] text-white flex items-center px-1 truncate"
          style={{
            left: `${startOffset * columnWidth}px`,
            width: `${duration * columnWidth}px`,
            backgroundColor: event.color || '#3B82F6',
          }}
          title={`${event.name}: ${formatDate(event.dateFrom)} — ${formatDate(event.dateTo)}`}
        >
          {event.name}
        </div>
      );
    })}
  </div>
</div>
```

### Tooltip na hover:
Pokaż pełną nazwę, daty, opis. Użyj shadcn/ui Tooltip lub `title` attribute.

### Klik na wydarzenie (opcjonalnie):
Otwiera dialog edycji wydarzenia → istniejąca strona `/wydarzenia` lub inline dialog.

---

# ═══════════════════════════════════════════════════════
# CZĘŚĆ 3: WYSZUKIWARKA POKOI PO KRYTERIACH
# ═══════════════════════════════════════════════════════

## CEL

Dialog/panel na TapeChart: "Znajdź pokój: 2 osoby, balkon, WiFi, 15-18.03" → lista pasujących pokoi.
Odpowiednik KWHotel punkt 2.14 audytu.

## IMPLEMENTACJA

### Nowy komponent: `components/tape-chart/room-search-dialog.tsx`

```
┌─ Szukaj pokoju ────────────────────────────────────────────────────────┐
│                                                                         │
│  Check-in:  [📅 15.03.2026]    Check-out: [📅 18.03.2026]             │
│  Dorośli: [▼ 2]  Dzieci: [▼ 0]                                        │
│                                                                         │
│  Typ pokoju:  [▼ Dowolny        ]                                      │
│  Piętro:      [▼ Dowolne        ]                                      │
│  Widok:       [▼ Dowolny        ]                                      │
│                                                                         │
│  Wyposażenie (zaznacz wymagane):                                        │
│  ☐ TV  ☐ Minibar  ☐ Klimatyzacja  ☐ Sejf  ☐ Balkon                   │
│  ☐ Łazienka  ☐ WiFi  ☐ Suszarka  ☐ Czajnik                           │
│                                                                         │
│  Cena max: [______] PLN/dobę                                            │
│                                                                         │
│  [🔍 Szukaj]                                                            │
│                                                                         │
│  ┌─ Wyniki ──────────────────────────────────────────────────────────┐  │
│  │  ✅ Pokój 101 (Comfort, p.1) — 2×DB, TV, WiFi, balkon            │  │
│  │     Cena: 350 PLN/dobę × 3 noce = 1050 PLN                       │  │
│  │     [Utwórz rezerwację]  [Pokaż na grafiku]                      │  │
│  │                                                                    │  │
│  │  ✅ Pokój 203 (Comfort, p.2) — 2×DB, TV, WiFi                    │  │
│  │     Cena: 350 PLN/dobę × 3 noce = 1050 PLN                       │  │
│  │     [Utwórz rezerwację]  [Pokaż na grafiku]                      │  │
│  │                                                                    │  │
│  │  ❌ Pokój 102 (Suite, p.1) — zajęty 16-17.03                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Znaleziono: 2 dostępne z 8 pasujących                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Server Action: `app/actions/rooms.ts`

```typescript
export async function searchAvailableRooms(params: {
  propertyId: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  roomTypeId?: number;
  floor?: string;
  view?: string;
  requiredFeatures?: string[];  // ["TV", "WiFi", "Balkon"]
  maxPrice?: number;
}): Promise<{
  available: RoomSearchResult[];
  unavailable: RoomSearchResult[];
}> {
  // 1. Pobierz pokoje pasujące do kryteriów statycznych
  const rooms = await prisma.room.findMany({
    where: {
      propertyId: params.propertyId,
      isDeleted: false,
      activeForSale: true,
      ...(params.roomTypeId && { roomTypeId: params.roomTypeId }),
      ...(params.floor && { floor: params.floor }),
      ...(params.view && { view: params.view }),
      maxOccupancy: { gte: params.adults + (params.children || 0) },
    },
    include: { roomType: true },
    orderBy: [{ sellPriority: 'asc' }, { number: 'asc' }],
  });

  // 2. Filtruj po wyposażeniu (roomFeatures CONTAINS each feature)
  let filtered = rooms;
  if (params.requiredFeatures?.length) {
    filtered = rooms.filter(room => {
      const features = (room.roomFeatures || '').toLowerCase();
      return params.requiredFeatures!.every(f => features.includes(f.toLowerCase()));
    });
  }

  // 3. Sprawdź dostępność (brak kolizji z istniejącymi rezerwacjami)
  const checkIn = new Date(params.checkIn);
  const checkOut = new Date(params.checkOut);

  const conflicting = await prisma.reservation.findMany({
    where: {
      roomId: { in: filtered.map(r => r.id) },
      status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
    select: { roomId: true },
  });

  const conflictingRoomIds = new Set(conflicting.map(r => r.roomId));

  // 4. Pobierz ceny
  // Dla każdego pokoju: getEffectivePriceForRoomOnDate
  const results = await Promise.all(filtered.map(async room => {
    const price = await getEffectivePriceForRoomOnDate({
      roomId: room.id,
      date: params.checkIn,
    });
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    return {
      roomId: room.id,
      roomNumber: room.number,
      roomTypeName: room.roomType?.name || room.type,
      floor: room.floor,
      beds: room.beds,
      features: room.roomFeatures,
      maxOccupancy: room.maxOccupancy,
      pricePerNight: price?.basePrice || room.price,
      totalPrice: (price?.basePrice || room.price || 0) * nights,
      nights,
      isAvailable: !conflictingRoomIds.has(room.id),
      conflictReason: conflictingRoomIds.has(room.id)
        ? `Zajęty w wybranym okresie`
        : null,
    };
  }));

  // 5. Filtruj po cenie max
  let finalResults = results;
  if (params.maxPrice) {
    finalResults = results.filter(r => (r.pricePerNight || 0) <= params.maxPrice!);
  }

  return {
    available: finalResults.filter(r => r.isAvailable),
    unavailable: finalResults.filter(r => !r.isAvailable),
  };
}
```

### Przycisk na TapeChart:

W toolbarze grafiku dodaj:
```tsx
<Button variant="outline" size="sm" onClick={() => setRoomSearchOpen(true)}>
  <Search className="h-3 w-3 mr-1" /> Szukaj pokoju
</Button>
```

### "Utwórz rezerwację" z wyniku:
Klik → otwiera okno tworzenia rezerwacji z pre-filled: roomId, checkIn, checkOut, adults, children.

### "Pokaż na grafiku":
Klik → zamyka dialog, scrolluje TapeChart do tego pokoju i zaznacza go (highlight na 2 sekundy).

---

# CHECKLIST

## Zarządzanie pokojami:
- [ ] RoomType: pole `visibleInStats` istnieje i działa
- [ ] RoomType: pole `translations` (Json) istnieje
- [ ] RoomType: pole `description` istnieje
- [ ] Room: pole `sellPriority` istnieje
- [ ] Room: pole `isDeleted` + `deletedAt` + `deletedBy` istnieją
- [ ] Soft-delete działa (nie usuwa fizycznie, ustawia flagę)
- [ ] Soft-delete: sprawdza czy brak aktywnych rezerwacji
- [ ] Przywracanie pokoju działa
- [ ] Lista usuniętych pokoi widoczna w UI (toggle)
- [ ] Eksport pokoi CSV działa (UTF-8 BOM, separator `;`)
- [ ] Formularz typu pokoju: pole "Widoczny w statystykach" checkbox
- [ ] Formularz typu pokoju: pole tłumaczeń (EN, DE)
- [ ] Formularz pokoju: pole "Priorytet sprzedaży"
- [ ] Istniejące query filtrują `isDeleted: false`
- [ ] Raporty obłożenia: pomijają typy z `visibleInStats = false`
- [ ] TapeChart: nie wyświetla usuniętych pokoi
- [ ] Booking engine: sortuje po sellPriority

## Wydarzenia na grafiku:
- [ ] Model HotelEvent ma pola: dateFrom, dateTo, name, color, isPublic
- [ ] getTapeChartData zwraca events[]
- [ ] Pasek wydarzeń widoczny nad siatką TapeChart
- [ ] Wydarzenie renderowane z kolorowym tłem i nazwą
- [ ] Tooltip na hover z pełnymi danymi
- [ ] Wielodniowe wydarzenia rozciągają się na odpowiednią szerokość

## Wyszukiwarka pokoi:
- [ ] Przycisk "Szukaj pokoju" na toolbarze TapeChart
- [ ] Dialog z polami: daty, dorośli, dzieci, typ, piętro, widok, wyposażenie, cena max
- [ ] searchAvailableRooms zwraca available + unavailable
- [ ] Wyniki: dostępne (zielone) i niedostępne (szare) z ceną
- [ ] "Utwórz rezerwację" z wyniku → otwiera formularz pre-filled
- [ ] "Pokaż na grafiku" → scroll do pokoju

## Nic nie zepsute:
- [ ] TapeChart nadal działa (drag & drop, kolory, klik)
- [ ] Strona /pokoje nadal działa
- [ ] Dashboard nadal działa
- [ ] Booking engine nadal działa