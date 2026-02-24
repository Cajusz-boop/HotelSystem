# Prompt: Bezbłędny drag & drop w Tape Chart (kafelek = dokładnie tam, gdzie upuszczony)

## Kontekst

- **Projekt:** Next.js 14, TypeScript, @dnd-kit/core.
- **Widok:** Tape Chart – siatka pokoi (wiersze) × daty (kolumny). Rezerwacje to „kafelki” (paski) w komórkach.
- **Wymaganie:** Użytkownik łapie kafelek i upuszcza go. Kafelek **musi** wylądować w **tej komórce** (ten pokój, ten dzień), na którą użytkownik go upuścił. Bez wyjątków i bez „zasad” (np. „przy zmianie pokoju nie zmieniaj dat”).

## Obecny problem

**Implementacja:** Cel dropu jest wyliczany **matematycznie** z pozycji kursora (lub ostatniej pozycji nad siatką):

1. W `handleDragEnd` używana jest pozycja z `pointerPosRef` (śledzona w `pointermove`) lub fallback z `over.id` (tylko pokój: `room-XXX`).
2. Funkcja `getDropTarget(clientX, clientY)` liczy:
   - `localX = scrollLeft + (clientX - rect.left)`, `localY = scrollTop + (clientY - rect.top)`
   - `colIndex = floor((localX - ROOM_LABEL_WIDTH_PX) / effectiveColumnWidthPx)`
   - `rowIndex = floor((localY - headerHeight) / effectiveRowHeightPx)`
   - Zwraca `{ room: displayRooms[rowIndex], date: dates[colIndex] }`.

**Efekt:** Kafelek często „ucieka” na inną datę (np. użytkownik celuje 6.03, a ląduje 16.03 lub 26.03). Przyczyny:

- Pozycja kursora w momencie puszczenia bywa poza siatką (scrollbar, brzeg okna) lub w innym miejscu niż środek kafelka.
- Siatka ma sticky header, przewijanie (scrollLeft/scrollTop), wirtualizację wierszy (@tanstack/react-virtual) – błąd w którymkolwiek elemencie (ref, padding, wysokość nagłówka) daje zły `colIndex`/`rowIndex`.
- Nawet z zabezpieczeniami („tylko gdy kursor nad siatką”, cap `daysDiff`, fallback na `over` z tymi samymi datami) wynik nie jest w 100% przewidywalny.

**Obecne droppables:** Tylko **wiersze pokoi** – `useDroppable({ id: \`room-${room.number}\` })` w `RoomRowDroppable`. Daje to **pokój** przy dropie, ale **nie** datę. Data jest zawsze z matematyki współrzędnych.

## Jedyna naprawdę bezbłędna metoda

**Cel dropu musi wynikać z tego, na którym elemencie DOM użytkownik upuścił kafelek**, a nie z równań na (clientX, clientY).

Czyli: **jedna droppable na komórkę** (pokój × data), z id np. `cell-${room.number}-${dateStr}` (np. `cell-008-2026-03-06`). W `handleDragEnd` odczytujesz `over.id`, parsujesz pokój i datę – **zero matematyki** dla celu.

**Obawa:** „Nie używaj useDroppable na komórkach – przy 28 pokojach × 365 dni to 10000+ droppables.”

**Rozwiązanie:** **Wirtualizacja droppables** – tak jak wiersze są wirtualizowane (renderujesz tylko widoczne), tak **komórki** (lub całe wiersze z droppable per data) mogą być wirtualizowane:

- Siatka już ma **wirtualizację wierszy** (np. ~15 widocznych wierszy). Kolumny dat są wszystkie w DOM (np. 42 w „Tydzień”, 93 w „Miesiąc”).
- **Opcja A:** Jedna droppable **na komórkę**, ale tylko dla **widocznych** wierszy i (opcjonalnie) widocznych kolumn. Np. 15 wierszy × 42 kolumny = 630 droppables w widoku „Tydzień”. To akceptowalne.
- **Opcja B:** Wirtualizacja też w poziomie (np. tylko 20 widocznych kolumn) → 15×20 = 300 droppables. Jeszcze mniej.

