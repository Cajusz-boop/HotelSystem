# Audyt Modułu Front Office / Tape Chart

**Data:** 2026-03-01  
**Przeanalizowane pliki:**
- `app/front-office/page.tsx`
- `app/front-office/front-office-client.tsx`
- `components/tape-chart/index.tsx`
- `components/tape-chart/cell-droppable.tsx`
- `components/tape-chart/reservation-bar.tsx`
- `components/tape-chart/reservation-bar-with-menu.tsx`
- `components/tape-chart/unified-reservation-dialog.tsx`
- `lib/store/tape-chart-store.tsx`
- `app/actions/tape-chart.ts`
- `app/actions/reservations.ts`

---

## A) LOGIKA BIZNESOWA

### Znalezione problemy i status naprawy

| Problem | Opis | Status | Linia |
|---------|------|--------|-------|
| **BUG-A1** | `moveReservation` nie sprawdzał statusu pokoju OOO | ✅ NAPRAWIONE | reservations.ts:2575 |
| **BUG-A2** | `updateReservationStatus` przy check-in nie sprawdzał czy pokój jest OOO | ✅ NAPRAWIONE | reservations.ts:3254 |
| **INFO-A3** | Zmiana dat rezerwacji NIE przelicza automatycznie ceny | ⚠️ WYMAGA DECYZJI | - |
| ✅ OK | Check-out zmienia status pokoju na DIRTY | - | reservations.ts:3318 |
| ✅ OK | Drag & drop sprawdza konflikty rezerwacji (nakładanie dat) | - | reservations.ts:2578 |
| ✅ OK | Room Block sprawdzany przy drag & drop | - | index.tsx:1454 |
| ✅ OK | Undo/redo działa poprawnie (przywraca cały stan) | - | tape-chart-store.tsx:51-77 |
| ✅ OK | Timezone obsługiwany poprawnie (Europe/Warsaw) | - | page.tsx:20, front-office-client.tsx:60 |

### Szczegóły napraw

#### BUG-A1: moveReservation + status pokoju
**Problem:** Można było przenieść rezerwację na pokój OOO (wyłączony ze sprzedaży).

**Naprawione przez dodanie:**
```typescript
if (newRoom.status === "OOO") {
  return {
    success: false,
    error: `Pokój ${newRoomNumber} jest wyłączony ze sprzedaży (OOO). Zmień status pokoju przed przeniesieniem rezerwacji.`,
  };
}
```

#### BUG-A2: Check-in + status pokoju
**Problem:** Można było zameldować gościa do pokoju OOO.

**Naprawione przez dodanie walidacji przed check-in:**
```typescript
if (room?.status === "OOO") {
  return {
    success: false,
    error: `Pokój ${room.number} jest wyłączony ze sprzedaży (OOO). Zmień status pokoju przed zameldowaniem gościa.`,
  };
}
if (room?.status === "DIRTY") {
  console.warn(`[check-in-warn] Rezerwacja ${reservationId}: pokój ${room.number} ma status DIRTY.`);
}
```

**Decyzja biznesowa:** Pokój DIRTY NIE blokuje meldunku (tylko loguje ostrzeżenie), ponieważ czasem trzeba zameldować gościa pilnie a housekeeping dopsprząta.

#### INFO-A3: Zmiana dat a przeliczenie ceny
**Problem:** Przy przesunięciu rezerwacji drag & drop cena nie jest przeliczana.

**Wymaga decyzji biznesowej:**
- Opcja A: Automatycznie przeliczać cenę przy zmianie dat
- Opcja B: Pokazać ostrzeżenie że cena może wymagać korekty
- Opcja C: Pozostawić obecne zachowanie (cena ręcznie w edycji)

---

## B) RACE CONDITIONS I STAN

| Problem | Opis | Status |
|---------|------|--------|
| ✅ OK | Optimistic updates - UI aktualizowane DOPIERO po sukcesie serwera | - |
| ✅ OK | useEffect tablice zależności kompletne | - |
| ⚠️ INFO | Brak debounce na drag events | Nie krytyczne |
| ⚠️ INFO | Brak optimistic locking (dwóch użytkowników) | Wymaga decyzji |

### Wyjaśnienie:

**Drag & drop:** Kod jest poprawny - używa `startDragTransition` i aktualizuje stan dopiero po `result.success`. Podczas zapisywania wyświetlany jest komunikat "Zapisywanie…".

