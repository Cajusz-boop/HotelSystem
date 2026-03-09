# CHECKLISTA WDROŻENIOWA — wykonane punkty

> Wykonano: 2026-03-09

## FAZA 1: NAPRAWY BAZY DANYCH ✅

### ✅ 1.1 Migracja eventDate (306 rekordów z NULL)
- Uruchomiono skrypt `scripts/fix-eventdate-null.ts`
- Wynik: Zaktualizowano 306 rekordów, 0 pozostało z NULL

### ✅ 1.2 Napraw import GCal
- `lib/googleCalendarWebhookProcessor.ts`: dodano `eventDate: dateFrom` do `prisma.eventOrder.create`
- `scripts/import-gcal-events.ts` miał już `eventDate: dateFrom`

## FAZA 2: NAPRAWY KODU CENTRUM SPRZEDAŻY ✅

### ✅ 2.1 PATCH URL
- `patchEvent` już używa `/api/event-orders/${id}`

### ✅ 2.2 ROOM_ALIASES "Sala Duza"
- Już było w `ROOM_ALIASES`: `"Sala Duza": "Sala Złota"`

### ✅ 2.3 DepositModal — polski przecinek
- Zamieniono `parseFloat(amt)` na `parseFloat(String(amt).replace(",", "."))`

### ✅ 2.4 Rollback przy PATCH fail
- Dodano optimistic update + rollback we wszystkich handlerach (toggleDeposit, setDeposit, updateNote, changeStatus, updateMenu)
- Toast "Błąd zapisu — zmiany cofnięte" przy błędzie

### ✅ 2.5 daysTo() — strefa czasowa
- Naprawiono: używamy daty z "T00:00:00" i Math.round

### ✅ 2.6 Formularz /events/new — redirect
- `event-form.tsx`: `router.push("/centrum-sprzedazy")` po zapisie

### ✅ 2.7 "Do ustalenia" — lista sal
- Dodano do `ROOMS` w `event-form.tsx`

### ✅ 2.8 Alert "bez zadatku"
- Filtrowanie: tylko typy WESELE, KOMUNIA, CHRZCINY, URODZINY, daysTo <= 60

### ✅ 2.9 Szukanie telefonu +48
- Normalizacja: usuwanie +48, 0048, spacji z obu stron (phone i search)

### 2.10 Bubble 4+
- Sprawdzić ręcznie (pixel-perfect)

## FAZA 3: NAPRAWY API ✅

### ✅ 3.1 Pętla GCal webhook
- `processCalendarEvent` NIE wywołuje `updateCalendarEvent` — OK

### ✅ 3.2 Hard delete → soft-delete
- DELETE teraz ustawia `status: "CANCELLED"` zamiast `prisma.eventOrder.delete`
- Wywołuje `cancelCalendarEvent` zamiast `deleteCalendarEvent`

### ✅ 3.3 Walidacja depositAmount
- PATCH: walidacja 0–99999999.99, zwraca 400 przy błędzie

### ✅ 3.4 cancelCalendarEvent — 404
- Obsługa try/catch z logowaniem przy 404

### ✅ 3.5 MICE banner
- Dodano ostrzeżenie w `zlecenie-form.tsx`

### 3.6 XSS w notatkach
- Sprawdzone: notatki renderowane jako tekst (`{ev.notes}`), brak `dangerouslySetInnerHTML`

### ✅ 3.7 sanitizeEventData eventDate
- `[id]/route.ts`: `base.eventDate = dateFrom` gdy `dateFrom` ustawione

### ✅ 3.8 Walidacja statusu PATCH
- Tylko DRAFT, CONFIRMED, DONE, CANCELLED

## FAZA 5: CZĘŚCIOWO

### 5.1–5.4 AUTH
- Wymaga konfiguracji na serwerze — nie zmieniano

### ✅ 5.5 Redirect /centrum → /centrum-sprzedazy
- `app/centrum/page.tsx`: `redirect("/centrum-sprzedazy")`

## FAZA 6: TESTY PLAYWRIGHT ✅

### ✅ 6.1 Utworzono `Test/centrum-sprzedazy.spec.ts`
- F01, F02, F04, F05, F10, F13, F14, E01

---

## DO WYKONANIA RĘCZNIE

- **FAZA 4**: Testy manualne (4.1–4.11) — Łukasz
- **FAZA 5.1–5.4**: AUTH na produkcji (Hetzner)
- **FAZA 7**: Testy na sprzęcie
- **FAZA 8**: Testy akceptacyjne z Martą
- **FAZA 9**: Aktualizacja KONTEKST-DLA-AI.md (jeśli istnieje)
