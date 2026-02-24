# Podsumowanie: przeciąganie pasków rezerwacji na wykresie Gantta

## Cel

Użytkownik chciał:
1. **Przeciągać paski rezerwacji** na inny termin (datę) i inny pokój
2. **Anulacje miały znikać** z wykresu
3. **Double-click** otwiera edycję rezerwacji (zamiast pojedynczego kliknięcia)
4. **Kursor „łapka”** (grabbing) podczas trzymania paska
5. **Możliwość przesuwania dalej** – auto-przewijanie przy krawędziach

## Co działa słabo (feedback użytkownika)

- Przeciąganie nie działa poprawnie / niezawodnie
- Trzeba debugować i poprawić

---

## 1. Ukrywanie anulacji z wykresu Gantta

**Plik:** `app/actions/tape-chart.ts`

**Zmiana:** W zapytaniu Prisma dodałem filtr `status: { notIn: ["CANCELLED", "NO_SHOW"] }` do `reservationWhere`:

```typescript
const reservationWhere = {
  ...(filterByRoomIds ? { roomId: { in: roomIds! } } : {}),
  ...(propertyId ? { room: { propertyId } } : {}),
  status: { notIn: ["CANCELLED", "NO_SHOW"] },  // <-- DODANE
  checkOut: { gte: dateFrom },
  checkIn: { lte: dateTo },
};
```

---

## 2. Przeciąganie pasków – komórki jako droppable

**Plik:** `components/tape-chart/index.tsx`

### 2a. Komponent `CellDroppable` – każda komórka (pokój + data) to strefa upuszczenia

