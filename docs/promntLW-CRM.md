# MODUŁ: CRM Rozbudowa — Filtrowanie, eksport, rabaty, historia dokumentów

> **STAN OBECNY:** Strona `/kontrahenci` z zakładkami Goście + Firmy. Wyszukiwanie, karta gościa,
> RODO (anonimizacja, eksport, zgody). Brak: zaawansowane filtrowanie, eksport CSV, rabat na okres,
> historia dokumentów w profilu, własne pola gościa.
> **ZASADA:** Przeczytaj CAŁY. Zrób WSZYSTKO. Sprawdź checklistę.

---

## ISTNIEJĄCE ZASOBY

```
Pliki:
  app/kontrahenci/page.tsx              — lista gości + firm (tabbed)
  app/guests/[id]/page.tsx              — karta gościa
  app/actions/reservations.ts           — searchGuests, getGuestById, updateGuest,
                                           updateGuestBlacklist, RODO (anonymize, export, withdraw),
                                           mergeGuests
  app/actions/companies.ts              — CRUD firm

Model Guest (kluczowe pola):
  name, email, phone, photoUrl, emergencyContact, occupation, guestType, segment,
  dateOfBirth, nationality, gender, address (street/city/postalCode/country),
  documentType/Number/Expiry/Mrz, isVip, vipLevel, isBlacklisted,
  preferences, totalStays, lastStayDate, mealPreferences, healthAllergies,
  gdpr* (consents, anonymized), loyaltyCardNumber/Points/TierId
```

---

# CZĘŚĆ 1: ZAAWANSOWANE FILTROWANIE GOŚCI

## Obecny stan

Strona `/kontrahenci` ma prawdopodobnie proste wyszukiwanie (name/email/phone).
Brak filtrów: segment, VIP, data ostatniego pobytu, kraj, liczba pobytów.

## Nowy panel filtrów na stronie `/kontrahenci`

