# Audyt Centrum Sprzedaży — pełna analiza przed wdrożeniem produkcyjnym

**Data audytu:** 2026-03-09  
**Wersja raportu:** 2.0 (po przeglądzie kierowniczym)  
**Zakres:** EventOrder, GroupQuote, API `/api/event-orders`, Centrum Sprzedaży, formularz imprez, mapowanie kalendarzy

---

## Streszczenie wykonawcze

| Metryka | Wartość |
|---------|---------|
| Imprez w bazie | 313 |
| Zsynchronizowanych z Google Calendar | 313 (100%) |
| Z zadatkiem nieopłaconym | 13 |
| Największe ryzyko | 306 imprez bez `eventDate` (import GCal), 36 poprawin bez powiązania z weselami |

**Werdykt:** System nadaje się do produkcji po wykonaniu migracji `eventDate`, dodaniu aliasu `Sala Duza` i przeprowadzeniu testów DONE/CANCELLED. Brak autoryzacji API — wymaga zabezpieczenia przy włączeniu AUTH.

---

## 1. Wykonawca i metodologia

Audyt obejmuje:
- zapytania SQL na bazie `hotelsystem`,
- inspekcję kodu API (GET/POST/PUT/PATCH/DELETE),
- mapowanie pól formularz → API → baza → front,
- analizę encji i relacji danych,
- identyfikację ryzyk produkcyjnych.

---

## 2. WYNIKI ZAPYTAŃ SQL

### 2.1. roomName — unikalne wartości

| roomName | cnt |
|----------|-----|
| Sala Diamentowa | 101 |
| Sala Złota | 100 |
| Do ustalenia | 54 |
| Restauracja | 30 |
| Sala Złota, Restauracja | 13 |
| Sala Duża | 5 |
| Wiata | 4 |
| Pokój 10 | 3 |
| Sala Testowa | 1 |
| Sala Złota, Sala Diamentowa, Restauracja | 1 |
| Pokój 30 | 1 |

**Łącznie:** 11 unikalnych wartości (w tym 3 złożone: „Sala X, Sala Y”).

### 2.2. eventType — unikalne wartości

| eventType | cnt |
|-----------|-----|
| WESELE | 116 |
| KOMUNIA | 87 |
| URODZINY | 85 |
| FIRMOWA | 15 |
| CHRZCINY | 7 |
| INNE | 3 |
| STYPA | 0 |
| SYLWESTER | 0 |

STYPA i SYLWESTER występują w schemacie API, brak ich w danych.

### 2.3. status — unikalne wartości

| status | cnt |
|--------|-----|
| CONFIRMED | 306 |
| DRAFT | 7 |
| DONE | 0 |
| CANCELLED | 0 |

DONE i CANCELLED nie występują w danych — ścieżki UI nie są praktycznie przetestowane na produkcji.

### 2.4. eventDate vs dateFrom — niespójności

| metryka | wartość |
|---------|---------|
| eventDate = NULL | 306 |
| dateFrom NOT NULL | 313 |
| eventDate ≠ dateFrom (gdy oba NOT NULL) | 1 |

Problem: 97,8% imprez ma `eventDate = NULL` mimo wypełnionego `dateFrom`. **Źródło:** skrypt `import-gcal-events.ts` nie ustawia `eventDate` w payload create (tylko dateFrom, dateTo). Front używa `eventDate ?? dateFrom` w `mapApiToEvent`, więc logika działa, ale pogłębia brak spójności (source-of-truth).

### 2.5. clientName — jakość danych

| metryka | wartość |
|---------|---------|
| NULL | 0 |
| pusty string '' | 0 |
| wypełniony | 313 |

Brak problemów z pustymi klientami.

### 2.6. Zadatek (depositAmount / depositPaid)

| metryka | wartość |
|---------|---------|
| total | 313 |
| z zadatkiem (depositAmount > 0) | 154 |
| opłacone (depositPaid = 1) | 141 |
| nieopłacone (ma zadatek, depositPaid = 0) | 13 |

### 2.7. Poprawiny — integralność danych

| metryka | wartość |
|---------|---------|
| isPoprawiny = 1 | 36 |
| parentEventId NOT NULL i niepusty | 0 |

Uwaga: wszystkie 36 poprawinowych imprez nie ma `parentEventId`. Naruszona relacja logiczna poprawiny → wesele główne.

### 2.8. Google Calendar

| metryka | wartość |
|---------|---------|
| synced | 313 |
| has_gcal_id | 313 |
| has_error | 0 |

Synchronizacja spójna, brak błędów w danych.

### 2.9. Menu (JSON)

| metryka | wartość |
|---------|---------|
| has_menu | 0 |
| total | 313 |

