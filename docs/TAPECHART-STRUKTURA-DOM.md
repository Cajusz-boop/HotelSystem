# TapeChart – dokładna struktura DOM i kod

## 1. Pełny HTML paska rezerwacji (z kodu React)

Pasek AMBROZIAK ROBERT (pokój 002) renderuje się jako:

```html
<!-- OVERLAY CONTAINER (display: grid) - index.tsx linia 2839 -->
<div
  class="absolute inset-0 pointer-events-none overflow-visible"
  style="z-index: 50; grid-template-columns: 140px repeat(42, 100px); grid-template-rows: 40px repeat(28, 24px); display: grid"
>
  <!-- GRID CELL (bezpośrednie dziecko grid) - index.tsx linia 2868 -->
  <div
    data-reservation-id="<id>"
    class="overflow-hidden flex items-center relative pointer-events-none cursor-grab active:cursor-grabbing"
    style="grid-column: 2 / 6; grid-row: 1; align-self: stretch; min-height: 24; margin-bottom: -1px"
  >
    <!-- INNER WRAPPER - index.tsx linia 2891 -->
    <div
      class="absolute inset-y-0 flex items-stretch pointer-events-auto"
      style="left: 12.5%; width: 75%; min-width: 0"
    >
      <!-- ReservationBarWithMenu wrapper -->
      <div class="relative h-full w-full">
        <!-- ReservationBar - reservation-bar.tsx linia 312 -->
        <div
          data-testid="reservation-bar"
          data-reservation-id="<id>"
          class="relative z-10 flex h-full w-full min-h-0 flex-col justify-center ..."
          style="grid-row: 0; grid-column: 0 / 0; background: ...; clipPath: ..."
        >
          AMBROZIAK ROBERT
        </div>
      </div>
    </div>
  </div>
</div>
```

Uwaga: gridRow w ReservationBar to 0/0 (nieużywane – pozycjonowanie jest na rodzicu). **Grid cell** ma `grid-column` i `grid-row` – to jest element pozycjonowany przez CSS Grid.

---

## 2. DOSŁOWNY kod renderowania paska (index.tsx 2867–2890)

```tsx
return (
  <div
    key={reservation.id}
    className={cn(
      "overflow-hidden flex items-center relative pointer-events-none",
      previewMode ? "cursor-default" : "cursor-grab active:cursor-grabbing",
      highlightedReservationId === reservation.id && "ring-2 ring-primary rounded-md z-10",
      selectedReservationIds.has(reservation.id) && "ring-2 ring-amber-500 rounded-md"
    )}
    data-reservation-id={reservation.id}
    style={{
      gridColumn: `${gridColumnStart} / ${gridColumnEnd}`,
      gridRow,
      alignSelf: "stretch",
      minHeight: barHeightPx,
      marginBottom: -1,
    }}
  >
    <div
      className={cn("absolute inset-y-0 flex items-stretch", isSelecting ? "pointer-events-none" : "pointer-events-auto")}
      style={{ left: `${(barLeftPercent ?? 0) * 100}%`, width: `${barWidthPercent * 100}%`, minWidth: 0 }}
      onClick={...}
    >
      <ReservationBarWithMenu ... />
    </div>
  </div>
);
```

Pasek jest **bezpośrednim dzieckiem** CSS Grid. Pozycjonowanie przez `grid-row` i `grid-column`.

---

## 3. reservation-bar-with-menu.tsx (470–499)

```tsx
return (
  <ContextMenu onOpenChange={...}>
    <ContextMenuTrigger asChild>
      <div className="relative h-full w-full" onTouchStart={...} ...>
        <ReservationBar
          reservation={reservation}
          gridRow={gridRow}           // przekazywane 0 z index.tsx
          gridColumnStart={gridColumnStart}
          gridColumnEnd={gridColumnEnd}
          ...
        />
      </div>
    </ContextMenuTrigger>
    ...
  </ContextMenu>
);
```

ReservationBar ma `gridRow: 0`, `gridColumnStart: 0`, `gridColumnEnd: 0` – te wartości nie wpływają na layout (bar jest wewnątrz flex/absolute). Pozycjonowanie odbywa się wyżej – w **grid cell** w `index.tsx`.

---

## 4. reservation-bar.tsx (311–347) – style inline

```tsx
<div
  ref={setRef}
  data-testid="reservation-bar"
  data-reservation-id={reservation.id}
  className="relative z-10 flex h-full w-full min-h-0 flex-col justify-center gap-0 text-xs leading-snug ..."
  style={{
    gridRow,
    gridColumn: `${gridColumnStart} / ${gridColumnEnd}`,
    background: bgGradient,
    boxShadow: barShadow,
    clipPath,
    WebkitClipPath: clipPath,
    userSelect: "none",
    touchAction: "none",
  }}
>
```