Każda **widoczna** komórka (np. `<div data-cell data-room="008" data-date="2026-03-06">`) ma `useDroppable({ id: \`cell-008-2026-03-06\` })`. Przy dropie `over.id` to dokładnie ta komórka. Parsowanie: `const [_, roomNumber, dateStr] = over.id.match(/^cell-(.+)-(\d{4}-\d{2}-\d{2})$/);` → `target = { room: roomByNumber.get(roomNumber), date: dateStr }`. Koniec – bez `getDropTarget`, bez `pointerPosRef`, bez scrollLeft/scrollTop w logice dropu.

## Co trzeba zmienić w kodzie (krótko)

1. **Droppable na komórce, nie tylko na wierszu**
   - Obecnie: w każdym wierszu jest `RoomRowDroppable` z jednym `useDroppable({ id: room-${room.number} })` na etykiecie pokoju (lewa kolumna).
   - Docelowo: każda **komórka** obszaru dat (nie nagłówek) w widocznym wierszu ma swoją droppable z id `cell-${room.number}-${dateStr}`. Można to zrobić np. przez komponent `CellDroppable` w miejscu, gdzie teraz renderujesz pustą komórkę lub tło dla pasków.

2. **Struktura siatki**
   - Plik: `components/tape-chart/index.tsx`.
   - Wiersze: pętla po `virtualRows` (virtualizer), każdy wiersz to pokój z `displayRooms[virtualRow.index]`.
   - W każdej komórce daty (obecnie pewnie jeden div na wiersz z gridem kolumn) trzeba umieścić element z `useDroppable({ id: \`cell-${room.number}-${dateStr}\` })` dla każdej pary (room, dateStr) w widocznym zakresie. Jeśli nie chcesz 42 droppables na wiersz, można rozważyć wirtualizację kolumn (wtedy tylko widoczne kolumny mają droppable).

3. **handleDragEnd**
   - Zamiast `getDropTarget(pointerPosRef.current.x, pointerPosRef.current.y)` i fallbacku na `over.id.startsWith("room-")`:
   - Jeśli `over?.id` jest w formacie `cell-ROOM-DATE` (np. `cell-008-2026-03-06`), parsuj pokój i datę z `over.id` i ustaw `target = { room, date }`.
   - Opcjonalnie: jeśli dla kompatybilności wstecznej zostawiasz `room-XXX` (np. drop na etykiecie pokoju), wtedy fallback: `target = { room, date: reservation.checkIn }`.
   - Usuń lub zostaw tylko jako zapas (np. gdy over === null) logikę z `pointerPosRef` i `getDropTarget`.

4. **Stałe / refy**
   - `gridWrapperRef` – może zostać do innych celów (np. pan, scroll). Do **celu dropu** nie używaj już `getDropTarget` opartego o współrzędne.
   - `pointerPosRef`, `isPointerOverGrid`, cap `daysDiff` – można usunąć w kontekście wyznaczania celu; ewentualnie zostaw tylko do debugowania.

5. **Wydajność**
   - @dnd-kit radzi sobie z setami droppables w rozsądnych rozmiarach. 300–600 aktywnych droppables (widoczne komórki) to typowy zakres. Unikaj tylko dziesiątek tysięcy (np. 28×365 bez wirtualizacji kolumn).

## Pliki do edycji

- `components/tape-chart/index.tsx` – główna logika: gdzie renderowane są wiersze/komórki, dodać droppable per komórka; w `handleDragEnd` parsować `over.id` z formatu `cell-ROOM-DATE`.
- Ewentualnie nowy mały komponent `CellDroppable` (lub rozszerzenie `RoomRowDroppable`) żeby każda komórka daty miała `useDroppable`.

## Oczekiwany rezultat

- Użytkownik przeciąga kafelek i puszcza na konkretną komórkę (pokój X, dzień Y).
- Kafelek ląduje **zawsze** w tej komórce (pokój X, data Y), bez „uciekania” na inne dni.
- Nie trzeba trzymać się żadnych specjalnych zasad (np. „puść na wierszu”, „nie ruszaj dat”) – po prostu: gdzie upuścisz, tam ląduje.

## Podsumowanie dla AI

Zastąp wyznaczanie celu dropu z **współrzędnych** (getDropTarget + pointerPosRef) przez **droppable na każdej widocznej komórce** z id `cell-${room.number}-${dateStr}`. W handleDragEnd weź pokój i datę z `over.id`. To jedyna metoda gwarantująca, że kafelek ląduje dokładnie tam, gdzie użytkownik go upuścił.