Żadna impreza nie ma zapisanego menu — funkcja zapisu menu nie była używana.

### 2.10. GroupQuote

| metryka | wartość |
|---------|---------|
| total | 0 |

Brak kosztorysów, integracja quoteId ↔ GroupQuote nie jest testowana na realnych danych.

### 2.11. Multi-room (googleCalendarEvents)

| metryka | wartość |
|---------|---------|
| rekordów z googleCalendarEvents (JSON array) | 1 |
| total | 313 |

Przeważają imprezy pojedynczosalowe, tylko 1 z wieloma kalendarzami.

### 2.12. Polskie znaki w roomName

Zapytanie: `LIKE '%Duza%' OR '%Zlota%'` itd.

- W bazie: tylko „Sala Duża” (5 rekordów), prawidłowa pisownia.
- Brak wariantów ASCII (np. „Sala Duza”, „Sala Zlota”) w danych.

ROOM_ALIASES w `centrum-sprzedazy.tsx` mapuje:
- „Sala Zlota” → „Sala Złota”
- „Sala Duża” → „Sala Złota“
- „Sala Testowa” → „Do ustalenia”

Brak aliasu dla „Sala Duza” (bez ą) — zalecane uzupełnienie.

### 2.13. Kolizje dat po eventDate (niemiarodajne)

| eventDate | cnt |
|-----------|-----|
| NULL | 306 |
| 2026-03-09 | 5 |

Grupowanie po `eventDate` jest niemiarodajne — 306 imprez ma NULL. Patrz 2.13bis.

### 2.13bis. Kolizje dat po dateFrom (status ≠ CANCELLED) — top 10

| dateFrom | cnt |
|----------|-----|
| 2026-05-23 | 10 |
| 2026-05-03 | 10 |
| 2026-05-31 | 9 |
| 2026-05-10 | 9 |
| 2027-05-09 | 8 |
| 2027-05-15 | 7 |
| 2027-05-02 | 6 |
| 2026-03-09 | 6 |
| 2026-05-09 | 6 |
| 2027-05-23 | 5 |

Maks. 10 imprez tego samego dnia — przyjęcie bez rezerwacji wymaga koordynacji. Peak: maj 2026/2027.

### 2.14. Zakres dat

- **Najstarsza impreza:** 2026-03-09
- **Najnowsza impreza:** 2026-06-15

---

## 3. API — analiza zachowania

### 3.1. GET /api/event-orders

**Parametry:**
- `all=1` — bez filtra statusu
- `status=` — filtr po statusie
- `upcoming=1` — tylko dateFrom ≥ dziś

**Select przy `all=1` (FULL_SELECT):**
id, eventType, clientName, clientPhone, eventDate, dateFrom, dateTo, timeStart, timeEnd, guestCount, status, roomName, depositAmount, depositPaid, notes, isPoprawiny, parentEventId, menu, quoteId, roomIds, checklistDocId, menuDocId, googleCalendarEventId, googleCalendarCalId, googleCalendarSynced

**Brak w select:** name, packageId, cakesAndDesserts, checklistDocUrl, menuDocUrl, googleCalendarError, googleCalendarSyncedAt, createdAt, updatedAt.

Centrum Sprzedaży korzysta z FULL_SELECT; brak tych pól nie blokuje działania, ale ogranicza możliwości rozbudowy (np. podgląd błędów Google).

### 3.2. GET /api/event-orders/[id]

Zwraca pełny rekord EventOrder (findUnique, wszystkie pola).

### 3.3. POST /api/event-orders

- Walidacja: clientName, roomName, dateFrom/eventDate
- Tworzy imprezę i ewentualnie poprawiny
- Integruje Google Docs (checklist, menu) i Google Calendar
- Obsługuje błędy Google — impreza jest zapisana, ustawiane jest googleCalendarError

### 3.4. PUT /api/event-orders/[id]

Pełna aktualizacja przez `sanitizeEventData`. Pola obsługiwane: name, eventType, clientName, clientPhone, eventDate, timeStart, timeEnd, roomName, guestCount, … (pełna lista w `sanitizeEventData`). Aktualizacja checklisty i kalendarza Google.

### 3.5. PATCH /api/event-orders/[id]

Częściowa aktualizacja tylko dla: status, depositAmount, depositPaid, notes, menu.

Przy zmianie statusu na CANCELLED — anulowanie wydarzenia w Google Calendar.

Przy zmianie status/notes/deposit — aktualizacja opisu wydarzenia w GCal.

### 3.6. DELETE /api/event-orders/[id]

Usuwa imprezę i powiązane wydarzenie w Google Calendar. Brak soft-delete.

### 3.7a. Autoryzacja i bezpieczeństwo