ReservationBar sam ustawia `gridRow`/`gridColumn`, ale nie jest dzieckiem grid – jest głęboko wewnątrz drzewa. **Grid child** to div z index.tsx (linia 2868).

---

## 5. Virtualizacja

**Biblioteka:** `@tanstack/react-virtual` (import w index.tsx linia 4)

```tsx
const rowVirtualizer = useVirtualizer({
  count: displayRooms.length,
  getScrollElement: () => scrollContainerRef.current,
  estimateSize: () => effectiveRowHeightPx,
  overscan: 12,
  paddingStart: totalHeaderPx,
});
```

Virtualizer **nie renderuje pasków**. Virtualizowane są **wiersze pokoi** (room rows):

```tsx
// index.tsx 2718–2731 – wirtualizowane wiersze
{virtualRows.map((virtualRow) => (
  <div
    key={...}
    style={{
      top: virtualRow.start - totalHeaderPx,
      height: virtualRow.size,
      gridTemplateColumns: gridColumns,
      gridTemplateRows: "1fr",
    }}
  >
    <RoomRowDroppable ... />  // komórki + etykiety pokoi
  </div>
))}
```

Paski są w **osobnym overlay**, który **nie jest** virtualizowany:

```tsx
// index.tsx 2839–2842
<div
  className="absolute inset-0 pointer-events-none overflow-visible"
  style={{ zIndex: 50, gridTemplateColumns: gridColumns, gridTemplateRows: gridRows, display: "grid" }}
>
  {visiblePlacements.map(...)}  // wszystkie widoczne paski
</div>
```

**Synchronizacja overlay z wierszami:**

- Overlay ma `gridTemplateRows: 40px repeat(28, 24px)` (header + pokoje)
- `visiblePlacements` = `reservationPlacements.filter(p => visibleRowSet.has(p.gridRow))`
- `visibleRowSet` = `virtualRows.map(v => v.index + 1 + headerRowCount)` – indeksy wierszy widocznych w virtualizerze
- `reservationPlacements` – `gridRow = roomRowIndex.get(res.room) + headerRowCount`

Overlay i wiersze pokoi używają tej samej definicji grid (`gridRows`), ale:
- wiersze pokoi są w kontenerze z `position: absolute` + `top`/`height` od virtualizera,
- overlay to jeden element `display: grid` obejmujący cały obszar.

Przy zoomie przeglądarki `virtualRow.start`/`virtualRow.size` i rozmiary grid mogą się rozjeżdżać, jeśli virtualizer mierzy DOM.

---

## 6. CSS Grid container TapeChart

**Overlay (paski):**
```tsx
// index.tsx 2839–2841
<div
  style={{
    zIndex: 50,
    gridTemplateColumns: gridColumns,   // "140px repeat(N, 100px)"
    gridTemplateRows: gridRows,        // "40px repeat(M, 24px)"
    display: "grid"
  }}
>
```

**Definicje:**
```tsx
// index.tsx 2099–2104
const gridColumns = `${ROOM_LABEL_WIDTH_PX}px repeat(${dates.length}, ${effectiveColumnWidthPx}px)`;
// np. "140px repeat(42, 100px)"

const gridRows = hasEvents
  ? `${EVENTS_ROW_PX}px ${HEADER_ROW_PX}px repeat(${displayRooms.length}, ${effectiveRowHeightPx}px)`
  : `${HEADER_ROW_PX}px repeat(${displayRooms.length}, ${effectiveRowHeightPx}px)`;
// np. "40px repeat(28, 24px)"
```

**Stałe:**
```ts
ROOM_LABEL_WIDTH_PX = 140
HEADER_ROW_PX = 40
EVENTS_ROW_PX = 24
effectiveRowHeightPx = ROW_HEIGHT_PX * zoomMultiplier  // 24 * 1 = 24
effectiveColumnWidthPx = COLUMN_WIDTH_PX  // 100 (Tydzień)
```

---

## 7. Pobieranie computed styles (100% vs 125%)

Uruchom:

```powershell
cd c:\HotelSystem
npm run dev
# w drugim terminalu (po zalogowaniu na front-office):
npx playwright test Test/debug-tape-chart-styles.ts --headed
```

Skrypt ustawia `document.body.style.zoom = "1.25"` i loguje computed styles paska i jego rodzica grid w konsoli.