```
┌─ Filtry gości ──────────────────────────────────────────────────────────────┐
│                                                                              │
│  Szukaj: [🔍 Nazwisko, email, telefon, NIP...                   ]           │
│                                                                              │
│  Segment:    [▼ Wszystkie]  Status:     [▼ Wszystkie]                       │
│  Kraj:       [▼ Wszystkie]  Narodowość: [▼ Wszystkie]                       │
│  VIP:        [▼ Wszystkie]  Czarna lista:[▼ Wszystkie]                      │
│                                                                              │
│  Ostatni pobyt od: [📅 ___]  do: [📅 ___]                                   │
│  Liczba pobytów: min [__]  max [__]                                          │
│  Wiek:   min [__]  max [__]                                                  │
│                                                                              │
│  [🔍 Filtruj]  [✕ Wyczyść]                              Wyników: 1 247     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Server Action

Rozbuduj lub dodaj do `app/actions/reservations.ts`:

```typescript
export async function getFilteredGuests(params: {
  propertyId?: number;
  search?: string;           // name/email/phone/nip LIKE
  segment?: string;          // BUSINESS, LEISURE, VIP, GROUP
  country?: string;
  nationality?: string;
  isVip?: boolean;
  isBlacklisted?: boolean;
  lastStayFrom?: string;     // data
  lastStayTo?: string;
  minStays?: number;
  maxStays?: number;
  minAge?: number;
  maxAge?: number;
  sortBy?: string;           // name, email, totalStays, lastStayDate, createdAt
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}): Promise<{
  data: GuestListEntry[];
  total: number;
}> {
  const where: any = {};

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
      { phone: { contains: params.search } },
    ];
  }

  if (params.segment) where.segment = params.segment;
  if (params.country) where.country = params.country;
  if (params.nationality) where.nationality = params.nationality;
  if (params.isVip !== undefined) where.isVip = params.isVip;
  if (params.isBlacklisted !== undefined) where.isBlacklisted = params.isBlacklisted;

  if (params.lastStayFrom || params.lastStayTo) {
    where.lastStayDate = {};
    if (params.lastStayFrom) where.lastStayDate.gte = new Date(params.lastStayFrom);
    if (params.lastStayTo) where.lastStayDate.lte = new Date(params.lastStayTo);
  }

  if (params.minStays || params.maxStays) {
    where.totalStays = {};
    if (params.minStays) where.totalStays.gte = params.minStays;
    if (params.maxStays) where.totalStays.lte = params.maxStays;
  }

  if (params.minAge || params.maxAge) {
    const now = new Date();
    where.dateOfBirth = {};
    if (params.maxAge) {
      where.dateOfBirth.gte = new Date(now.getFullYear() - params.maxAge, now.getMonth(), now.getDate());
    }
    if (params.minAge) {
      where.dateOfBirth.lte = new Date(now.getFullYear() - params.minAge, now.getMonth(), now.getDate());
    }
  }

  const [data, total] = await Promise.all([
    prisma.guest.findMany({
      where,
      orderBy: { [params.sortBy || 'name']: params.sortDir || 'asc' },
      skip: ((params.page || 1) - 1) * (params.pageSize || 25),
      take: params.pageSize || 25,
    }),
    prisma.guest.count({ where }),
  ]);

  return { data, total };
}
```

---

# CZĘŚĆ 2: EKSPORT GOŚCI DO CSV/Excel

## Przyciski na stronie `/kontrahenci`

```
[📥 Eksport CSV]  [📥 Eksport Excel]
```

- Eksportuj WSZYSTKIE wyfiltrowane rekordy (nie tylko stronę)
- Kolumny: Imię i nazwisko, Email, Telefon, Kraj, Narodowość, Segment, VIP, Czarna lista,
  Liczba pobytów, Ostatni pobyt, Data urodzenia, Adres, Nr dokumentu
- CSV: UTF-8 BOM, separator `;`, nazwa `goscie-YYYY-MM-DD.csv`
- Excel: `goscie-YYYY-MM-DD.xlsx` (użyj `lib/export-excel.ts`)

## Server Action

```typescript
export async function getGuestsForExport(params: {
  // te same filtry co getFilteredGuests ale BEZ paginacji
}): Promise<GuestExportEntry[]> {
  return prisma.guest.findMany({
    where: buildWhere(params), // ta sama logika
    orderBy: { name: 'asc' },
    select: {
      name: true, email: true, phone: true, country: true, nationality: true,
      segment: true, isVip: true, isBlacklisted: true, totalStays: true,
      lastStayDate: true, dateOfBirth: true, street: true, city: true,
      postalCode: true, documentType: true, documentNumber: true,
    },
  });
}
```

---

# CZĘŚĆ 3: RABAT KLIENTA NA OKRES

## Opis

Przypisanie klientowi rabatu X% na pobyt w okresie od-do.
Np. "Jan Kowalski — 10% rabatu od 01.03 do 31.05.2026".

## Model

```prisma
model GuestDiscount {
  id          Int       @id @default(autoincrement())
  guestId     Int
  percentage  Decimal   @db.Decimal(5, 2)  // np. 10.00 = 10%
  dateFrom    DateTime
  dateTo      DateTime
  reason      String?                       // "Stały klient", "Rekompensata"
  isActive    Boolean   @default(true)
  createdBy   Int?
  createdAt   DateTime  @default(now())

  guest       Guest     @relation(fields: [guestId], references: [id])
}
```

## Server Actions

```typescript
export async function getGuestDiscounts(guestId: number): Promise<GuestDiscount[]>

export async function createGuestDiscount(params: {
  guestId: number;
  percentage: number;
  dateFrom: string;
  dateTo: string;
  reason?: string;
}): Promise<GuestDiscount>

export async function deleteGuestDiscount(id: number): Promise<void>

// Sprawdzenie aktywnego rabatu (używane przy tworzeniu rezerwacji):
export async function getActiveGuestDiscount(guestId: number, date: string): Promise<GuestDiscount | null> {
  return prisma.guestDiscount.findFirst({
    where: {
      guestId,
      isActive: true,
      dateFrom: { lte: new Date(date) },
      dateTo: { gte: new Date(date) },
    },
    orderBy: { percentage: 'desc' }, // najwyższy rabat
  });
}
```

## UI — w karcie gościa (`/guests/[id]`)

Sekcja "Rabaty":
```
┌─ Rabaty ────────────────────────────────────────────────────────┐
│  Rabat  │ Od         │ Do         │ Powód           │ Aktywny  │
│  10%    │ 01.03.2026 │ 31.05.2026 │ Stały klient    │ ✅  [🗑️]│
│  5%     │ 01.01.2026 │ 28.02.2026 │ Rekompensata    │ ❌ (min.)│
│                                                                  │
│  [+ Dodaj rabat]                                                 │
└──────────────────────────────────────────────────────────────────┘
```

## Integracja z rezerwacją

Przy tworzeniu/edycji rezerwacji — w zakładce Rozliczenie:
```
ℹ️ Gość ma aktywny rabat: 10% (stały klient, do 31.05.2026)
   [Zastosuj rabat]
