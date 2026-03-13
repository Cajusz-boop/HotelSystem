# Diagnoza: „Brak pakietów” w Pakiety menu

## Podsumowanie

| Element | Status |
|---------|--------|
| Baza produkcji (Hetzner) | ✅ Zawiera 11 pakietów |
| API `GET /api/menu-packages` | ✅ Zwraca pełne dane (41 KB JSON) |
| Wyświetlanie w UI | ❓ Prawdopodobnie problem po stronie frontendu / warunków wyświetlania |

---

## 1. Przepływ danych

```
MenuPackagesView (client)
    ↓ useEffect → load()
    ↓ fetch("/api/menu-packages?includeInactive=true")
    ↓
API route: app/api/menu-packages/route.ts
    ↓ prisma.menuPackage.findMany({ includeInactive: true })
    ↓
Baza: MenuPackage, MenuPackageSection, MenuPackageSurcharge
```

## 2. Warunek wyświetlenia „Brak pakietów”

Plik: `components/centrum-sprzedazy/menu-packages-view.tsx` (linie 521–531)

```tsx
{loading ? (
  "Ładowanie pakietów…"
) : packages.length === 0 ? (
  "Brak pakietów"  // ← TU
) : (
  // lista pakietów
)}
```

**Warunek:** `!loading && packages.length === 0`.

## 3. Jak ustawiane jest `packages`

```tsx
const load = useCallback(async () => {
  setLoading(true);
  try {
    const res = await fetch("/api/menu-packages?includeInactive=true");
    const data = await res.json();                    // ← może rzucić (invalid JSON)
    setPackages(Array.isArray(data) ? data : []);     // ← nie sprawdza res.ok
  } catch {
    setPackages([]);                                  // ← błąd → pusta lista
  } finally {
    setLoading(false);
  }
}, []);
```

## 4. Możliwe przyczyny pustej listy

| # | Przyczyna | Opis |
|---|-----------|------|
| 1 | **Brak sprawdzenia `res.ok`** | Przy 401/403/500 API może zwrócić `{ error: "..." }`. `Array.isArray(data)` → false → `setPackages([])`. |
| 2 | **Błąd parsowania JSON** | Przy HTML (np. strona błędu) `res.json()` rzuca błąd → catch → `setPackages([])`. |
| 3 | **Błąd sieci** | `fetch` rzuca → catch → `setPackages([])`. |
| 4 | **API zwraca nie-tablicę** | Np. `{ packages: [...] }` zamiast `[...]` → `Array.isArray(data)` → false → `setPackages([])`. |

API produkcyjne zwraca bezpośrednio tablicę `[{...}, {...}, ...]`, więc punkt 4 na produkcji nie powinien mieć miejsca.

## 5. Weryfikacja po stronie API

- **Produkcja:** `https://hotel.karczma-labedz.pl/api/menu-packages` zwraca 200 i pełną tablicę 11 pakietów.
- **Auth:** Middleware nie wymaga sesji dla `/api/*` (poza whitelistą IP).
- **Route:** Brak sprawdzania autoryzacji w `app/api/menu-packages/route.ts`.

## 6. Co dokładnie sprawdzić w przeglądarce

Na stronie **Centrum Sprzedaży → Pakiety menu**:

### A. DevTools → Network
1. F12 → zakładka Network.
2. Odśwież stronę (Ctrl+Shift+R).
3. Znajdź request `menu-packages?includeInactive=true`.

Sprawdź:
- **Status:** 200 vs 401/403/500.
- **Response:** tablica JSON vs HTML / `{ error: "..." }`.

### B. DevTools → Console
- Czy są czerwone błędy JavaScript (np. przy `res.json()`).
- Czy pojawia się błąd CORS.

### C. Lokalne vs produkcja
- **Produkcja:** API zwraca dane.
- **Lokalnie:** zależy od bazy – przed `migrate-menu-packages.ts` tabela może być pusta.

## 7. Różnica między środowiskami

| Środowisko | Baza | Efekt |
|------------|------|-------|
| Produkcja (Hetzner) | 11 pakietów | API zwraca dane |
| Lokalne (przed migracją) | 0 pakietów | API zwraca `[]` |
| Lokalne (po migracji) | 11 pakietów | API zwraca dane |

Jeśli „Brak pakietów” pojawia się na **produkcji**, przyczyną raczej nie jest brak danych, tylko:
- błąd sieciowy,
- niepoprawna odpowiedź API w wybranym momencie,
- lub brak obsługi błędów po stronie frontendu (punkty 1–3 powyżej).

---

## 8. Rekomendowane kroki diagnostyczne

1. Otworzyć `https://hotel.karczma-labedz.pl/centrum-sprzedazy`.
2. Wejść w zakładkę „Pakiety menu”.
3. W DevTools (F12):
   - Network → odświeżyć → sprawdzić `menu-packages`.
   - Console → sprawdzić, czy są błędy.
4. Zgłosić:
   - status HTTP dla `menu-packages`,
   - początek treści odpowiedzi (kilka pierwszych znaków),
   - treść błędów z Console (jeśli są).

Po tym będzie można wskazać konkretną przyczynę i zaproponować zmianę w kodzie.