```typescript
function parseCellId(id: string): { roomNumber: string; dateStr: string } | null {
  if (!id.startsWith("cell-")) return null;
  const rest = id.slice(5);
  const sep = rest.indexOf("__");
  if (sep < 0) return null;
  return { roomNumber: rest.slice(0, sep), dateStr: rest.slice(sep + 2) };
}

const CellDroppable = memo(function CellDroppable({
  roomNumber, dateStr, rowIdx, colIdx, columnWidthPx, rowHeightPx,
  isBlocked, saturday, sunday, isFocused, isDirty, blockedReason,
  onCellClick, children,
}: { ... }) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${roomNumber}__${dateStr}` });
  return (
    <div ref={setNodeRef} data-cell data-date={dateStr} data-room={roomNumber} ...>
      {children}
    </div>
  );
});
```

### 2b. `RoomRowDroppable` – w `dates.map()` zamiast zwykłego `div` jest `CellDroppable`

### 2c. `handleDragMove` – obsługa `cell-` i `room-`

- Gdy `overId.startsWith("cell-")`: parsuje `roomNumber` i `dateStr`, wylicza nowe `checkIn`/`checkOut` z zachowaniem liczby nocy.
- Gdy `overId.startsWith("room-")`: zmienia tylko pokój, daty bez zmian.

### 2d. `handleDragEnd` – logika upuszczenia

- `cell-`: zmiana pokoju i/lub dat przez `updateReservation`.
- `room-`: tylko zmiana pokoju przez `moveReservation`.
- Walidacja: status pokoju (DIRTY, OOO, INSPECTION), Room Block.
- Po udanym upuszczeniu: toast, aktualizacja stanu rezerwacji.

---

## 3. Ograniczenie przeciągania do aktywnych rezerwacji

**Plik:** `components/tape-chart/reservation-bar.tsx`

```typescript
const canDrag = reservation.status === "CONFIRMED" || reservation.status === "CHECKED_IN";
const { attributes, listeners, setNodeRef } = useDraggable({
  id: reservation.id,
  data: { type: "reservation", reservation },
  disabled: !canDrag,
});
```

---

## 4. Blokada propagacji zdarzeń (konflikt z panowaniem siatki)

**Plik:** `components/tape-chart/index.tsx`

Na wrapperze paska rezerwacji:

```tsx
onPointerDown={(e) => e.stopPropagation()}
onMouseDown={(e) => e.stopPropagation()}
```

Ma to zapobiec przechwyceniu zdarzeń przez handler przewijania siatki.

---

## 5. Sensor dnd-kit

**Plik:** `components/tape-chart/index.tsx`

```typescript
const pointerSensor = useSensor(ConditionalPointerSensor as any, {
  requireShift: !dragWithoutShift,  // gdy dragWithoutShift=true, nie trzeba trzymać Shift
  activationConstraint: { distance: 5, tolerance: 5 },
});
```

`dragWithoutShift` jest w state (domyślnie `true`), można je zmienić przełącznikiem „Drag bez Shift” w panelu filtrów.

---

## 6. Auto-przewijanie przy krawędziach podczas przeciągania

**Plik:** `components/tape-chart/index.tsx`

```typescript
useEffect(() => {
  if (!activeId) return;
  const el = scrollContainerRef.current;
  if (!el) return;
  let rafId: number | null = null;
  const onPointerMove = (e: PointerEvent) => {
    rafId = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX, y = e.clientY;
      const threshold = 80;
      let dx = 0, dy = 0;
      if (x < rect.left + threshold && x > rect.left) dx = -12;
      else if (x > rect.right - threshold && x < rect.right) dx = 12;
      if (y < rect.top + threshold && y > rect.top) dy = -12;
      else if (y > rect.bottom - threshold && y < rect.bottom) dy = 12;
      if (dx !== 0 || dy !== 0) {
        el.scrollLeft += dx;
        el.scrollTop += dy;
      }
    });
  };
  document.addEventListener("pointermove", onPointerMove, { passive: true });
  return () => {
    document.removeEventListener("pointermove", onPointerMove);
    if (rafId != null) cancelAnimationFrame(rafId);
  };
}, [activeId]);
```

---

## 7. Kursor „grabbing” podczas przeciągania

**Plik:** `components/tape-chart/index.tsx` – w `DndContext`:

```tsx
onDragStart={({ active }) => {
  setActiveId(active.id as string);
  document.body.style.cursor = "grabbing";
}}
onDragEnd={(e) => {
  document.body.style.cursor = "";
  handleDragEnd(e);
}}
onDragCancel={() => {
  setActiveId(null);
  setGhostPreview(null);
  document.body.style.cursor = "";
}}
```

---

## 8. Double-click otwiera edycję rezerwacji

**Plik:** `components/tape-chart/reservation-bar-with-menu.tsx`

- `onClick={handleBarClick}` zamienione na `onDoubleClick={handleBarDoubleClick}`.

**Plik:** `components/tape-chart/index.tsx`

- W wrapperze paska: pojedyncze kliknięcie – tylko multi-select (Ctrl) albo utworzenie rezerwacji przy kliknięciu w dzień checkout.
- Nowy `onDoubleClick` – otwiera edycję rezerwacji (ustawia `selectedReservation` i otwiera sheet).

---

## Importy

**Plik:** `components/tape-chart/index.tsx`

```typescript
import { moveReservation, updateReservation, updateReservationStatus } from "@/app/actions/reservations";
```

---

## Możliwe przyczyny problemów

1. **Zbyt dużo droppables** – każdej komórce odpowiada `useDroppable`. Przy wielu pokojach i datach może to wpływać na wydajność lub collision detection.
2. **Collision detection dnd-kit** – domyślny algorytm może nie pasować do gęstej siatki. Warto sprawdzić `pointerWithin` vs `closestCenter` w `DndContext`.
3. **Scroll** – `scrollContainerRef` obejmuje grid; pozycjonowanie droppables przy scrollu może wymagać aktualizacji rectów.
4. **Overlay z paskami** – paski są w overlayu z `pointer-events-none`, a ich wrapper ma `pointer-events-auto`. Konflikty z `stopPropagation` mogą blokować zdarzenia.
5. **`ConditionalPointerSensor`** – wymaga Shift (jeśli `dragWithoutShift=false`). Sprawdź ustawienia przełącznika.
6. **`activationConstraint`** – `distance: 5` oznacza minimalny ruch przed rozpoczęciem przeciągania. Na niektórych urządzeniach może być trudne do wykonania.

---

## Pliki do sprawdzenia

- `app/actions/tape-chart.ts` – filtr anulacji
- `app/actions/reservations.ts` – `moveReservation`, `updateReservation`
- `components/tape-chart/index.tsx` – główna logika przeciągania
- `components/tape-chart/reservation-bar.tsx` – `useDraggable`
- `components/tape-chart/reservation-bar-with-menu.tsx` – double-click
- `lib/tape-chart-types.ts` – typy `Room`, `Reservation` (np. `RoomBlock`)

---

## Propozycje debugowania

1. Logować `onDragStart`, `onDragMove`, `onDragEnd` – sprawdzić, czy w ogóle się wywołują.
2. Sprawdzić, czy `over` w `handleDragMove`/`handleDragEnd` nie jest `null` przy upuszczeniu.
3. Przetestować `collisionDetection` w `DndContext` (np. `pointerWithin`).
4. Tymczasowo wyłączyć `stopPropagation` na wrapperze paska i zobaczyć, czy drag zaczyna działać.
5. Dodać `DragOverlay` z dnd-kit – przeciągany element jest w overlayu, co może stabilizować zachowanie.

---

## Pełne fragmenty kodu do skopiowania

### reservation-bar-with-menu.tsx – cały plik

Plik: `components/tape-chart/reservation-bar-with-menu.tsx` – zawiera:
- `handleBarDoubleClick` (linie 308–315) – double-click otwiera edycję
- `onDoubleClick={handleBarDoubleClick}` na div wewnątrz ContextMenuTrigger (linia 331)
- `ReservationBar` wewnątrz – ma `useDraggable` z `reservation.id` (w reservation-bar.tsx)

### index.tsx – DndContext i wrapper paska

**DndContext** (linie ~2024–2039):

```tsx
<DndContext
  sensors={sensors}
  onDragStart={({ active }) => {
    setActiveId(active.id as string);
    document.body.style.cursor = "grabbing";
  }}
  onDragMove={handleDragMove}
  onDragEnd={(e) => {
    document.body.style.cursor = "";
    handleDragEnd(e);
  }}
  onDragCancel={() => {
    setActiveId(null);
    setGhostPreview(null);
    document.body.style.cursor = "";
  }}