```

Klik "Zastosuj" → wpisuje 10% w pole rabatu rezerwacji.

---

# CZĘŚĆ 4: HISTORIA DOKUMENTÓW GOŚCIA

## Opis

W karcie gościa (`/guests/[id]`) — lista wszystkich faktur, rachunków, proform wystawionych dla tego gościa.

## UI — w karcie gościa

Nowa sekcja lub zakładka "Dokumenty":
```
┌─ Dokumenty gościa ─────────────────────────────────────────────────┐
│  Nr dokumentu  │ Typ       │ Data       │ Kwota    │ Status       │
│  FV/12/2026    │ Faktura   │ 18.03.2026 │ 1 950,00 │ ✅ Zapłacona │
│  PF/05/2026    │ Proforma  │ 10.03.2026 │ 1 950,00 │ —            │
│  R/03/2025     │ Rachunek  │ 22.06.2025 │   680,00 │ ✅ Zapłacona │
│                                                                     │
│  Klik → otwiera PDF dokumentu                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Server Action

```typescript
export async function getGuestDocuments(guestId: number): Promise<GuestDocument[]> {
  // Pobierz faktury i rachunki powiązane z rezerwacjami tego gościa
  const reservationIds = await prisma.reservation.findMany({
    where: { guestId },
    select: { id: true },
  });
  const resIds = reservationIds.map(r => r.id);

  const [invoices, receipts, proformas] = await Promise.all([
    prisma.invoice.findMany({
      where: { reservationId: { in: resIds } },
      orderBy: { issuedAt: 'desc' },
    }),
    prisma.receipt.findMany({
      where: { reservationId: { in: resIds } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.proforma.findMany({
      where: { reservationId: { in: resIds } },
      orderBy: { issuedAt: 'desc' },
    }),
  ]);

  // Merge i sortuj po dacie
  return [
    ...invoices.map(i => ({ type: 'invoice', ...i })),
    ...receipts.map(r => ({ type: 'receipt', ...r })),
    ...proformas.map(p => ({ type: 'proforma', ...p })),
  ].sort((a, b) => new Date(b.issuedAt || b.createdAt).getTime() - new Date(a.issuedAt || a.createdAt).getTime());
}
```

---

# CZĘŚĆ 5: WŁASNE POLA GOŚCIA (Custom Fields)

## Opis

Analogicznie jak Custom Fields rezerwacji — ale dla gościa:
"Ulubiony pokój", "Dieta", "Nr karty lojalnościowej", itp.

## Implementacja

Dodaj do modelu Guest:
```prisma
model Guest {
  // ... istniejące pola ...
  customFields  Json?    // { "favorite_room": "101", "diet": "bezglutenowa" }
}
```

Sprawdź: `getFormFieldsForForm('guest')` — jeśli zwraca pola → użyj ich.
Jeśli config jest pusty → skonfiguruj domyślne pola w seedzie lub konfiguracji.

## UI — w karcie gościa

Sekcja "Dodatkowe informacje" (lub zakładka):
```
┌─ Dodatkowe informacje ─────────────────────────────────────────┐
│  Ulubiony pokój:    [ 101                       ]              │
│  Dieta:             [ Bezglutenowa              ]              │
│  Uwagi recepcji:    [ Prosi o ciche piętro      ]              │
│  Nr programu lot.:  [ LOT123456                 ]              │
│                                                                  │
│  [Zapisz]                                                        │
└──────────────────────────────────────────────────────────────────┘
```

Renderuj dynamicznie z `getFormFieldsForForm('guest')` — tak samo jak Custom Fields rezerwacji.

---

# CZĘŚĆ 6: ROZBUDOWA KARTY GOŚCIA

Obecna karta `/guests/[id]` — upewnij się że zawiera WSZYSTKIE sekcje:

