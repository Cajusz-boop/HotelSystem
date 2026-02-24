# Prompt dla AI: naprawa błędu hydratacji na /front-office (Next.js)

## Problem

Po **odświeżeniu strony** (`localhost:3011/front-office`):

1. Pojawia się **"Hydration failed because the initial UI does not match what was rendered on the server"** (Next.js runtime error).
2. W UI widać **"3 errors"** (overlay Next.js w dev) – po kliknięciu widać ten błąd hydratacji.
3. **Drag-and-drop** na Tape Chart (przeciąganie pasków rezerwacji) **przestaje działać** – prawdopodobnie przez przełączenie na „client rendering” i niestabilne drzewo React.

Bez odświeżenia wszystko działa (drag, brak błędów).

## Stack

- **Next.js 14** (np. 14.2.35)
- **React 18**
- Strona: **`app/front-office/page.tsx`** → async `FrontOfficeData` → **`FrontOfficeClient`** (useSearchParams) → **`TapeChart`** (`components/tape-chart/index.tsx`).
- `FrontOfficeClient` jest wewnątrz `<Suspense fallback={<FrontOfficeLoading />}>`.

## Co już zrobiono (bez pełnego efektu)

1. **Pozycja dropu (drag):**  
   W `handleDragEnd` używana jest pozycja z `pointerup`/`pointercancel` oraz fallback na środek overlayu przy (0,0). Drag działa, gdy hydratacja się nie wywali.

2. **useSearchParams a hydratacja:**  
   W `app/front-office/front-office-client.tsx`:
   - `reservationId` i `e2eOpenCreate` **nie** są już odczytywane z `useSearchParams()` w trakcie renderu.
   - Są w `useState(undefined)` / `useState(false)` i ustawiane w `useEffect` z `searchParams`.
   - Pierwszy render (serwer i klient) ma te same wartości (undefined, false).

Mimo to błąd hydratacji nadal występuje po odświeżeniu.

## Podejrzane miejsca (do sprawdzenia)

1. **TapeChart – data „dziś”**  
   W `components/tape-chart/index.tsx` (ok. linie 400–407):
   - `const today = useMemo(() => new Date(), []);` – na serwerze to „teraz” serwera, na kliencie „teraz” przeglądarki (strefa czasowa / moment mogą się różnić).
   - `clientTodayStr` z `today` i `todayStr = initialTodayStr ?? clientTodayStr`.
   - Jeśli gdziekolwiek w pierwszym renderze używana jest data z `today`/`clientTodayStr` zamiast wyłącznie `initialTodayStr`, może to dawać różnicę server vs client.

2. **Virtualizer / `mounted`**  
   TapeChart ma `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);` i pewne rzeczy renderowane dopiero przy `mounted`. Upewnij się, że **przed** `mounted` serwer i klient renderują **dokładnie to samo** (np. ten sam placeholder lub brak listy), inaczej będzie mismatch.

3. **Inne użycia `new Date()`, `Date.now()`, `toLocaleString()` w pierwszym renderze**  
   Przeszukaj `components/tape-chart/index.tsx` i powiązane komponenty: cokolwiek zależy od „teraz” lub strefy w **pierwszym** renderze (bez useEffect), może różnić serwer i klient.

4. **Suspense + streaming**  
   Możliwe, że serwer wysyła najpierw fallback, a dopiero potem payload z `FrontOfficeData`. Sprawdź, czy błąd hydratacji nie dotyczy granicy Suspense (np. fallback vs treść) i czy nie ma warunkowego renderu zależnego od „czy mamy już dane”.

5. **Layout / providers**  
   W `app/layout.tsx` są m.in. `ConnectionMonitor`, `FiscalRelay`. Sprawdź, czy któryś z nich w **pierwszym** renderze (przed useEffect) renderuje coś zależnego od `window`, `navigator` lub czasu – to też może psuć hydratację w swoim poddrzewie.

## Prośba do AI

1. **Zlokalizuj dokładną przyczynę** błędu hydratacji: który komponent / który fragment drzewa ma inną treść na serwerze i na kliencie przy pierwszym renderze.
2. **Zaproponuj konkretną poprawkę** (zmiany w plikach, bez zmiany ogólnej logiki biznesowej).
3. **Priorytet:** ujednolicenie pierwszego renderu (server = client), np.:
   - używanie wyłącznie `initialTodayStr` w TapeChart do pierwszego renderu, a „dziś” z klienta dopiero po mount (useEffect + state), albo
   - `suppressHydrationWarning` tylko tam, gdzie naprawdę wiadomo, że różnica jest akceptowalna (i krótko uzasadnij).
4. Opcjonalnie: jak po naprawie **zweryfikować**, że odświeżenie nie powoduje już błędu hydratacji ani „3 errors”, i że drag-and-drop działa od razu po odświeżeniu.