>
```

**Sensors** (linie ~1349–1354):

```tsx
const pointerSensor = useSensor(ConditionalPointerSensor as any, {
  requireShift: !dragWithoutShift,
  activationConstraint: { distance: 5, tolerance: 5 },
});
const sensors = useSensors(pointerSensor);
```

**Wrapper paska** – NIE MA DragOverlay. Paski są w overlay div z `pointer-events-none`, każdy pasek ma `pointer-events-auto`:

```tsx
{/* Overlay – container ma pointer-events-none */}
<div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 50, ... display: "grid" }}>
  {reservationPlacements.map(({ reservation, ... }) => (
    <div
      key={reservation.id}
      className="pointer-events-auto overflow-hidden flex items-center relative ..."
      data-reservation-id={reservation.id}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={...}
      onDoubleClick={...}
    >
      <div className="absolute inset-y-0 flex items-stretch" style={{ left: ..., width: ... }}>
        <ReservationBarWithMenu reservation={reservation} isDragging={activeId === reservation.id} ... />
      </div>
    </div>
  ))}
  {/* Ghost preview – custom, nie DragOverlay */}
  {ghostPlacement && <div className="pointer-events-none ...">...</div>}
</div>
```

**Struktura:**
- `ReservationBarWithMenu` → wewnątrz `ReservationBar` (ma `useDraggable` + `{...listeners}` `{...attributes}`)
- Brak `DragOverlay` – pasek pozostaje na miejscu podczas drag, pokazywany jest tylko custom ghost preview
- `ContextMenuTrigger` owija `ReservationBar` – może wpływać na zdarzenia
