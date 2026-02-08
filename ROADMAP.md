# Kolejność wdrożenia – Hotel PMS

Krótka, konkretna kolejność zgodna z `.cursorrules`. Każdy krok buduje na poprzednim.

---

## Faza 1: Fundament (baza + stan)

1. **Schema Prisma + MySQL**
   - Modele: `Room`, `Reservation`, `Guest`, `AuditLog`, `Transaction` (minimalnie pod Front Office i Finanse).
   - Migracje, `.env` z `DATABASE_URL`.

2. **Zustand + Undo/Redo**
   - Store dla rezerwacji/grafiku z middleware Undo/Redo (np. ostatnie 5 akcji).
   - Podłączenie Tape Chart do store zamiast lokalnego `useState`.

3. **Zod**
   - Schematy walidacji dla rezerwacji, gościa, płatności.
   - Użycie przy formularzach i Server Actions.

---

## Faza 2: Front Office (Tape Chart – dokończenie)

4. **Room Guard**
   - Przy drop rezerwacji: jeśli pokój ma status DIRTY lub OOO → blokada.
   - Toast/Alert (np. Shadcn `Sonner`/`AlertDialog`) lub wymóg potwierdzenia (np. PIN managera – symulacja).

5. **Sheet/Drawer do edycji rezerwacji**
   - Prawy klik / klik na pasku → otwiera Sheet (Shadcn `Sheet`) z danymi rezerwacji i gościa.
   - Edycja pól + zapis (na razie przez Server Action lub store).

6. **Privacy Mode – doprecyzowanie**
   - Hover na rezerwacji → nazwisko ukryte (np. "J. K*****").
   - Klik → pełne dane (np. w Sheet lub tooltip).

---

## Faza 3: UX i nawigacja

7. **Command Palette (Cmd+K / Ctrl+K)**
   - Komponent typu Command/Dialog (np. `cmdk` lub własny).
   - Wyszukiwanie: gość, pokój, szybkie akcje (Nowa rezerwacja, Tape Chart, itd.).

8. **Context Menu na rezerwacji**
   - Prawy klik na pasku rezerwacji → menu: Check-In, Edytuj rezerwację, Anuluj, itd.
   - Long Press na mobile (touch) → to samo menu (np. `onContextMenu` + obsługa `touch` z opóźnieniem).

---

## Faza 4: Dashboard, dane i cennik

9. **Cennik / stawki (obecnie brak – luka w specyfikacji)**
   - Moduł do zarządzania cenami: lista pokoi z ceną (`Room.price`), edycja ceny, opcjonalnie stawki sezonowe lub kody stawek.
   - Strona `/cennik` lub zakładka w Finance/sidebar; Server Action do aktualizacji ceny pokoju; AuditLog przy zmianie.

10. **Dashboard – widgety**
   - VIP Arrival (dzisiaj/jutro).
   - Dirty Rooms (lista pokoi DIRTY).
   - Opcjonalnie: OOO, dzisiejsze check-iny.

11. **Server Actions + Audit Trail**
    - CRUD rezerwacji/pokoi przez Server Actions.
    - Każda mutacja → wpis do `AuditLog` (timestamp, userId, actionType, oldValue, newValue, ip).

---

## Faza 5: Finanse (MVP)

12. **Night Audit**
    - Proces „zamknięcia doby”: transakcje z daty &lt; Today → readonly (flaga lub osobna tabela).
    - Przycisk „Zamknij dobę” + prosty Management Report (PDF/HTML).

13. **Blind Drop**
    - Strona/zakładka „Zamknięcie zmiany”: input z kwotą gotówki.
    - Porównanie z sumą w systemie; po zatwierdzeniu – pokazanie Manko/Superata.

14. **Void Security**
    - Usunięcie pozycji z rachunku wymaga „PIN managera” (pole input, walidacja po stronie serwera – symulacja).

15. **Deposit Management**
    - Płatność typu Przelew/Zadatek → automatyczne wystawienie faktury zaliczkowej (logika + ewentualnie szablon).

---

## Faza 6: Bezpieczeństwo i RODO

16. **Parse & Forget (dowód)**
    - W formularzu gościa: upload zdjęcia dowodu.
    - Symulacja OCR → wypełnienie pól (imię, nazwisko, nr dowodu, MRZ jeśli potrzebne).
    - Usunięcie pliku po przetworzeniu; brak zapisu w DB/Blob.

17. **Pole MRZ w formularzu meldunkowym**
    - Input na kod MRZ (skaner 2D); parsowanie i mapowanie na pola gościa.

---

## Faza 7: Housekeeping (offline-first)

18. **Widok Housekeeping (mobilny)**
    - Uproszczony layout: lista pokoi, statusy (CLEAN/DIRTY/OOO), szybka zmiana statusu.

19. **Offline: IndexedDB / localStorage**
    - Zapisywanie statusów pokoi lokalnie gdy brak sieci.
    - Sync przy powrocie online: strategia „Server Wins” przy konflikcie; jeśli tylko pokojowa zmieniała – aktualizacja na serwer.

20. **Zgłoszenie usterki**
    - Akcja „Zgłoś usterkę” → status pokoju na OOO + notyfikacja na Dashboard (np. lista „Nowe OOO”).

---

## Faza 8: API i integracje

21. **Endpointy API**
    - `GET /api/v1/external/availability` – dostępność (daty, typ pokoju).
    - `POST /api/v1/external/posting` – posting z POS/konferencji (np. obciążenie pokoju/rezerwacji).

22. **TanStack Query (opcjonalnie)**
    - W Housekeeping lub przy liście rezerwacji – cache, refetch, lepsze UX przy sync.

---

## Podsumowanie

| Faza | Zakres |
|------|--------|
| 1 | Baza (Prisma), stan (Zustand + Undo), Zod |
| 2 | Room Guard, Sheet, Privacy (hover/click) |
| 3 | Command Palette, Context Menu |
| 4 | Cennik (stawki), Dashboard (VIP, Dirty), Server Actions, Audit |
| 5 | Finanse: Night Audit, Blind Drop, Void, Zaliczki |
| 6 | Parse & Forget, MRZ |
| 7 | Housekeeping: widok, offline, sync, usterki |
| 8 | API zewnętrzne, TanStack Query |

Można realizować po jednej fazie (albo po jednym punkcie), testując po każdym kroku.
