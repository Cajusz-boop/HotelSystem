# Problem: pierwszy drag po odświeżeniu → biała strona / "ładowanie" ~1s; kolejne kafelki OK; celność dropu rośnie z czasem

## Objawy

1. **Po odświeżeniu strony** (`/front-office`): użytkownik łapie **pierwszy** kafelek (rezerwację) i przeciąga.
2. **Strona robi się na ~1 s biała**, widać coś w stylu "ładowanie" (tekst lub overlay).
3. **Kolejne przeciągania** działają normalnie – bez białej strony.
4. **Im dłużej użytkownik przemieszcza kafelki**, tym **lepiej trafiają w cel** (drop jest coraz precyzyjniejszy).

## Kontekst techniczny

- **Stack:** Next.js 14, React 18, `@dnd-kit/core` (Pointer sensor), Tape Chart w `components/tape-chart/index.tsx`.
- **Drop:** W `handleDragEnd` używane jest `document.elementsFromPoint(x, y)` z pozycją z `pointerup`/`pointercancel` (lub fallback na środek overlayu). Szukany jest element z `data-room` i `data-date` (komórka siatki).
- **Drag overlay:** `DragOverlay` z kopią paska, atrybut `data-dnd-overlay`, przy drop ustawiane `pointerEvents = "none"` na overlayu przed hit-testem.
- Komórki siatki są w wirtualizowanych wierszach (`virtualRows`), renderowane tylko gdy `mounted === true`.

## Hipotezy

### A) Biała strona / "ładowanie" przy pierwszym dragu

- **Lazy load przy pierwszym użyciu:** Pierwsze przeciągnięcie może uruchamiać dynamiczny import (np. `dynamic(..., { ssr: false })`) komponentu związanego z drag-and-drop, edycją rezerwacji lub overlayem → Suspense pokazuje fallback ("ładowanie") na ~1 s.
- **Duży re-render:** Pierwszy drag (np. `setActiveId` lub stan overlayu) powoduje masywny re-render lub pierwsze wymierzenie layoutu (ResizeObserver, virtualizer) → blokada main thread lub krótkie "puste" renderowanie.
- **Pełnoekranowy loading:** Gdzieś w drzewie przy pierwszej akcji drag (lub przy pierwszym `moveReservation`) pokazywany jest stan ładowania obejmujący cały ekran.

**Co sprawdzić:**  
W `components/tape-chart/index.tsx` i powiązanych plikach: czy przy pierwszym dragu (onDragStart, setActiveId, DragOverlay, lub wywołanie akcji) renderowany jest komponent ładowany przez `dynamic(..., { ssr: false })` lub `React.lazy`, albo czy jest warunek typu "loading" który pokrywa całą stronę. Przeszukać: `dynamic(`, `lazy(`, `Suspense`, oraz stany typu `isLoading`/`loading` ustawiane w handlerach dragu.

### B) Lepsza celność dropu po kilku przeciągnięciach

- **Layout/measurements nie gotowe przy pierwszym dropie:** Przy pierwszym dropie `getBoundingClientRect()` dla komórek lub overlayu może zwracać złe wartości (np. 0, lub z przed wirtualizacji), a `elementsFromPoint(x, y)` trafia w niewłaściwy element lub w nic. Po kolejnych interakcjach layout się "ustawia" (virtualizer, scroll, ResizeObserver) i pomiary są poprawne.
- **Pozycja kursora:** Przy pierwszym puszczeniu `pointerPosRef` lub pozycja z overlayu może być jeszcze niezsynchronizowana; po kilku dragach jest już poprawna.

**Co sprawdzić:**  
Czy przed pierwszym dropem można wymusić "layout pass" (np. requestAnimationFrame, odczyt `getBoundingClientRect()` na kontenerze siatki w onDragStart, lub krótkie opóźnienie przed użyciem `elementsFromPoint` w handleDragEnd). Czy komórki z `data-room`/`data-date` są w DOM pod kursorem w momencie dropu (np. czy wirtualizacja nie usuwa wiersza spod kursora).

## Proponowane kierunki rozwiązania

1. **Usunąć lub złagodzić "ładowanie" przy pierwszym dragu**
   - Zlokalizować źródło białej strony / tekstu "ładowanie" (Suspense fallback? pełnoekranowy loading?).
   - Ewentualnie: preloadować komponenty używane przy dragu (np. overlay, dialog edycji) przy pierwszym wejściu na stronę lub przy pierwszym hoverze nad paskiem, żeby pierwszy drag nie uruchamiał lazy load.
   - Unikać pełnoekranowego overlayu ładowania dla pojedynczej akcji drag (jeśli jest – zastąpić np. małym spinnerem przy kursorze lub brak wizualnego ładowania).

2. **Stabilizacja celności dropu od pierwszego razu**
   - W `handleDragEnd`: przed `elementsFromPoint(x, y)` wywołać np. `requestAnimationFrame` (lub podwójny rAF), żeby przeglądarka dokończyła layout/paint; dopiero potem odczytać elementy.
   - Opcjonalnie: w `onDragStart` (lub przy pierwszym dragu) wymusić odczyt layoutu siatki (np. `gridWrapperRef.current?.getBoundingClientRect()` lub odczyt jednej komórki), żeby virtualizer/layout był już "ogrzany".
   - Upewnić się, że używana pozycja do hit-testu (środek overlayu lub pozycja z pointerup) jest tą samą, pod którą w DOM są komórki (uwzględnienie scrollLeft/scrollTop jeśli potrzeba).

3. **Weryfikacja**
   - Po zmianach: odświeżyć stronę, od razu złapać pierwszy kafelek i przeciągnąć → nie powinno być białej strony ani "ładowania" przez ~1 s.
   - Pierwszy drop powinien od razu trafiać w oczekiwany pokój/datę (bez konieczności kilku "rozgrzewających" przeciągnięć).

## Kluczowe pliki

- `components/tape-chart/index.tsx` – TapeChart, handleDragEnd, pointerPosRef, DragOverlay, mounted, virtualRows, komórki z data-room/data-date.
- `components/tape-chart/reservation-bar.tsx` – useDraggable, początek dragu.
- Dynamiczne importy w tape-chart: `dynamic(..., { ssr: false })` dla dialogów (MonthlyOverviewDialog, FloorPlanDialog, DailyMovementsDialog itd.) – sprawdzić, czy któryś jest otwierany lub "dotykany" przy pierwszym dragu.

## Podsumowanie dla AI

Zadanie: zlokalizować przyczynę białej strony / "ładowania" przy **pierwszym** przeciągnięciu kafelka po odświeżeniu i zaproponować zmianę (preload, usunięcie pełnoekranowego loadingu, inny fallback). Dodatkowo: poprawić celność dropu już przy pierwszym dropie (np. rAF przed elementsFromPoint, ewentualnie "rozgrzanie" layoutu przy pierwszym dragu). Nie zmieniać ogólnej logiki drag-and-drop (moveReservation, toasty, double-click do edycji).