- Brak middleware auth na route — dostęp zależy od AUTH_DISABLED w .env.
- Przy AUTH_DISABLED=true każdy ma pełny dostęp do CRUD imprez.
- Zalecenie: przed produkcją włączyć auth i zabezpieczyć API.

### 3.8. Przekaz danych — Prisma Decimal

`depositAmount` w bazie: `Decimal(10,2)`. API zwraca obiekt Prisma Decimal (np. z metodą `toNumber()`).

Centrum Sprzedaży poprawnie obsługuje:
```ts
const depNum = dep != null ? (typeof dep === "object" && dep !== null && "toNumber" in dep 
  ? (dep as { toNumber: () => number }).toNumber() 
  : Number(dep)) 
  : null;
```

Serializacja JSON przez Next.js zwraca typowo obiekt `{ toNumber: … }` lub liczbę — oba przypadki są obsłużone.

---

## 4. Mapowanie formularz → API → baza

### 4.1. EventForm → payload (POST/PUT)

| Pole formularza | Pole API | Uwagi |
|-----------------|----------|-------|
| eventType | eventType | WESELE…INNE |
| clientName | clientName | wymagane |
| clientPhone | clientPhone | |
| eventDate / dateFrom | eventDate, dateFrom, dateTo | dateFrom=dateTo przy pojedynczym dniu |
| timeStart, timeEnd | timeStart, timeEnd | |
| roomNames[] → join | roomName | np. „Sala Złota, Restauracja” |
| guestCount, adultsCount, children03, children47 | … | |
| churchTime, brideGroomTable, orchestraTable | … | |
| packageId | packageId | |
| cakesAndDesserts | cakesAndDesserts | |
| depositAmount, depositPaid | depositAmount, depositPaid | |
| addPoprawiny, poprawinyDate | addPoprawiny, poprawinyDate | tylko dla WESELE |

Formularz wysyła PUT (pełna aktualizacja), nie PATCH. Edycja w EventForm używa PUT.

### 4.2. Sale w formularzu vs baza

**Formularz ROOMS:**
- Sala Złota, Sala Diamentowa, Restauracja, Pokój 10, Pokój 30, Wiata

**Baza (dodatkowo):**
- Do ustalenia (54)
- Sala Duża (5)
- Sala Testowa (1)
- kombinacje: „Sala Złota, Restauracja”, itd.