```
┌─ Jan Kowalski ── ⭐ VIP ── Segment: BUSINESS ─────────────────────────────┐
│                                                                             │
│  [Dane]  [Rezerwacje]  [Dokumenty]  [Rabaty]  [Dodatkowe]  [RODO]         │
│                                                                             │
│  ┌─ DANE ──────────────────────────────────────────────────────────────┐   │
│  │  📷 [zdjęcie]                                                       │   │
│  │  Email: jan@example.com          Tel: +48 600 123 456              │   │
│  │  Adres: ul. Kwiatowa 5, 00-001 Warszawa                           │   │
│  │  Kraj: Polska  Narodowość: polska  Płeć: M  Ur.: 15.05.1985     │   │
│  │  Dokument: Dowód osobisty ABC123456  Ważny do: 01.2030           │   │
│  │  Firma: Tech Corp (NIP: 1234567890)                                │   │
│  │                                                                     │   │
│  │  Statystyki: 12 pobytów | Ostatni: 15.01.2026 | Przychód: 15 200  │   │
│  │                                                                     │   │
│  │  ☐ VIP  ☐ Czarna lista                                            │   │
│  │  [✏️ Edytuj]                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─ REZERWACJE (12 pobytów) ───────────────────────────────────────────┐  │
│  │  # │ Daty              │ Pokój │ Typ     │ Status    │ Kwota       │  │
│  │  1 │ 15-18.01.2026    │ 101   │ Comfort │ Wymeldo.  │ 1 950,00   │  │
│  │  2 │ 05-07.11.2025    │ 205   │ Suite   │ Wymeldo.  │ 1 800,00   │  │
│  │  ...                                                                │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ DOKUMENTY ─────────────────────────────────────────────────────────┐  │
│  │  (lista z CZĘŚCI 4 powyżej)                                         │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ RABATY ────────────────────────────────────────────────────────────┐  │
│  │  (lista z CZĘŚCI 3 powyżej)                                         │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ RODO ──────────────────────────────────────────────────────────────┐  │
│  │  ☑ Zgoda na przetwarzanie danych (od 15.01.2026)                    │  │
│  │  ☐ Zgoda na marketing                                                │  │
│  │  ☐ Zgoda na przekazanie danych                                       │  │
│  │  [Eksport danych RODO]  [Anonimizuj]  [Wycofaj zgody]              │  │
│  │  Historia RODO: 3 wpisy ▶                                           │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## KOLEJNOŚĆ IMPLEMENTACJI

```
1. Zaawansowane filtrowanie (getFilteredGuests + panel filtrów)
2. Eksport CSV/Excel (przyciski + export utils)
3. Rabaty gościa (model GuestDiscount + CRUD + UI w karcie gościa)
4. Historia dokumentów (getGuestDocuments + sekcja w karcie)
5. Własne pola gościa (customFields na Guest + dynamic render)
6. Rozbudowa karty gościa (tabbed layout z wszystkimi sekcjami)
7. Integracja rabatu z oknem rezerwacji
```

---

## CHECKLIST

### Filtrowanie:
- [ ] Panel filtrów na stronie /kontrahenci
- [ ] Filtr: wyszukiwanie (name/email/phone)
- [ ] Filtr: segment (dropdown)
- [ ] Filtr: kraj (dropdown)
- [ ] Filtr: VIP / czarna lista (dropdown)
- [ ] Filtr: ostatni pobyt (zakres dat)
- [ ] Filtr: liczba pobytów (min/max)
- [ ] Filtr: wiek (min/max)
- [ ] Sortowanie po kolumnach
- [ ] Paginacja server-side

### Eksport:
- [ ] Przycisk CSV na stronie /kontrahenci
- [ ] Przycisk Excel na stronie /kontrahenci
- [ ] CSV: UTF-8 BOM, separator `;`, polskie znaki
- [ ] Eksportuje WSZYSTKIE wyfiltrowane (nie tylko stronę)

### Rabaty:
- [ ] Model GuestDiscount istnieje
- [ ] CRUD server actions
- [ ] Sekcja "Rabaty" w karcie gościa
- [ ] Dodawanie rabatu z datami i powodem
- [ ] getActiveGuestDiscount przy tworzeniu rezerwacji
- [ ] Info w oknie rezerwacji: "Gość ma rabat X%"

### Historia dokumentów:
- [ ] getGuestDocuments zwraca faktury + rachunki + proformy
- [ ] Sekcja "Dokumenty" w karcie gościa
- [ ] Klik na dokument → PDF

### Custom fields:
- [ ] Pole customFields (Json) w modelu Guest
- [ ] Dynamic render z getFormFieldsForForm('guest')
- [ ] Zapis wartości przy edycji gościa

### Karta gościa:
- [ ] Tabbed layout (Dane, Rezerwacje, Dokumenty, Rabaty, Dodatkowe, RODO)
- [ ] Wszystkie sekcje widoczne i działające
- [ ] Statystyki: liczba pobytów, ostatni pobyt, łączny przychód

### Nic nie zepsute:
- [ ] Strona /kontrahenci nadal działa
- [ ] Wyszukiwanie gości nadal działa
- [ ] RODO (anonimizacja, eksport) nadal działa
- [ ] Karta gościa /guests/[id] nadal działa