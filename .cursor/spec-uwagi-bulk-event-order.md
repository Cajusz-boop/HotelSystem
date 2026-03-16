# Uwagi przed Fazą 2 — zbiorcze przypisanie do imprezy (EventOrder)

## ✅ Zaakceptowane z specu
- Prawidłowa identyfikacja plików do zmiany
- Reuse formatu etykiety imprezy z PozostaleTab — spójność UI
- Edge case z nieistniejącą imprezą
- Obsługa częściowych błędów w bulk (updated: N, failed: M)
- Opcja odpięcia od imprezy (null) w dialogu zbiorczym

---

## ⚠️ Doprecyzowania dla Fazy 2 (Cursor)

### 1. `bulkAssignEventOrder` — jedna transakcja z pętlą (NIE updateMany)
**Wymóg:** Użyć **jednej transakcji Prisma** z pętlą po `reservationIds` i w środku `prisma.reservation.update(...)` per rezerwacja.

**Dlaczego nie `updateMany`:** W MySQL z Prismą `updateMany` nie zwraca liczby faktycznie zaktualizowanych rekordów w sposób niezawodny. Potrzebujemy dokładnej liczby zaktualizowanych (i ewentualnie pominiętych), żeby zwrócić `{ updated, failed, skipped }` i pokazać użytkownikowi komunikat typu „Zaktualizowano 5, pominięto 2”.

**Implementacja:** W transakcji dla każdego `id` z listy: `findUnique` (opcjonalnie) + `update` z `eventOrderId`; zliczać sukces/błąd; po transakcji zwrócić `{ success: true, updated: N, failed: M, skipped?: K }`.

---

### 2. `revalidatePath` — rzeczywiste ścieżki Tape Chart i MICE
**Wymóg:** Po zbiorczym przypisaniu/odpięciu imprezy wywołać `revalidatePath` dla **wszystkich** miejsc, gdzie wyświetlane są rezerwacje.

**Rzeczywiste ścieżki w projekcie:**
- **Recepcja (Tape Chart):** `/front-office` — główny grafik; root `/` przekierowuje na `/front-office`.
- **KWHotel (Tape Chart):** `/front-office/kwhotel` — ten sam komponent Tape Chart, inna strona.
- **MICE grafik:** `/mice/grafik` — grafik sal konferencyjnych (też Tape Chart).
- **MICE przegląd:** `/mice` — strona główna MICE; po zbiorczym przypisaniu lista rezerwacji przy imprezach powinna się odświeżyć.

**Do wywołania po sukcesie bulk assign:**
```ts
revalidatePath("/front-office");
revalidatePath("/front-office/kwhotel");
revalidatePath("/mice/grafik");
revalidatePath("/mice");
```

---

### 3. Dialog zbiorczy — „Odłącz” jako pierwsza opcja
**Wymóg:** W select imprezy w dialogu zbiorczym opcja **„— brak powiązania —”** (wartość `""` lub `null`) ma być **pierwszą** pozycją na liście, nie na końcu.

**Powód:** Domyślnie użytkownik może chcieć odpiąć rezerwacje od imprezy; pierwsza opcja jest najszybciej widoczna i wybierana.

**Implementacja:** Przed mapowaniem listy imprez (event orders) dodać jeden element: `{ value: "" lub null, label: "— brak powiązania —" }`, potem reszta opcji.

---

### 4. `revalidatePath("/mice")` — już ujęte w pkt 2
Dodać `revalidatePath("/mice")` (oraz `/mice/grafik`) przy zbiorczym przypisaniu, żeby po akcji widok MICE pokazywał zaktualizowaną listę rezerwacji przy imprezach.

---

## 💬 Odpowiedź na pytanie: banner „Pobyt powiązany z imprezą” na paskach

**Pytanie:** Czy po zbiorczym przypisaniu paski rezerwacji na taśmie mają od razu pokazać banner „Pobyt powiązany z imprezą” (wymaga lokalnej akt…)?

**Odpowiedź: Tak — wymaga lokalnej aktualizacji stanu.**

- Banner **„Pobyt powiązany z imprezą”** jest dziś w **dialogu rezerwacji** (UnifiedReservationDialog), nie na samym pasku. Żeby po zamknięciu dialogu zbiorczego i ewentualnym otwarciu jednej z rezerwacji **od razu** widać było ten banner (bez przeładowania strony), obiekty rezerwacji w **store Tape Chart** muszą mieć zaktualizowane pola `eventOrderId`, `eventOrderType`, `eventOrderClient`, `eventOrderDate`, `eventOrderStatus`, `eventOrderDeposit`, `eventOrderDepositPaid`.

**Wymagana zmiana po stronie klienta (Faza 2):**  
Po udanym wywołaniu `bulkAssignEventOrder` (w odpowiedzi: lista zaktualizowanych ID lub pełne obiekty rezerwacji) — w komponencie wywołującym (np. Tape Chart lub wrapper dialogu zbiorczego) zaktualizować stan rezerwacji: `setReservations(prev => prev.map(r => idsUpdated.includes(r.id) ? { ...r, eventOrderId, eventOrderType, ... } : r))`. Wartości mogą pochodzić z odpowiedzi serwera (jeśli akcja zwraca fragment rezerwacji z eventOrder*) albo z wybranej imprezy w dialogu (eventOrderId + ewentualnie dane imprezy). Dzięki temu:
1. Po otwarciu rezerwacji w sheet/dialogu banner „Pobyt powiązany z imprezą” jest od razu widoczny.
2. Jeśli w przyszłości na pasku zostanie dodana ikonka/oznaka imprezy, będzie mogła od razu się wyświetlić na podstawie tego samego stanu.

**Podsumowanie:** Tak — żeby paski (i dialog) od razu odzwierciedlały powiązanie z imprezą, po sukcesie bulk assign trzeba zaktualizować lokalny stan rezerwacji w store (merge pól eventOrder* dla zaktualizowanych ID).