„Do ustalenia” i „Sala Duża” nie są na liście formularza — pochodzą z importu/legacy. ROOM_ALIASES mapują je. Sale złożone (np. „Sala Złota, Restauracja"): RC nie ma koloru dla pełnego stringa → fallback #94a3b8.

### 4.3. Centrum Sprzedaży — mapowanie API → EventRecord

```ts
mapApiToEvent(record):
  date = eventDate ?? dateFrom  ✓
  deposit = toNumber(depositAmount)  ✓
  room = roomName  ✓
  pop = isPoprawiny  ✓
  status, notes, menu, quoteId, …  ✓
```

Poprawne użycie `eventDate ?? dateFrom` — kompensuje brak eventDate.

---

## 5. Mapowanie kalendarzy Google (calendarMapping.ts)

Logika wyboru kalendarza: eventType + roomName + isPoprawiny.

Regexy dla roomName:
- Złota/zlota: `Z[łl]ota|zlota`
- Diamentowa: `Diamentowa|Diamentow`
- Pokój: brak dedykowanego mapowania

Dla „Sala Złota” i „Sala Diamentowa” mapowanie jest poprawne. „Sala Duża” nie ma własnego kalendarza — poprawiny trafiają do GOOGLE_CALENDAR_POPRAWINY, wesela do PRZYJECIA_WESELNE lub WESELA_ZLOTA/DIAMENTOWA w zależności od roomName. ROOM_ALIASES zamieniają „Sala Duża” → „Sala Złota”, więc efekt jest spójny.

---

## 6. Lista niezgodności i ryzyk

| # | Typ | Opis | Priorytet |
|---|-----|------|-----------|
| 1 | Dane | 306 imprez z eventDate=NULL; dateFrom wypełniony | Średni |
| 2 | Dane | 36 imprez poprawiny bez parentEventId | Średni |
| 3 | Dane | 0 imprez z menu — brak testów zapisu menu | Niski |
| 4 | Dane | 0 kosztorysów GroupQuote — brak testów quoteId | Niski |
| 5 | Dane | DONE, CANCELLED nie występują — ścieżki UI nieprzetestowane | Średni |
| 6 | Kod | ROOM_ALIASES bez „Sala Duza” (ASCII) | Niski |
| 7 | Flow | ~~EventForm nie zapisuje eventDate~~ — zweryfikowano: zapisuje (toPayload:330) | — |
| 8 | API | GET bez paginacji — 313 rekordów OK, ryzyko przy wzroście | Niski |
| 9 | Nav | Dwa wejścia /centrum i /centrum-sprzedazy → ten sam widok | Info |
| 8b | Bezpieczeństwo | API bez autoryzacji (AUTH_DISABLED) | Krytyczny przy prod |
| 10 | UI | Sale złożone — fallback kolor #94a3b8 (RC) | Info |

**Uwaga:** EventForm poprawnie wysyła eventDate; problem eventDate=NULL wynika wyłącznie z importu GCal.

---

## 7. Zalecenia naprawcze

### 7.1. Uzupełnienie eventDate (migracja)

```sql
UPDATE EventOrder 
SET eventDate = dateFrom 
WHERE eventDate IS NULL AND dateFrom IS NOT NULL;
```

Daje spójność eventDate z dateFrom i poprawia analizy kolizji.  
**Sugestia:** W `import-gcal-events.ts` dodać `eventDate: dateFrom` do payload create, aby nowe importy miały eventDate.

### 7.2. Poprawiny bez parentEventId

- Zidentyfikować 36 imprez z isPoprawiny=1.
- Jeśli możliwe — ustalić parentEventId (np. po dacie, kliencie, typie).
- Jeśli nie — pozostawić bez parentEventId, ale dodać walidację przy nowych poprawinach.

### 7.3. ROOM_ALIASES — dodanie wariantu ASCII

W `components/centrum-sprzedazy.tsx`:

```ts
const ROOM_ALIASES: Record<string, string> = {
  "Sala Zlota": "Sala Złota",
  "Sala Duza": "Sala Złota",  // wariant ASCII
  "Sala Duża": "Sala Złota",
  "Sala Testowa": "Do ustalenia",
};
```

### 7.4. Testy manualne przed produkcją

- [ ] Zmiana statusu na DONE
- [ ] Zmiana statusu na CANCELLED + przywracanie
- [ ] Zapis menu z modułu menu
- [ ] Powiązanie imprezy z kosztorysem (quoteId)
- [ ] Tworzenie imprezy z poprawinami
- [ ] PATCH depositPaid (toggle) — weryfikacja po odświeżeniu

---

## 8. Checklista testów po wdrożeniu

1. GET /api/event-orders?all=1 — zwraca listę
2. Pierwszy rekord ma: menu, depositAmount, googleCalendarSynced, isPoprawiny, quoteId
3. Centrum Sprzedaży — lista się ładuje, karty imprez widoczne
4. Zmiana statusu (CONFIRMED → DONE) — PATCH, odświeżenie
5. Anulowanie imprezy — status CANCELLED, wydarzenie znika/anulowane w GCal
6. Toggle zadatku — PATCH depositPaid, odświeżenie
7. Edycja imprezy (EventForm, PUT) — zapis, aktualizacja GCal
8. Filtry: typ, status, archiwum
9. Kolory sal wg ROOMS / ROOM_ALIASES
10. Polskie znaki w nazwach (np. Sala Złota, Łukasz) wyświetlane poprawnie

---

## 9. Struktura plików i nawigacja

- API: `app/api/event-orders/route.ts` (GET, POST), `app/api/event-orders/[id]/route.ts` (GET, PUT, PATCH, DELETE)
- Centrum: `components/centrum-sprzedazy.tsx`
- Formularz: `components/events/event-form.tsx`, `app/events/new/page.tsx`
- Mapowanie kalendarzy: `lib/calendarMapping.ts`
- Skrypt audytu: `scripts/centrum-audit-db.ts`

### Nawigacja /centrum vs /centrum-sprzedazy

| Route | Sidebar | Permission | Widok |
|-------|---------|------------|-------|
| /centrum-sprzedazy | Główna sekcja (salesCenter) | — | CentrumSprzedazy |
| /centrum | MICE (centrumSprzedazy) | module.mice | CentrumSprzedazy |

Oba wyświetlają ten sam komponent. Zalecenie: jeden canonical URL, drugi przekierowanie (opcjonalne).

---

## 10. Historia zmian raportu

| Wersja | Data | Zmiany |
|--------|------|--------|
| 1.0 | 2026-03-09 | Raport początkowy |
| 2.0 | 2026-03-09 | Przegląd kierowniczy: streszczenie wykonawcze, kolizje dateFrom, korekta eventDate, ryzyka bezpieczeństwa, nawigacja, ROOM_ALIASES |

---

*Raport wygenerowany na podstawie audytu kodu i zapytań SQL. Skrypt: `npx tsx scripts/centrum-audit-db.ts`*