5. **Obejście (last resort):** Jeśli trudno znaleźć przyczynę, rozważ wyłączenie SSR dla tej strony (np. `export const dynamic = 'force-dynamic'` jest już w layout; ewentualnie wrapper z `dynamic(..., { ssr: false })` tylko dla treści front-office), tak aby pierwszy render był wyłącznie po stronie klienta – tylko jako tymczasowe potwierdzenie, że problem jest w hydratacji.

## Kluczowe pliki

- `app/front-office/page.tsx` – Suspense, FrontOfficeData (async), initialData z `today`
- `app/front-office/front-office-client.tsx` – useSearchParams, useState dla reservationId/e2eOpenCreate, przekazanie initialTodayStr do TapeChart
- `components/tape-chart/index.tsx` – TapeChart: `today`/`clientTodayStr`/`todayStr`, `mounted`, virtualizer, drag (handleDragEnd, pointerPosRef, overlay)

---

## Fragmenty kodu (kontekst dla AI)

### 1. `app/front-office/page.tsx`

```tsx
export default function FrontOfficePage() {
  return (
    <Suspense fallback={<FrontOfficeLoading />}>
      <FrontOfficeData />
    </Suspense>
  );
}

async function FrontOfficeData() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);  // YYYY-MM-DD z serwera
  // ...
  return (
    <FrontOfficeClient
      initialData={{
        rooms: data.rooms,
        reservationGroups: data.reservationGroups,
        reservationStatusColors: data.reservationStatusColors,
        propertyId: data.propertyId,
        reservations: data.reservations,
        today,  // przekazywane do TapeChart jako initialTodayStr
      }}
    />
  );
}
```

### 2. `app/front-office/front-office-client.tsx`

```tsx
export function FrontOfficeClient({ initialData }: { initialData: FrontOfficeInitialData }) {
  const [data, setData] = useState(initialData);
  const searchParams = useSearchParams();
  const [reservationId, setReservationId] = useState<string | undefined>(undefined);
  const [e2eOpenCreate, setE2eOpenCreate] = useState(false);

  useEffect(() => {
    const raw = searchParams.get("reservationId");
    setReservationId(raw?.trim() || undefined);
    setE2eOpenCreate(searchParams.get("e2eOpenCreate") === "1");
  }, [searchParams]);
  // ... useEffect getTapeChartData ...

  if (rooms.length === 0) {
    return <div>Ładowanie recepcji…</div>;
  }

  return (
    <TapeChartStoreProvider reservations={reservations}>
      <TapeChart
        rooms={rooms}
        initialTodayStr={data.today}
        initialHighlightReservationId={reservationId}
        initialOpenCreate={e2eOpenCreate}
        // ...
      />
    </TapeChartStoreProvider>
  );
}
```

### 3. `components/tape-chart/index.tsx` – początek TapeChart (daty, mounted)

```tsx
export function TapeChart({
  rooms,
  initialTodayStr,
  initialHighlightReservationId,
  initialOpenCreate = false,
  // ...
}) {
  const today = useMemo(() => new Date(), []);  // ⚠ serwer vs klient – różny moment
  const clientTodayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [today]);
  const todayStr = initialTodayStr ?? clientTodayStr;

  // ⚠ viewStartDate zależy od `today` – przy różnym today (server vs client) da różny zakres dat
  const [viewStartDate, setViewStartDate] = useState<Date>(() => {
    if (DEFAULT_VIEW_SCALE === "day" || DEFAULT_VIEW_SCALE === "week" || DEFAULT_VIEW_SCALE === "month") {
      return new Date(today);
    }
    const days = VIEW_SCALE_CONFIG[DEFAULT_VIEW_SCALE].days;
    return addDays(new Date(today), -Math.floor(days / 2));
  });
  // ...
  const [highlightedReservationId, setHighlightedReservationId] = useState<string | null>(
    () => initialHighlightReservationId ?? null
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // dates pochodzi z viewStartDate – używane w nagłówkach i siatce
  const dates = useMemo(() => { /* getDateRange(viewStartDate, ...) */ }, [viewStartDate, ...]);
  // ...
  // Siatka wierszy: renderowana tylko gdy mounted
  {mounted && virtualRows.map((virtualRow) => ( ... ))}
}
```

**Uwaga:** `viewStartDate` jest inicjalizowane z `today` (które jest `new Date()` w useMemo). Na serwerze i kliencie „teraz” może się różnić (strefa czasowa / opóźnienie), więc `viewStartDate` → `dates` → treść nagłówków i siatki mogą się różnić przy pierwszym renderze i powodować błąd hydratacji. Warto rozważyć inicjalizację `viewStartDate` wyłącznie z `initialTodayStr` (np. `parseUtc(initialTodayStr)` lub stan ustawiony w useEffect po mount).

---

Dzięki temu po naprawie hydratacji znikanie „3 errors” i ponowne działanie drag-and-drop po odświeżeniu powinny być spójne.