**Debounce:** Drag events (`handleDragOver`) są obsługiwane bezpośrednio bez debounce. To może powodować wiele re-renderów przy szybkim ruchu myszką, ale nie jest to krytyczny problem dzięki memo na komponentach.

**Optimistic locking:** Obecnie brak mechanizmu blokowania edycji tej samej rezerwacji przez dwóch użytkowników. Możliwe rozwiązania:
- Dodać `updatedAt` do payload i weryfikować na serwerze
- Implementować WebSocket do real-time sync

---

## C) PERFORMANCE

| Element | Status | Uwagi |
|---------|--------|-------|
| ✅ Wirtualizacja | UŻYWANA | `@tanstack/react-virtual` |
| ✅ Memoizacja | UŻYWANA | `React.memo` na `RoomRowDroppable` |
| ✅ API z zakresem dat | UŻYWANE | `getTapeChartData({ dateFrom, dateTo })` |
| ✅ Lazy loading | UŻYWANE | `IntersectionObserver` na sentinelu |
| ✅ Dynamic import | UŻYWANE | `next/dynamic` dla dialogów |

**Wydajność jest dobrze zoptymalizowana:**
- Tape Chart używa wirtualizacji dla dużych list pokoi
- API zwraca tylko rezerwacje w widocznym zakresie dat (domyślnie 42 dni)
- Komponenty są memoizowane
- Dialogi ładowane dynamicznie (code splitting)

---

## D) ERROR HANDLING

| Element | Status | Uwagi |
|---------|--------|-------|
| ✅ API 500 → toast | TAK | `toast.error()` przy błędach |
| ✅ Walidacja Zod | TAK | `moveReservationSchema.safeParse()` |
| ✅ Fallback przy błędzie load | TAK | `FrontOfficeError` komponent |
| ⚠️ Offline | BRAK | Brak dedykowanej obsługi offline |
| ⚠️ Retry | BRAK | Brak automatycznego retry przy błędach sieci |

**Propozycja usprawnienia:**
- Dodać TanStack Query z retry i stale-while-revalidate
- Dodać offline indicator (już istnieje `ConnectionMonitor`)

---

## E) BEZPIECZEŃSTWO

| Element | Status | Uwagi |
|---------|------|-------|
| **BUG-E1** | `deleteReservation` nie sprawdzał uprawnień | ✅ NAPRAWIONE |
| ✅ OK | Audit log przy każdej zmianie rezerwacji | - |
| ⚠️ INFO | Niektóre operacje bez pełnej autoryzacji | Wymaga przeglądu |

### Szczegóły naprawy BUG-E1

**Problem:** Każdy zalogowany użytkownik mógł usuwać rezerwacje.

**Naprawione przez dodanie sprawdzenia uprawnień:**
```typescript
if (session) {
  const allowed = await can(session.role, "reservation.cancel");
  if (!allowed) {
    return { success: false, error: "Brak uprawnień do usuwania rezerwacji." };
  }
}
```

### Audit Log
Audit log jest tworzony poprawnie dla:
- CREATE rezerwacji (linia 829)
- UPDATE rezerwacji (linia 1052, 2645, 3091, 3195, 3333)
- DELETE rezerwacji (linia 3439)

---

## PODSUMOWANIE NAPRAW

### Naprawione (3 bugi):

1. **BUG-A1:** `moveReservation` - dodano blokadę dla pokoi OOO
2. **BUG-A2:** `updateReservationStatus` - dodano walidację statusu pokoju przy check-in
3. **BUG-E1:** `deleteReservation` - dodano sprawdzanie uprawnienia `reservation.cancel`

### Wymagające decyzji biznesowej:

1. **INFO-A3:** Czy zmiana dat rezerwacji powinna automatycznie przeliczać cenę?
2. **Optimistic locking:** Czy implementować blokowanie edycji tej samej rezerwacji przez dwóch użytkowników?
3. **Offline:** Czy dodać pełną obsługę offline dla Tape Chart?

### Co działa poprawnie:

- Drag & drop z walidacją konfliktów
- Room Block (blokady pokoi)
- Undo/redo (Ctrl+Z / Ctrl+Y)
- Check-out → DIRTY
- Timezone (Europe/Warsaw)
- Wirtualizacja i performance
- Audit log

---

## PLIKI ZMODYFIKOWANE

```
app/actions/reservations.ts
  - Linia ~2575: Dodano walidację statusu pokoju OOO przy moveReservation
  - Linia ~3254: Dodano walidację statusu pokoju przy check-in
  - Linia ~3430: Dodano sprawdzanie uprawnień przy deleteReservation
```
