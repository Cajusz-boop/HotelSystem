# MODUŁ: Okno Rezerwacji — Naprawienie wszystkich braków vs KWHotel

> **CEL:** Doprowadzić okno edycji/tworzenia rezerwacji do poziomu KWHotel.
> **PROBLEM:** Cursor pominął 22+ elementów z poprzednich promptów. Ten dokument zawiera KOMPLETNĄ listę.
> **ZASADA:** Przeczytaj CAŁY dokument. Zrób WSZYSTKO. Dla każdej sekcji sprawdź checklist na końcu.
> **WAŻNE:** Większość server actions JUŻ ISTNIEJE — nie twórz nowych, PODŁĄCZ istniejące.

---

## ISTNIEJĄCE ZASOBY — WYKORZYSTAJ JE

### Pliki okna rezerwacji (istniejące):
```
components/tape-chart/
├── index.tsx                    — główny TapeChart
├── reservation-bar.tsx          — pasek rezerwacji
├── cell-droppable.tsx           — drag & drop
├── tabs/
│   ├── settlement-tab.tsx       — zakładka Rozliczenie
│   ├── checkin-tab.tsx          — zakładka Meldunek
│   ├── documents-tab.tsx        — zakładka Dokumenty
│   ├── meals-tab.tsx            — zakładka Posiłki
│   ├── grafik-sprzatan-tab.tsx  — zakładka Grafik sprzątań
│   └── uslugi-tab.tsx           — zakładka Usługi
├── dialogs/                     — dialogi
└── store/tape-chart-store.tsx   — stan Zustand
```

### Server Actions — JUŻ ISTNIEJĄ, podłącz:
```
reservations.ts:
  - searchGuests, getGuestById, updateGuest        → dane gościa
  - create, update, move, split, merge             → rezerwacja
  - status (zmiana statusu)                         → melduj/wymelduj
  - delete (usuwanie)                               → usuń rezerwację
  - audit                                           → historia zmian
  - voucher                                         → vouchery
  - walk-in, auto-assign                            → quick booking
  - getReservationsByGuestId (lub podobna)           → historia gościa

finance.ts:
  - registerTransaction                              → wpłaty
  - collectSecurityDeposit                           → kaucja
  - chargeLocalTax                                   → opłata miejscowa
  - addFolioDiscount                                 → rabat
  - folio: charge, payment, deposit, refund, void    → operacje folio
  - createInvoice, createProforma                    → dokumenty
  - cardPreauth (create, capture, release)           → preautoryzacja karty
  - vouchery (validate, redeem)                      → voucher/dofinansowanie

rooms.ts:
  - getRooms, getRoomsForManagement                  → lista pokoi
  - getEffectivePriceForRoomOnDate                   → cena pokoju
  - getRatePlansForDate                              → plany cenowe

reservations.ts (occupants):
  - addReservationOccupant                           → dodaj gościa do pokoju
  - removeReservationOccupant                        → usuń gościa z pokoju
  - getReservationOccupants (lub include w get)      → lista gości
```

---

## DOCELOWY LAYOUT OKNA REZERWACJI

```
┌─ Rezerwacja #1042 ─ Jan Kowalski ─ Pokój 101 ──────────── [✕] ─────────────────┐
│                                                                                   │
│  ┌─────── LEWA KOLUMNA (40%) ───────┐  ┌──── PRAWA KOLUMNA (60%) ─────────────┐ │
│  │                                   │  │                                       │ │
│  │  ┌─ DANE POKOJU ──────────────┐  │  │  [Rozlicz.][Dok.][Posił.][Park.]     │ │
│  │  │ Grupa: [▼ Comfort       ]  │  │  │  [Pozost.][Własne][Usługi][Sprząt.]  │ │
│  │  │ Numer: [▼ 101           ]  │  │  │  [Meldunek]                           │ │
│  │  │ Łóżka: 2×DB              │  │  │                                       │ │
│  │  │ Wypos.: TV, WiFi, Łaz.    │  │  │  ┌─ ROZLICZENIE ──────────────────┐  │ │
│  │  │ Opis: Pokój z balkonem     │  │  │  │                                │  │ │
│  │  └────────────────────────────┘  │  │  │  Status: [▼ Potwierdzona  ]    │  │ │
│  │                                   │  │  │  Dod. status: [▼ VIP      ]   │  │ │
│  │  ┌─ OKRES POBYTU ────────────┐   │  │  │  [Melduj gościa]              │  │ │
│  │  │ Check-in:  [📅 27.02.26]  │   │  │  │                                │  │ │
│  │  │ Check-out: [📅 01.03.26]  │   │  │  │  Tryb: (●)Pokój (○)Osoba     │  │ │
│  │  │ Noce: [1][2][3][4][5][6][7]│  │  │  │        (○)Plan cenowy         │  │ │
│  │  │ Godz. in: [14:00]         │   │  │  │                                │  │ │
│  │  │ Godz. out:[10:00]         │   │  │  │  Cena bazowa:     [350,00]    │  │ │
│  │  │ Parking: ☐  Stawka: Auto   │  │  │  │  Dorosły ×2:      [300,00]    │  │ │
│  │  │ Dorośli:[2] Dzieci:[1]    │   │  │  │  Dz.0-6 ×1:       [  0,00]    │  │ │
│  │  └────────────────────────────┘  │  │  │  Dz.7-12 ×0:      [  0,00]    │  │ │
│  │                                   │  │  │  Dz.13-17 ×0:     [  0,00]    │  │ │
│  │  ┌─ DANE GOŚCIA ─────────────┐  │  │  │  Suma/dobę:        650,00     │  │ │
│  │  │ [🔍 Szukaj gościa...    ] │  │  │  │  × 2 noce =      1 300,00     │  │ │
│  │  │ Imię i nazw.: Jan Kowalsk │  │  │  │                                │  │ │
│  │  │ Email: jan@example.com     │  │  │  │  Rabat: [ 0]%   = -0,00      │  │ │
│  │  │ Telefon: +48 600 123 456  │  │  │  │  ☑ Opłata miejscowa  30,00    │  │ │
│  │  │ Firma: [▼ Brak          ] │  │  │  │                                │  │ │
│  │  │ ⭐ VIP  🚫 Czarna lista   │  │  │  │  RAZEM:          1 330,00 PLN │  │ │
│  │  └────────────────────────────┘  │  │  │  ──────────────────────────── │  │ │
│  │                                   │  │  │  Wpłata:    [      ] [Zapłać]│  │ │
│  │  ┌─ GOŚCIE W POKOJU ─────────┐  │  │  │  Zaliczka:  [      ]          │  │ │
│  │  │ 1. Jan Kowalski (główny)  │  │  │  │  Termin zal.:[📅          ]   │  │ │
│  │  │ 2. Anna Kowalska          │  │  │  │  Voucher:    [      ][▼typ]   │  │ │
│  │  │ 3. Tomek Kowalski (dz.)   │  │  │  │  Kaucja:     [      ]          │  │ │
│  │  │ [+Dodaj] [✏️Edytuj] [🗑️] │  │  │  │  ☐ Gwarancja kartą kredytową  │  │ │
│  │  └────────────────────────────┘  │  │  │                                │  │ │
│  │                                   │  │  │  Zapłacono:       500,00     │  │ │
│  │  ┌─ HISTORIA (3 pobyty) ▼ ───┐  │  │  │  Pozostało:       830,00     │  │ │
│  │  │ 12-15.01.2026 Pok.203     │  │  │  └────────────────────────────────┘  │ │
│  │  │ 05-07.11.2025 Pok.101     │  │  │                                       │ │
│  │  │ 20-22.06.2025 Pok.305     │  │  └───────────────────────────────────────┘ │
│  │  └────────────────────────────┘  │                                            │
│  │                                   │                                            │
│  │  ┌─ UWAGI ───────────────────┐   │                                            │
│  │  │ [________________________]│   │                                            │
│  │  │ ☑ Pokaż na grafiku        │   │                                            │
│  │  │ Uwagi wewn.: [__________] │   │                                            │
│  │  │ ☐ Przypomnienie [📅][⏰]  │   │                                            │
│  │  └────────────────────────────┘  │                                            │
│  │                                   │                                            │
│  └───────────────────────────────────┘                                            │
│                                                                                   │
│  ┌─ FOOTER ─────────────────────────────────────────────────────────────────────┐ │
│  │ [Towary] [Wystaw dok.▼] [Ceny/dni] [Usuń rez.] [Płatności] [Hist.] [Zapisz]│ │
│  └───────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

# BRAK 1: Sekcja DANE POKOJU — na górze lewej kolumny

**Co dodać:**

Nowa sekcja na SAMEJ GÓRZE lewej kolumny, PRZED okresem pobytu:

```tsx
<section className="space-y-2 p-3 border rounded-lg bg-gray-50">
  <h4 className="text-xs font-medium text-gray-500 uppercase">Dane pokoju</h4>

  {/* Grupa (typ pokoju) — dropdown */}
  <Select value={form.roomTypeId} onValueChange={handleRoomTypeChange}>
    {/* opcje z roomTypes */}
  </Select>

  {/* Numer pokoju — dropdown filtrowany po typie */}
  <Select value={form.roomId} onValueChange={handleRoomChange}>
    {/* opcje: pokoje z wybranego typu, posortowane po numerze */}
  </Select>

  {/* Info read-only po wyborze pokoju: */}
  {selectedRoom && (
    <div className="text-xs text-gray-600 space-y-1">
      <p>Łóżka: {selectedRoom.beds || '—'}</p>
      <p>Wyposażenie: {selectedRoom.roomFeatures || '—'}</p>
      <p>Opis: {selectedRoom.description || '—'}</p>
      <p>Maks. osób: {selectedRoom.maxOccupancy || '—'}</p>
      <p>Piętro: {selectedRoom.floor || '—'} | Budynek: {selectedRoom.building || '—'}</p>
    </div>
  )}
</section>
```

**Logika:**
- Zmiana typu pokoju → filtruj dostępne pokoje tego typu
- Zmiana pokoju → załaduj info o pokoju (beds, roomFeatures, opis)
- Dane pokoju read-only (nie edytowalne z tego poziomu)
- Dane z: `Room.beds`, `Room.roomFeatures`, `Room.surfaceArea`, `Room.floor`, `Room.building`, `Room.view`, `Room.maxOccupancy`

---

# BRAK 2: Sekcja OKRES POBYTU — upewnij się że widoczna

Sprawdź czy sekcja z datami, godzinami, nocami, pax jest WIDOCZNA i KOMPLETNA:

```
┌─ OKRES POBYTU ────────────────────────────────────────┐
│  Check-in:  [📅 27.02.2026]  Godz.: [14:00]          │
│  Check-out: [📅 01.03.2026]  Godz.: [10:00]          │
│                                                        │
│  Noce: [1] [2] [3] [4] [5] [6] [7]  ← pill buttons  │
│                                                        │
│  Dorośli: [▼ 2]    Dzieci: [▼ 1]                     │
│  ☐ Parking                                             │
│  Stawka: [▼ Automatyczna]                              │
└────────────────────────────────────────────────────────┘
```

**Pill buttons nocy:** klik na "3" → ustaw checkOut = checkIn + 3 dni. Aktywny przycisk podświetlony (bg-blue-600 text-white).

**Godziny:** input type="time" lub Select z opcjami 00:00-23:00 co godzinę.

Jeśli ta sekcja JUŻ istnieje ale jest poniżej widocznego obszaru — PRZENIEŚ ją wyżej (po Dane Pokoju, przed Dane Gościa).

---

# BRAK 3: Przenieś Źródło/Kanał/Wyżywienie/ETA do zakładki POZOSTAŁE

**Obecne (ZŁE):** Źródło, Kanał, Wyżywienie, ETA są w lewej kolumnie na górze.
**Docelowe (DOBRE):** Te pola powinny być w zakładce "Pozostałe" w prawej kolumnie.

**Akcja:**
1. Znajdź pola Źródło (source), Kanał (channel), Wyżywienie (mealPlan), ETA w lewej kolumnie
2. Wytnij je stamtąd
3. Wklej do nowej zakładki "Pozostałe" (Brak 19)

---

# BRAK 4: Lista gości w pokoju (Occupants)

Pod sekcją Dane Gościa, dodaj:

```tsx
<section className="space-y-2 p-3 border rounded-lg">
  <h4 className="text-xs font-medium text-gray-500 uppercase">
    Goście w pokoju ({occupants.length})
  </h4>

  {/* Lista gości */}
  <div className="space-y-1">
    {occupants.map((occ, i) => (
      <div key={occ.id} className="flex items-center justify-between text-sm py-1 px-2 bg-gray-50 rounded">
        <span>
          {i + 1}. {occ.guestName}
          {occ.isPrimary && <Badge variant="outline" className="ml-1 text-xs">główny</Badge>}
          {occ.isChild && <Badge variant="outline" className="ml-1 text-xs">dziecko</Badge>}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => editOccupant(occ)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => removeOccupant(occ.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    ))}
  </div>

  <Button variant="outline" size="sm" onClick={addOccupant}>
    <UserPlus className="h-3 w-3 mr-1" /> Dodaj gościa
  </Button>
</section>
```

**Podłącz do istniejących akcji:**
- `addReservationOccupant` z `reservations.ts`
- `removeReservationOccupant` z `reservations.ts`
- Occupants są w modelu `ReservationOccupant` — sprawdź schema.prisma

**Dialog "Dodaj gościa":** Użyj istniejącego searchGuests + formularz z imieniem, nazwiskiem, datą urodzenia (żeby system przypisał grupę wiekową).

---

# BRAK 5: Historia gościa

Pod listą occupants, rozwijany panel:

```tsx
<details className="border rounded-lg">
  <summary className="p-2 text-sm font-medium cursor-pointer hover:bg-gray-50">
    ▶ Historia ({guestHistory?.length || 0} pobytów)
  </summary>
  <div className="p-2 space-y-1 max-h-32 overflow-y-auto">
    {guestHistory?.map(res => (
      <div key={res.id} className="text-xs text-gray-600 flex justify-between">
        <span>{formatDate(res.checkIn)} — {formatDate(res.checkOut)}</span>
        <span>Pok. {res.roomNumber}</span>
        <span>{res.totalPrice} PLN</span>
      </div>
    ))}
  </div>
</details>
```

**Dane:** Załaduj leniwie (lazy) — dopiero po rozwinięciu. Użyj istniejącej akcji lub query:
```typescript
// W reservations.ts — jeśli nie istnieje, dodaj:
const history = await prisma.reservation.findMany({
  where: { guestId: guestId, status: { not: 'CANCELLED' } },
  select: { id: true, checkIn: true, checkOut: true, room: { select: { number: true } } },
  orderBy: { checkIn: 'desc' },
  take: 10,
});
```

---

# BRAK 6: Przypomnienie do rezerwacji

W sekcji UWAGI (dół lewej kolumny):

```
☐ Przypomnienie  [📅 data]  [⏰ godzina]  [treść: ________________]
```

Jeśli tabela `Reminder` nie istnieje — dodaj do Prisma:
```prisma
model ReservationReminder {
  id            Int       @id @default(autoincrement())
  reservationId Int
  reminderDate  DateTime
  reminderTime  String?   // "14:00"
  message       String?
  isCompleted   Boolean   @default(false)
  createdBy     Int?
  createdAt     DateTime  @default(now())

  reservation   Reservation @relation(fields: [reservationId], references: [id])
}
```

Przy zapisie rezerwacji: jeśli checkbox zaznaczony → upsert reminder.
Wyświetlanie: na dashboardzie w liście przyjazdów (jeśli reminder.reminderDate = today).

---

# BRAK 7: Uwagi — checkbox "Pokaż na grafiku"

W sekcji UWAGI:
```
Uwagi: [textarea________________________]
☑ Pokaż uwagi na grafiku
```

**Pole w DB:** Dodaj do Reservation (jeśli nie ma):
```prisma
showNotesOnChart  Boolean  @default(false)
```

**W TapeChart (reservation-bar.tsx):**
Jeśli `reservation.showNotesOnChart === true` → wyświetl pierwszą linię `reservation.notes` na pasku rezerwacji (text-[10px], truncated).

---

# BRAK 8: Tabela cen z grupami wiekowymi w Rozliczeniu

Zamień proste pole "Cena za dobę: 300" na tabelę:

```
┌─────────────────────────────────────────────────────────┐
│  Tryb: (●) Za pokój  (○) Za osobę  (○) Plan cenowy    │
│                                                         │
│           │ Ilość │ Cena/os │ Suma                     │
│  ─────────┼───────┼─────────┼──────                    │
│  Dorośli  │ [ 2 ] │ [150,00]│  300,00                  │
│  Dz. 0-6  │ [ 1 ] │ [  0,00]│    0,00                  │
│  Dz. 7-12 │ [ 0 ] │ [ 75,00]│    0,00                  │
│  Dz. 13-17│ [ 0 ] │ [120,00]│    0,00                  │
│  ─────────┼───────┼─────────┼──────                    │
│  Bazowa   │       │         │  350,00                  │
│  Suma/dobę│       │         │  650,00                  │
│  × 2 noce │       │         │ 1300,00                  │
└─────────────────────────────────────────────────────────┘
```

**Logika:**
- Tryb "Za pokój": tabela ukryta, widać jedno pole "Cena za pokój/dobę"
- Tryb "Za osobę": tabela widoczna, cena bazowa = 0, liczy się sum(osoby × cena_per_osoba)
- Tryb "Pokój + osoby": tabela widoczna, cena bazowa + sum(osoby × cena)
- Plan cenowy: dropdown z RateCode, auto-fill cen z planu

Ceny domyślne ładuj z `getEffectivePriceForRoomOnDate` (adultPrice, child1Price itp.).
Użytkownik może je nadpisać ręcznie.

---

# BRAK 9: Trzeci tryb cenowy — "Plan cenowy"

Dodaj trzeci radio button:
```
(●) Cena za pokój  (○) Cena za osobę  (○) Plan cenowy [▼ wybierz plan]
```

Gdy wybrany "Plan cenowy":
- Pokaż dropdown z listą RateCode (z `app/actions/rate-codes.ts`)
- Po wyborze → auto-fill cen z wybranego planu
- Ceny stają się read-only (szare tło) — żeby jasne było że idą z planu

---

# BRAK 10: Pola wpłat — Wpłata, Zaliczka, Voucher, Kaucja

Pod tabelą cen w zakładce Rozliczenie:

```tsx
<div className="space-y-2 mt-4 pt-4 border-t">
  {/* Wpłata */}
  <div className="flex items-center gap-2">
    <Label className="w-24 text-sm">Wpłata:</Label>
    <Input type="number" value={paymentAmount} onChange={...} className="w-32" />
    <Select value={paymentMethod} onValueChange={...}>
      <SelectItem value="CASH">Gotówka</SelectItem>
      <SelectItem value="CARD">Karta</SelectItem>
      <SelectItem value="TRANSFER">Przelew</SelectItem>
    </Select>
    <Button variant="outline" size="sm" onClick={handlePayFull}>Zapłacono</Button>
  </div>

  {/* Zaliczka */}
  <div className="flex items-center gap-2">
    <Label className="w-24 text-sm">Zaliczka:</Label>
    <Input type="number" value={advanceAmount} onChange={...} className="w-32" />
  </div>

  {/* Termin wpłaty zaliczki (BRAK 15) */}
  <div className="flex items-center gap-2">
    <Label className="w-24 text-sm">Termin zal.:</Label>
    <Input type="date" value={advanceDueDate} onChange={...} className="w-40" />
  </div>

  {/* Voucher / dofinansowanie */}
  <div className="flex items-center gap-2">
    <Label className="w-24 text-sm">Voucher:</Label>
    <Input type="number" value={voucherAmount} onChange={...} className="w-32" />
    <Select value={voucherType}>
      <SelectItem value="GIFT">Voucher podarunkowy</SelectItem>
      <SelectItem value="SUBSIDY">Dofinansowanie</SelectItem>
      <SelectItem value="LOYALTY">Program lojalnościowy</SelectItem>
    </Select>
  </div>

  {/* Kaucja */}
  <div className="flex items-center gap-2">
    <Label className="w-24 text-sm">Kaucja:</Label>
    <Input type="number" value={depositAmount} onChange={...} className="w-32" />
  </div>
</div>
```

**Podłącz do akcji:**
- Wpłata → `registerTransaction` z finance.ts
- Zaliczka → `registerTransaction` z type='ADVANCE'
- Voucher → `redeemVoucher` z finance.ts
- Kaucja → `collectSecurityDeposit` z finance.ts

---

# BRAK 11: Przycisk "Zapłacono"

Obok pola Wpłata:
```tsx
<Button variant="outline" size="sm" onClick={() => {
  setPaymentAmount(remaining); // wpisz brakującą kwotę
}}>
  Zapłacono
</Button>
```

---

# BRAK 12: Rabat za nocleg

```
Rabat: [ 0 ] %  = -0,00 PLN
```

- Input type="number" (0-100)
- Obliczanie: `discount = totalPrice × (rabat / 100)`
- Wyświetlanie: `= -${discount.toFixed(2)} PLN`
- Podłącz do: `addFolioDiscount` z finance.ts

Sprawdź uprawnienia: `User.maxDiscountPercent` — recepcjonista może mieć limit rabatu. Waliduj.

---

# BRAK 13: Checkbox "Dolicz opłatę miejscową"

```
☑ Dolicz opłatę miejscową: 30,00 PLN (2 os. × 2 noce × 7,50 PLN)
```

- Checkbox: toggle opłata ON/OFF
- Obliczanie: `adults × nights × Property.localTaxPerPersonPerNight`
- Wyjątek: `Guest.localTaxExempt` (sprawdź czy jest w DB — alerts.localTaxExempt)
- Podłącz: `chargeLocalTax` z finance.ts

---

# BRAK 14: Checkbox "Płatność gwarantowana kartą"

```
☐ Płatność gwarantowana kartą kredytową
```

Pole w Reservation (dodaj jeśli nie ma):
```prisma
isCreditCardGuaranteed  Boolean  @default(false)
```

Informacyjne — wpływa na wizualizację na grafiku (np. inna ikona).

---

# BRAK 15: Termin wpłaty zaliczki

Pole daty pod Zaliczką (ujęte w Brak 10 powyżej).

Pole w Reservation (dodaj jeśli nie ma):
```prisma
advanceDueDate  DateTime?
```

**Efekt:** Jeśli `advanceDueDate < today AND zaliczka nie wpłacona` → rezerwacja na grafiku zmienia kolor na czerwony (lub dodatkowy znacznik ostrzegawczy).

W `reservation-bar.tsx` sprawdź i dodaj wizualne ostrzeżenie.

---

# BRAK 16: Dodatkowy status rezerwacji

Obok głównego statusu, dodaj dropdown:

```
Status:        [▼ Potwierdzona    ]
Dod. status:   [▼ —               ]  (opcje: VIP, Oczekuje na wpłatę, Reklamacja, Specjalna obsługa)
```

Pole w Reservation (dodaj jeśli nie ma):
```prisma
additionalStatus  String?   // np. "VIP", "AWAITING_PAYMENT", "COMPLAINT", "SPECIAL"
```

Wartości konfigurowalne — na razie hardcoded, w przyszłości z dictionaries.

---

# BRAK 17: Statusy dynamiczne (filtrowane wg etapu)

Dropdown statusu głównego NIE powinien pokazywać WSZYSTKICH 5 opcji naraz. Filtruj:

```typescript
function getAvailableStatuses(reservation: { checkIn: Date; checkOut: Date; status: string }) {
  const today = new Date();
  const checkIn = new Date(reservation.checkIn);
  const checkOut = new Date(reservation.checkOut);

  if (reservation.status === 'CANCELLED') return ['CANCELLED']; // nie da się cofnąć
  if (reservation.status === 'CHECKED_OUT') return ['CHECKED_OUT']; // nie da się cofnąć

  if (reservation.status === 'CHECKED_IN') {
    return ['CHECKED_IN', 'CHECKED_OUT'];
  }

  // Rezerwacja przyszła (jeszcze nie zameldowana)
  if (checkIn > today) {
    return ['CONFIRMED', 'CANCELLED'];
  }

  // Rezerwacja na dziś
  if (checkIn <= today && checkOut >= today) {
    return ['CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW'];
  }

  // Rezerwacja przeszła (nie zameldowany)
  return ['CONFIRMED', 'NO_SHOW', 'CANCELLED'];
}
```

---

# BRAK 18: Przycisk "Melduj gościa" / "Wymelduj i zapisz"

Pod statusem, dynamiczny przycisk:

```tsx
{reservation.status === 'CONFIRMED' && isCheckInDay && (
  <Button onClick={handleCheckIn} className="bg-green-600 hover:bg-green-700 text-white">
    Melduj gościa
  </Button>
)}

{reservation.status === 'CHECKED_IN' && (
  <Button onClick={handleCheckOut} className="bg-blue-600 hover:bg-blue-700 text-white">
    Wymelduj i zapisz
  </Button>
)}
```

**handleCheckIn:** Zmień status → CHECKED_IN, zapisz datę/godzinę meldunku. Użyj istniejącej akcji zmiany statusu.

**handleCheckOut:** Sprawdź saldo (remaining). Jeśli > 0 → dialog "Gość ma nieuregulowane saldo: X PLN. Kontynuować?". Jeśli OK → zmień status → CHECKED_OUT.

---

# BRAK 19: Zakładka POZOSTAŁE

Nowa zakładka w prawej kolumnie. Przeniesione pola + nowe:

```
┌─ POZOSTAŁE ────────────────────────────────────────────┐
│                                                         │
│  Źródło:    [▼ Telefon          ]                      │
│  Kanał:     [▼ Direct           ]                      │
│  Segment:   [▼ Leisure          ]                      │
│  Wyżywienie:[▼ BB (śniadanie)  ]                      │
│  ETA:       [14:00              ]                       │
│                                                         │
│  Nr rez. online: [________________]  (nr z Booking.com) │
│  Waluta:   [▼ PLN]  Kurs: [1,0000]                    │
│                                                         │
│  [📋 Kopiuj rezerwację]  — tworzy duplikat             │
│                                                         │
│  ▶ Historia zmian (audit log)                           │
│    23.02 14:30 — Anna: Zmiana daty check-out            │
│    22.02 09:15 — Marek: Utworzenie rezerwacji            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Nr rezerwacji online:** Pole w Reservation (sprawdź czy istnieje, jeśli nie — dodaj):
```prisma
onlineReservationId  String?   // numer z Booking.com / Expedia
```

**Kopiuj rezerwację:** `duplicateReservation` — jeśli nie istnieje, dodaj akcję która kopiuje rezerwację z nowymi datami.

**Historia zmian:** Z tabeli `AuditLog` — filtruj po `entityType = 'Reservation' AND entityId = reservationId`. Wyświetl ostatnie 10 wpisów.

---

# BRAK 20: Zakładka WŁASNE

```tsx
<TabsContent value="custom">
  <div className="p-4 text-center text-gray-400">
    <Settings className="h-8 w-8 mx-auto mb-2" />
    <p>Pola definiowane przez użytkownika</p>
    <p className="text-xs">Konfiguracja w: Ustawienia → Pola formularzy</p>
    {/* W przyszłości: dynamiczne pola z HotelConfig.formFields */}
  </div>
</TabsContent>
```

Sprawdź: `getFormFieldsConfig` z `hotel-config.ts` — jeśli zwraca pola custom → wyrenderuj je tutaj dynamicznie. Jeśli config jest pusty → pokaż placeholder.

---

# BRAK 21: Zakładka PARKING

```tsx
<TabsContent value="parking">
  <div className="p-4 space-y-4">
    <h4 className="font-medium">Parking</h4>

    {/* Aktualne przypisanie */}
    {reservation.parkingSpot ? (
      <div className="p-3 bg-green-50 border border-green-200 rounded">
        <p className="text-sm">Miejsce: <strong>{reservation.parkingSpot.number}</strong></p>
        <p className="text-xs text-gray-500">Nr rejestracyjny: {reservation.vehiclePlate || '—'}</p>
        <Button variant="outline" size="sm" onClick={releaseParkingSpot}>Zwolnij miejsce</Button>
      </div>
    ) : (
      <div className="p-3 bg-gray-50 border rounded">
        <p className="text-sm text-gray-500">Brak przypisanego miejsca parkingowego</p>
        <div className="flex gap-2 mt-2">
          <Input placeholder="Nr rejestracyjny" value={vehiclePlate} onChange={...} />
          <Button variant="outline" size="sm" onClick={assignParkingSpot}>Przypisz miejsce</Button>
        </div>
      </div>
    )}
  </div>
</TabsContent>
```

Podłącz do: `ParkingSpot`, `ParkingBooking` — modele już istnieją w schema.prisma (sprawdź).

---

# BRAK 22: Rozbudowa footera

Obecny footer: `[Zapisz i drukuj] [Zapisz]`

Docelowy:
```
[Towary] [Wystaw dok.▼] [Ceny/dni] [Usuń rez.] [Płatności] [Historia] [Zapisz]
```

```tsx
<div className="flex items-center gap-2 p-3 border-t bg-gray-50">
  {/* Towary — otwiera AddChargeDialog */}
  <Button variant="outline" size="sm" onClick={() => setAddChargeOpen(true)}>
    <Package className="h-3 w-3 mr-1" /> Towary
  </Button>

  {/* Wystaw dokument — dropdown */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <FileText className="h-3 w-3 mr-1" /> Wystaw dok. ▼
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={() => handleCreateDocument('invoice')}>Faktura VAT</DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleCreateDocument('receipt')}>Rachunek</DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleCreateDocument('proforma')}>Proforma</DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleCreateDocument('fiscal')}>Paragon fiskalny</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  {/* Ceny / dni — dialog z ceną per dzień */}
  <Button variant="outline" size="sm" onClick={() => setDailyPricesOpen(true)}>
    <Calendar className="h-3 w-3 mr-1" /> Ceny/dni
  </Button>

  {/* Usuń rezerwację — z potwierdzeniem */}
  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={handleDeleteReservation}>
    <Trash2 className="h-3 w-3 mr-1" /> Usuń
  </Button>

  {/* Płatności — historia transakcji */}
  <Button variant="outline" size="sm" onClick={() => setPaymentsHistoryOpen(true)}>
    <CreditCard className="h-3 w-3 mr-1" /> Płatności
  </Button>

  {/* Historia — audit log */}
  <Button variant="outline" size="sm" onClick={() => setAuditLogOpen(true)}>
    <History className="h-3 w-3 mr-1" /> Historia
  </Button>

  <div className="flex-1" /> {/* spacer */}

  {/* Melduj/Wymelduj — dynamiczny */}
  {reservation.status === 'CONFIRMED' && (
    <Button onClick={handleCheckIn} className="bg-green-600 text-white">Melduj</Button>
  )}
  {reservation.status === 'CHECKED_IN' && (
    <Button onClick={handleCheckOut} className="bg-orange-600 text-white">Wymelduj</Button>
  )}

  {/* Zapisz */}
  <Button onClick={handleSave} className="bg-blue-600 text-white">
    <Save className="h-3 w-3 mr-1" /> Zapisz
  </Button>
</div>
```

### Dialog "Ceny/dni" (po kliknięciu przycisku):

```
┌─ Ceny per dzień ───────────────────────────────────────┐
│                                                         │
│  27.02.2026 (Pt):  [ 350,00 ] PLN  ← z planu cenowego │
│  28.02.2026 (Sb):  [ 400,00 ] PLN  ← weekend          │
│                                                         │
│  Suma:               750,00 PLN                         │
│  Średnia/dobę:       375,00 PLN                         │
│                                                         │
│  [Anuluj]  [Zastosuj]                                   │
└─────────────────────────────────────────────────────────┘
```

Każdy dzień edytowalny. Domyślne ceny z `getEffectivePriceForRoomOnDate`. Nadpisanie zapisz jako `DailyRateOverride` lub w polu JSON na rezerwacji.

### Dialog "Usuń rezerwację":

```
┌─ Usunąć rezerwację #1042? ─────────────────────────────┐
│                                                         │
│  ⚠️ Ta operacja jest nieodwracalna.                     │
│                                                         │
│  Powód usunięcia: [________________________________]    │
│  (wymagane)                                              │
│                                                         │
│  [Anuluj]  [Usuń rezerwację]                            │
└─────────────────────────────────────────────────────────┘
```

Podłącz: `deleteReservation` z reservations.ts. Powód zapisz w `Reservation.deletionReason` (dodaj pole jeśli nie ma) lub w AuditLog.

---

# KOLEJNOŚĆ ZAKŁADEK (finalna)

```tsx
<Tabs defaultValue="settlement">
  <TabsList>
    <TabsTrigger value="settlement">Rozliczenie</TabsTrigger>
    <TabsTrigger value="documents">Dokumenty</TabsTrigger>
    <TabsTrigger value="meals">Posiłki</TabsTrigger>
    <TabsTrigger value="parking">Parking</TabsTrigger>
    <TabsTrigger value="remaining">Pozostałe</TabsTrigger>
    <TabsTrigger value="custom">Własne</TabsTrigger>
    <TabsTrigger value="services">Usługi</TabsTrigger>
    <TabsTrigger value="cleaning">Sprzątanie</TabsTrigger>
    <TabsTrigger value="checkin">Meldunek</TabsTrigger>
  </TabsList>
  {/* ... TabsContent dla każdej ... */}
</Tabs>
```

Istniejące: settlement, documents, meals, services (uslugi), cleaning (grafik-sprzatan), checkin.
Nowe: parking, remaining (pozostałe), custom (własne).

---

# NOWE POLA PRISMA — PODSUMOWANIE

Dodaj do modelu `Reservation` (jeśli nie istnieją):
```prisma
showNotesOnChart        Boolean   @default(false)
isCreditCardGuaranteed  Boolean   @default(false)
additionalStatus        String?
onlineReservationId     String?
advanceDueDate          DateTime?
deletionReason          String?
vehiclePlate            String?   // nr rejestracyjny (lub w ParkingBooking)
```

Nowy model (jeśli nie istnieje):
```prisma
model ReservationReminder {
  id            Int       @id @default(autoincrement())
  reservationId Int
  reminderDate  DateTime
  reminderTime  String?
  message       String?
  isCompleted   Boolean   @default(false)
  createdBy     Int?
  createdAt     DateTime  @default(now())
  reservation   Reservation @relation(fields: [reservationId], references: [id])
}
```

---

# KOLEJNOŚĆ IMPLEMENTACJI

```
1.  Prisma: dodaj nowe pola do Reservation + model ReservationReminder + migracja
2.  Lewa kolumna: Dodaj sekcję DANE POKOJU na górze
3.  Lewa kolumna: Upewnij się że OKRES POBYTU jest widoczny i kompletny
4.  Lewa kolumna: Przenieś Źródło/Kanał/Wyżywienie/ETA (wytnij z lewej)
5.  Lewa kolumna: Dodaj listę gości (occupants) z przyciskami
6.  Lewa kolumna: Dodaj historię gościa (rozwijane)
7.  Lewa kolumna: Dodaj przypomnienie + checkbox "Pokaż na grafiku" w uwagach
8.  Prawa: Rozliczenie — tabela cen z grupami wiekowymi + trzeci tryb cenowy
9.  Prawa: Rozliczenie — pola wpłat (wpłata, zaliczka, voucher, kaucja) + rabat
10. Prawa: Rozliczenie — checkboxy (opłata miejscowa, gwarancja kartą)
11. Prawa: Rozliczenie — statusy dynamiczne + przycisk melduj/wymelduj
12. Prawa: Dodaj zakładkę Pozostałe (z przeniesionymi polami + nowe)
13. Prawa: Dodaj zakładkę Własne (placeholder lub dynamiczne pola)
14. Prawa: Dodaj zakładkę Parking
15. Footer: Dodaj brakujące przyciski (Towary, Wystaw dok., Ceny/dni, Usuń, Płatności, Historia)
16. Footer: Dialog Ceny/dni, Dialog Usuń rezerwację
17. Integracja: reservation-bar.tsx — uwagi na grafiku, ostrzeżenie o zaliczce
18. Testy i weryfikacja
```

---

# CHECKLIST

## Lewa kolumna:
- [ ] Sekcja DANE POKOJU na górze (typ, numer, łóżka, wyposażenie, opis)
- [ ] Zmiana typu → filtruje pokoje
- [ ] Zmiana pokoju → wyświetla info
- [ ] Sekcja OKRES POBYTU widoczna (daty, godziny, pill buttons nocy, pax)
- [ ] Pill buttons nocy (1-7) działają
- [ ] Godziny check-in/check-out edytowalne
- [ ] Źródło/Kanał/Wyżywienie/ETA USUNIĘTE z lewej kolumny
- [ ] Sekcja DANE GOŚCIA na miejscu
- [ ] Lista GOŚCI W POKOJU z Dodaj/Edytuj/Usuń
- [ ] addReservationOccupant podłączony
- [ ] removeReservationOccupant podłączony
- [ ] HISTORIA gościa — rozwijany panel z listą pobytów
- [ ] Historia ładowana leniwie (lazy load)
- [ ] Sekcja UWAGI: textarea + "Pokaż na grafiku" checkbox
- [ ] Sekcja UWAGI: uwagi wewnętrzne (drugie textarea)
- [ ] PRZYPOMNIENIE: checkbox + data + godzina + treść

## Prawa kolumna — Rozliczenie:
- [ ] Tabela cen z grupami wiekowymi (Dorośli, Dz.1, Dz.2, Dz.3)
- [ ] Trzeci tryb cenowy "Plan cenowy" z dropdown RateCode
- [ ] Auto-fill cen po wyborze planu
- [ ] Pola: Wpłata + metoda płatności + przycisk "Zapłacono"
- [ ] Pole: Zaliczka
- [ ] Pole: Termin wpłaty zaliczki (date)
- [ ] Pole: Voucher + typ
- [ ] Pole: Kaucja
- [ ] Rabat: pole % + obliczanie kwoty
- [ ] Checkbox "Dolicz opłatę miejscową" + obliczanie
- [ ] Checkbox "Płatność gwarantowana kartą"
- [ ] Status dynamiczny (filtrowane opcje wg etapu)
- [ ] Dodatkowy status (dropdown)
- [ ] Przycisk "Melduj gościa" (gdy status = CONFIRMED)
- [ ] Przycisk "Wymelduj i zapisz" (gdy status = CHECKED_IN)

## Zakładki:
- [ ] Kolejność: Rozlicz./Dok./Posiłki/Parking/Pozost./Własne/Usługi/Sprząt./Meldunek
- [ ] Zakładka PARKING istnieje (przypisanie miejsca, nr rejestracyjny)
- [ ] Zakładka POZOSTAŁE istnieje (Źródło, Kanał, Segment, Wyżyw., ETA, Nr online, Waluta, Kopiuj, Historia zmian)
- [ ] Zakładka WŁASNE istnieje (placeholder lub dynamiczne pola)

## Footer:
- [ ] Przycisk Towary → otwiera AddChargeDialog
- [ ] Przycisk Wystaw dok. → dropdown (Faktura, Rachunek, Proforma, Paragon)
- [ ] Przycisk Ceny/dni → dialog z ceną per dzień
- [ ] Przycisk Usuń rez. → dialog z powodem
- [ ] Przycisk Płatności → historia transakcji
- [ ] Przycisk Historia → audit log
- [ ] Przycisk Zapisz
- [ ] Przycisk Melduj/Wymelduj (dynamiczny)

## Integracja:
- [ ] TapeChart: uwagi na pasku rezerwacji (jeśli showNotesOnChart)
- [ ] TapeChart: ostrzeżenie o przeterminowanej zaliczce
- [ ] Istniejące funkcje NIE są zepsute
- [ ] Nowe pola Prisma dodane + migracja OK

---

# WAŻNE OSTRZEŻENIA

- NIE twórz nowych server actions jeśli istnieją odpowiedniki — PODŁĄCZ istniejące
- Sprawdź `settlement-tab.tsx` — tam jest ISTNIEJĄCA logika rozliczenia. ROZBUDUJ ją, nie pisz od zera
- Sprawdź `components/tape-chart/dialogs/` — tam mogą być istniejące dialogi
- `AddChargeDialog` JUŻ ISTNIEJE w `components/add-charge-dialog.tsx`
- `receipt-dialog.tsx`, `preauth-dialog.tsx` JUŻ ISTNIEJĄ
- Model `ReservationOccupant` JUŻ ISTNIEJE — sprawdź relacje w schema.prisma
- Model `ParkingSpot`, `ParkingBooking` JUŻ ISTNIEJĄ
- Model `AuditLog` JUŻ ISTNIEJE — użyj do historii zmian
- Nowe pola w Reservation MUSZĄ być opcjonalne (nullable) — backward compatible
# MODUŁ: Rozbudowa Cennika — Pełna specyfikacja + Implementacja

> **CEL:** Rozbudować istniejący moduł cennika do poziomu KWHotel.
> **STAN OBECNY:** RatePlan z validFrom/validTo/price/minStay/maxStay/isNonRefundable/isWeekendHoliday.
> Brak: grup wiekowych, cen dziennych, CTA/CTD, sezonów, posiłków w planie, cenników godzinowych.
> **ZASADA:** Przeczytaj CAŁY dokument. Implementuj WSZYSTKO. Nie pomijaj sekcji.

---

## ISTNIEJĄCE ZASOBY (NIE USUWAJ, ROZBUDUJ)

### Modele Prisma (obecne):
```
RoomType    { id, name (unique), basePrice, sortOrder }
RatePlan    { id, roomTypeId, validFrom, validTo, price, minStayNights, maxStayNights, isNonRefundable, isWeekendHoliday }
DerivedRateRule { id, name, type (PERCENT_ADD|FIXED_ADD), value, description }
RateCode    { id, code, name, ... }
CennikConfig { ... waluta, VAT, ceny netto ... }
HotelConfig { ... seasons (Json) ... }
```

### Server Actions (obecne w `app/actions/rooms.ts`):
- `getEffectivePriceForRoomOnDate` — oblicza cenę pokoju na datę
- `getRatePlansForDate` — plany cenowe na datę
- `getCennikForDate` — cennik na datę
- `createRatePlan` — tworzenie planu
- `copyRatePlansFromYearToYear` — kopiowanie planów

### Inne pliki:
- `app/actions/cennik-config.ts` — konfiguracja cennika
- `app/actions/rate-codes.ts` — kody cenowe
- `app/actions/derived-rates.ts` — reguły pochodne
- `app/actions/seasons.ts` — sezony (sprawdź co jest)
- `app/cennik/page.tsx` — strona cennika
- `app/cennik/reguly-pochodne/page.tsx` — reguły pochodne
- `app/cennik/wydruk/page.tsx` — wydruk cennika
- `app/ustawienia/sezony/page.tsx` — konfiguracja sezonów

---

# CZĘŚĆ A: ZMIANY W SCHEMACIE BAZY DANYCH

## A1. Rozbudowa modelu `RatePlan`

Dodaj nowe pola do istniejącego modelu `RatePlan` w `prisma/schema.prisma`:

```prisma
model RatePlan {
  // === ISTNIEJĄCE POLA (nie zmieniaj) ===
  id                Int       @id @default(autoincrement())
  roomTypeId        Int
  validFrom         DateTime
  validTo           DateTime
  price             Decimal   @db.Decimal(10, 2)
  minStayNights     Int?
  maxStayNights     Int?
  isNonRefundable   Boolean   @default(false)
  isWeekendHoliday  Boolean   @default(false)
  // ... inne istniejące pola ...

  // === NOWE POLA — DODAJ ===

  // Cena za osobę (oprócz ceny bazowej za pokój)
  pricePerPerson      Decimal?  @db.Decimal(10, 2)

  // Grupy wiekowe — cena per osoba w grupie
  adultPrice          Decimal?  @db.Decimal(10, 2)   // cena za dorosłego
  child1Price         Decimal?  @db.Decimal(10, 2)   // dziecko grupa 1 (np. 0-6 lat)
  child2Price         Decimal?  @db.Decimal(10, 2)   // dziecko grupa 2 (np. 7-12 lat)
  child3Price         Decimal?  @db.Decimal(10, 2)   // dziecko grupa 3 (np. 13-17 lat)

  // Restrykcje
  closedToArrival     Boolean   @default(false)      // zakaz zameldowania w tym okresie
  closedToDeparture   Boolean   @default(false)      // zakaz wymeldowania w tym okresie

  // Powiązanie z sezonem (opcjonalne)
  seasonId            Int?

  // Posiłki wliczone w cenę
  includedMealPlan    String?   // np. "BB", "HB", "FB", "AI" — jaki plan wyżywienia wchodzi w cenę

  // Relacje
  roomType  RoomType  @relation(fields: [roomTypeId], references: [id])
  season    Season?   @relation(fields: [seasonId], references: [id])
}
```

## A2. Nowy model `Season` (jeśli nie istnieje jako osobna tabela)

Sprawdź najpierw: `HotelConfig.seasons` jest Json. Potrzebujemy PRAWDZIWEJ tabeli żeby powiązać z RatePlan.

```prisma
model Season {
  id          Int       @id @default(autoincrement())
  propertyId  Int
  name        String              // np. "Sezon wysoki", "Sezon niski", "Święta"
  color       String?             // kolor na grafiku/cenniku (#FF5733)
  dateFrom    DateTime
  dateTo      DateTime
  year        Int                 // rok (sezony definiowane per rok)
  sortOrder   Int       @default(0)
  isActive    Boolean   @default(true)

  // Relacje
  property    Property  @relation(fields: [propertyId], references: [id])
  ratePlans   RatePlan[]

  @@unique([propertyId, name, year])
}
```

**UWAGA:** Jeśli `app/actions/seasons.ts` i `/ustawienia/sezony` już istnieją z własnym modelem — NIE twórz duplikatu. Rozbuduj istniejący model o brakujące pola (color, year, relacja do RatePlan). Sprawdź schema.prisma PRZED dodaniem.

## A3. Nowy model `DailyRateOverride`

Nadpisanie ceny z RatePlan na konkretny dzień (np. Sylwester, długi weekend):

```prisma
model DailyRateOverride {
  id            Int       @id @default(autoincrement())
  propertyId    Int
  roomTypeId    Int
  date          DateTime  @db.Date    // konkretny dzień
  price         Decimal?  @db.Decimal(10, 2)   // nadpisana cena bazowa (null = bez nadpisania)
  pricePerPerson  Decimal?  @db.Decimal(10, 2) // nadpisana cena za osobę
  adultPrice    Decimal?  @db.Decimal(10, 2)
  child1Price   Decimal?  @db.Decimal(10, 2)
  child2Price   Decimal?  @db.Decimal(10, 2)
  child3Price   Decimal?  @db.Decimal(10, 2)
  closedToArrival   Boolean @default(false)
  closedToDeparture Boolean @default(false)
  isClosed      Boolean   @default(false)    // dzień całkowicie zamknięty na sprzedaż
  reason        String?                       // powód nadpisania (np. "Sylwester")
  createdBy     Int?
  createdAt     DateTime  @default(now())

  property  Property  @relation(fields: [propertyId], references: [id])
  roomType  RoomType  @relation(fields: [roomTypeId], references: [id])

  @@unique([propertyId, roomTypeId, date])
}
```

## A4. Nowy model `AgeGroupConfig`

Konfiguracja zakresów wiekowych (globalna dla hotelu):

```prisma
model AgeGroupConfig {
  id          Int     @id @default(autoincrement())
  propertyId  Int
  group       String  // "ADULT", "CHILD1", "CHILD2", "CHILD3"
  label       String  // "Dorosły", "Dziecko 0-6", "Dziecko 7-12", "Dziecko 13-17"
  ageFrom     Int     // dolna granica wieku (włącznie)
  ageTo       Int     // górna granica wieku (włącznie)
  sortOrder   Int     @default(0)

  property    Property @relation(fields: [propertyId], references: [id])

  @@unique([propertyId, group])
}
```

## A5. Nowy model `LongStayDiscount`

Rabaty za długie pobyty:

```prisma
model LongStayDiscount {
  id              Int     @id @default(autoincrement())
  propertyId      Int
  minNights       Int             // np. 7, 14, 30
  discountPercent Decimal? @db.Decimal(5, 2)  // rabat procentowy (np. 10.00 = 10%)
  discountFixed   Decimal? @db.Decimal(10, 2) // lub rabat kwotowy za dobę
  isActive        Boolean @default(true)

  property Property @relation(fields: [propertyId], references: [id])

  @@unique([propertyId, minNights])
}
```

## A6. Nowy model `ServiceRate`

Cenniki za usługi stałe (parking, zwierzęta, dostawka):

```prisma
model ServiceRate {
  id              Int     @id @default(autoincrement())
  propertyId      Int
  name            String            // "Parking", "Zwierzę", "Dostawka"
  code            String            // "PARKING", "PET", "EXTRA_BED"
  price           Decimal @db.Decimal(10, 2)
  calculationMethod String @default("PER_NIGHT") // PER_NIGHT, PER_STAY, PER_PERSON_PER_NIGHT, ONE_TIME
  vatRate         Decimal? @db.Decimal(5, 2)
  isActive        Boolean @default(true)
  sortOrder       Int     @default(0)

  property Property @relation(fields: [propertyId], references: [id])

  @@unique([propertyId, code])
}
```

## A7. Nowy model `HourlyRate` (opcjonalnie — dla sal konferencyjnych)

```prisma
model HourlyRate {
  id          Int     @id @default(autoincrement())
  propertyId  Int
  roomTypeId  Int
  pricePerHour Decimal @db.Decimal(10, 2)
  minHours    Int     @default(1)
  maxHours    Int?
  isActive    Boolean @default(true)

  property  Property @relation(fields: [propertyId], references: [id])
  roomType  RoomType @relation(fields: [roomTypeId], references: [id])

  @@unique([propertyId, roomTypeId])
}
```

---

## Po dodaniu modeli — uruchom migrację:
```bash
npx prisma migrate dev --name add-pricing-expansion
```

---

# CZĘŚĆ B: SERVER ACTIONS

## B1. Rozbudowa `app/actions/rooms.ts`

### Nowa funkcja: `getEffectivePriceForRoomOnDate` — ROZBUDUJ istniejącą

Obecna logika prawdopodobnie: znajdź RatePlan dla roomType na datę → zwróć price.

**Nowa logika (priorytet cen):**

```
1. Sprawdź DailyRateOverride dla (roomTypeId, date)
   → Jeśli istnieje i ma price → użyj tych cen (nadpisanie ma najwyższy priorytet)
   → Jeśli isClosed = true → zwróć null/error (dzień zamknięty)
2. Jeśli brak override → sprawdź RatePlan dla (roomTypeId, date)
   → Znajdź plan WHERE validFrom <= date AND validTo >= date
   → Jeśli isWeekendHoliday = true → tylko dla Sob/Nie
   → Jeśli closedToArrival = true i date === checkIn → zwróć informację o restrykcji
   → Jeśli closedToDeparture = true i date === checkOut → zwróć informację o restrykcji
3. Jeśli brak planu → użyj RoomType.basePrice
4. Zastosuj LongStayDiscount jeśli pobyt >= minNights
5. Zastosuj DerivedRateRule jeśli istnieje
```

**Zwracany obiekt powinien zawierać:**
```typescript
interface EffectivePrice {
  basePrice: number;           // cena za pokój
  pricePerPerson: number | null; // cena za osobę
  adultPrice: number | null;
  child1Price: number | null;
  child2Price: number | null;
  child3Price: number | null;
  source: 'OVERRIDE' | 'RATE_PLAN' | 'BASE_PRICE'; // skąd cena
  ratePlanId: number | null;
  seasonName: string | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  isClosed: boolean;
  longStayDiscount: number | null; // procent rabatu
  includedMealPlan: string | null;
}
```

### Nowe funkcje — dodaj w `rooms.ts`:

```typescript
// --- DAILY RATE OVERRIDES ---

export async function getDailyRateOverrides(params: {
  propertyId: number;
  roomTypeId?: number;
  dateFrom: string;
  dateTo: string;
}): Promise<DailyRateOverride[]>
// Query: WHERE propertyId AND date >= dateFrom AND date <= dateTo
// Opcjonalnie filtruj po roomTypeId

export async function setDailyRateOverride(params: {
  propertyId: number;
  roomTypeId: number;
  date: string;
  price?: number;
  pricePerPerson?: number;
  adultPrice?: number;
  child1Price?: number;
  child2Price?: number;
  child3Price?: number;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  isClosed?: boolean;
  reason?: string;
}): Promise<DailyRateOverride>
// Upsert: jeśli istnieje → update, jeśli nie → create

export async function deleteDailyRateOverride(params: {
  propertyId: number;
  roomTypeId: number;
  date: string;
}): Promise<void>

export async function bulkSetDailyRateOverrides(params: {
  propertyId: number;
  roomTypeIds: number[];    // wiele typów naraz
  dateFrom: string;
  dateTo: string;
  price?: number;
  adjustmentType?: 'SET' | 'PERCENT_ADD' | 'FIXED_ADD';  // ustaw / dodaj % / dodaj kwotę
  adjustmentValue?: number;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  isClosed?: boolean;
  reason?: string;
}): Promise<{ created: number; updated: number }>
// Dla każdego dnia w zakresie × każdego roomType → upsert override

// --- LONG STAY DISCOUNTS ---

export async function getLongStayDiscounts(propertyId: number): Promise<LongStayDiscount[]>

export async function saveLongStayDiscount(params: {
  propertyId: number;
  minNights: number;
  discountPercent?: number;
  discountFixed?: number;
  isActive: boolean;
}): Promise<LongStayDiscount>
// Upsert po (propertyId, minNights)

export async function deleteLongStayDiscount(id: number): Promise<void>

// --- SERVICE RATES ---

export async function getServiceRates(propertyId: number): Promise<ServiceRate[]>

export async function saveServiceRate(params: {
  id?: number;
  propertyId: number;
  name: string;
  code: string;
  price: number;
  calculationMethod: string;
  vatRate?: number;
  isActive: boolean;
}): Promise<ServiceRate>

export async function deleteServiceRate(id: number): Promise<void>

// --- AGE GROUPS ---

export async function getAgeGroupConfig(propertyId: number): Promise<AgeGroupConfig[]>

export async function saveAgeGroupConfig(params: {
  propertyId: number;
  groups: Array<{
    group: string;
    label: string;
    ageFrom: number;
    ageTo: number;
  }>;
}): Promise<AgeGroupConfig[]>
// Usuń stare i wstaw nowe (deleteMany + createMany)
```

## B2. Rozbudowa tworzenia RatePlan

Istniejąca funkcja `createRatePlan` w `rooms.ts` — rozbuduj o nowe pola:

```typescript
export async function createRatePlan(params: {
  roomTypeId: number;
  validFrom: string;
  validTo: string;
  price: number;
  // === NOWE POLA ===
  pricePerPerson?: number;
  adultPrice?: number;
  child1Price?: number;
  child2Price?: number;
  child3Price?: number;
  minStayNights?: number;
  maxStayNights?: number;
  isNonRefundable?: boolean;
  isWeekendHoliday?: boolean;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  seasonId?: number;
  includedMealPlan?: string;
}): Promise<RatePlan>
```

Analogicznie rozbuduj `updateRatePlan` (jeśli istnieje) lub dodaj.

## B3. Kopiowanie planów cenowych z modyfikacją

```typescript
export async function copyRatePlansWithModification(params: {
  sourceRoomTypeId: number;
  targetRoomTypeId: number;        // może być ten sam (kopiowanie dat)
  sourceDateFrom: string;
  sourceDateTo: string;
  targetDateFrom: string;          // nowe daty
  targetDateTo: string;
  adjustmentType: 'NONE' | 'PERCENT' | 'FIXED'; // bez zmian / +/- % / +/- kwota
  adjustmentValue: number;         // np. 10 = +10%, -5 = -5 PLN
}): Promise<{ copied: number }>
```

---

# CZĘŚĆ C: ROZBUDOWA UI — STRONA CENNIKA

## C1. Layout strony `/cennik` — DOCELOWY WIDOK

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  💰 Cennik                                                     [Karczma Łabędź] │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─ ZAKŁADKI ────────────────────────────────────────────────────────────────┐   │
│  │  [Plany cenowe]  [Ceny dzienne]  [Sezony]  [Grupy wiekowe]               │   │
│  │  [Usługi stałe]  [Długie pobyty]  [Reguły pochodne]  [Wydruk]            │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  (zawartość zależna od wybranej zakładki — opisane poniżej)                      │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Uwaga: Zakładki "Reguły pochodne" i "Wydruk" JUŻ ISTNIEJĄ jako osobne strony (`/cennik/reguly-pochodne`, `/cennik/wydruk`). Zamień na zakładki w ramach jednej strony LUB zostaw jako linki w nawigacji — zdecyduj co jest prostsze. Preferowane: zakładki (Tabs).

## C2. Zakładka "Plany cenowe" — rozbudowa istniejącego widoku

Istniejący widok prawdopodobnie pokazuje listę planów. Rozbuduj o:

### Formularz tworzenia/edycji RatePlan:

```
┌─ Nowy Plan Cenowy ──────────────────────────────────────────────────────────────┐
│                                                                                  │
│  Typ pokoju: [▼ Comfort          ]   Sezon: [▼ Sezon wysoki    ]               │
│                                                                                  │
│  Data od: [📅 01.06.2026]   Data do: [📅 31.08.2026]                           │
│                                                                                  │
│  ┌─ CENY ─────────────────────────────────────────────────────────────────────┐  │
│  │                                                                             │  │
│  │  Tryb:  (●) Cena za pokój  (○) Cena za osobę  (○) Cena za pokój + osoby   │  │
│  │                                                                             │  │
│  │  Cena bazowa (za pokój/dobę):  [  350,00 ] PLN                             │  │
│  │                                                                             │  │
│  │  ── Ceny za osoby (jeśli tryb "za osoby" lub "pokój + osoby") ──          │  │
│  │  Cena za dorosłego:            [  150,00 ] PLN                             │  │
│  │  Cena za dziecko 0-6 lat:     [    0,00 ] PLN                             │  │
│  │  Cena za dziecko 7-12 lat:    [   75,00 ] PLN                             │  │
│  │  Cena za dziecko 13-17 lat:   [  120,00 ] PLN                             │  │
│  │                                                                             │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌─ RESTRYKCJE ───────────────────────────────────────────────────────────────┐  │
│  │  Min. pobyt: [  1 ] noce     Max. pobyt: [  30 ] noce                     │  │
│  │  ☐ Closed to Arrival (zakaz zameldowania w tym okresie)                     │  │
│  │  ☐ Closed to Departure (zakaz wymeldowania w tym okresie)                   │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌─ OPCJE ────────────────────────────────────────────────────────────────────┐  │
│  │  ☐ Tylko weekend / święta                                                   │  │
│  │  ☐ Bezzwrotny (non-refundable)                                              │  │
│  │  Wliczony plan wyżywienia: [▼ Brak ] (opcje: Brak, BB, HB, FB, AI)        │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  [Anuluj]  [Zapisz plan cenowy]                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Lista planów cenowych — tabela:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Typ pokoju │ Sezon         │ Od         │ Do         │ Cena baz. │ Za os. │ CTA│
│  ───────────┼───────────────┼────────────┼────────────┼───────────┼────────┼────│
│  Comfort    │ Sezon wysoki  │ 01.06.2026 │ 31.08.2026 │ 350,00    │ 150,00 │  - │
│  Comfort    │ Sezon niski   │ 01.09.2026 │ 31.05.2027 │ 250,00    │ 100,00 │  - │
│  Suite      │ Sezon wysoki  │ 01.06.2026 │ 31.08.2026 │ 600,00    │ 200,00 │  - │
│  Suite      │ Sylwester     │ 30.12.2026 │ 02.01.2027 │ 900,00    │ 300,00 │ ✓ │
│                                                                                  │
│  [+ Nowy plan]  [📋 Kopiuj z modyfikacją]                                       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- Klik na wiersz → edycja w formularzu powyżej
- Przycisk "Kopiuj z modyfikacją" → dialog (opisany w B3)

## C3. Zakładka "Ceny dzienne" — NOWY WIDOK

Widok kalendarza/siatki pokazujący ceny na każdy dzień z możliwością edycji:

```
┌─ Ceny dzienne ──────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  Miesiąc: [◀ Luty 2026 ▶]     Typ pokoju: [▼ Wszystkie]                        │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │           │ Pon 2  │ Wt 3   │ Śr 4   │ Czw 5  │ Pt 6   │ Sob 7  │ Nd 8  │ │
│  │  ─────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────│ │
│  │  Comfort  │ 250    │ 250    │ 250    │ 250    │ 250    │ *350*  │ *350* │ │
│  │  Suite    │ 450    │ 450    │ 450    │ 450    │ 450    │ *600*  │ *600* │ │
│  │  Standard │ 180    │ 180    │ 180    │ 180    │ 180    │ *220*  │ *220* │ │
│  │                                                                             │ │
│  │  *kursywa* = cena weekendowa    **bold** = nadpisanie dzienne               │ │
│  │  🔴 = zamknięty    🟡 = CTA    🟠 = CTD                                    │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  Klik na komórkę → edycja ceny na ten dzień                                      │
│  Zaznacz wiele komórek (Shift+klik lub drag) → hurtowa zmiana                    │
│                                                                                  │
│  [Zmiana hurtowa: Zaznaczone komórki]  [Wyczyść nadpisania za okres]             │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Dialog edycji ceny dziennej (klik na komórkę):

```
┌─ Cena na 07.02.2026 — Comfort ─────────────────────────┐
│                                                          │
│  Cena z planu cenowego: 250,00 PLN (Sezon niski)        │
│                                                          │
│  ☑ Nadpisz cenę na ten dzień                            │
│                                                          │
│  Cena bazowa:        [ 350,00 ] PLN                     │
│  Cena za dorosłego:  [ 150,00 ] PLN                     │
│  Dziecko 0-6:        [   0,00 ] PLN                     │
│  Dziecko 7-12:       [  75,00 ] PLN                     │
│  Dziecko 13-17:      [ 120,00 ] PLN                     │
│                                                          │
│  ☐ Closed to Arrival                                    │
│  ☐ Closed to Departure                                  │
│  ☐ Zamknięty (nie do sprzedaży)                         │
│                                                          │
│  Powód: [ Długi weekend _________________ ]             │
│                                                          │
│  [Usuń nadpisanie]  [Anuluj]  [Zapisz]                  │
└──────────────────────────────────────────────────────────┘
```

### Dialog zmiany hurtowej (wiele komórek):

```
┌─ Zmiana hurtowa ────────────────────────────────────────┐
│                                                          │
│  Zakres: 01.02.2026 — 28.02.2026                        │
│  Typy:   ☑ Comfort  ☑ Suite  ☐ Standard                │
│                                                          │
│  Operacja:                                               │
│  (○) Ustaw cenę:     [ ______ ] PLN                     │
│  (●) Dodaj procent:  [ +10    ] %                       │
│  (○) Dodaj kwotę:    [ ______ ] PLN                     │
│                                                          │
│  ☐ Closed to Arrival                                    │
│  ☐ Closed to Departure                                  │
│  ☐ Zamknij na sprzedaż                                  │
│                                                          │
│  Powód: [ _________________________________ ]           │
│                                                          │
│  Podgląd: 28 dni × 2 typy = 56 nadpisań                │
│                                                          │
│  [Anuluj]  [Zastosuj]                                    │
└──────────────────────────────────────────────────────────┘
```

## C4. Zakładka "Sezony"

Może już istnieć (`/ustawienia/sezony`). Jeśli tak — PRZENIEŚ do zakładki w cenniku lub dodaj link.

```
┌─ Sezony ────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  Rok: [▼ 2026]                                                                  │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  Nazwa           │ Kolor │ Od         │ Do         │ Aktywny │ Akcje      │ │
│  │  ────────────────┼───────┼────────────┼────────────┼─────────┼────────────│ │
│  │  Sezon wysoki    │ 🟥    │ 01.06.2026 │ 31.08.2026 │ ✅      │ [✏️] [🗑️] │ │
│  │  Sezon niski     │ 🟦    │ 01.09.2026 │ 31.05.2027 │ ✅      │ [✏️] [🗑️] │ │
│  │  Święta Bożonar. │ 🟨    │ 23.12.2026 │ 26.12.2026 │ ✅      │ [✏️] [🗑️] │ │
│  │  Sylwester       │ 🟧    │ 30.12.2026 │ 02.01.2027 │ ✅      │ [✏️] [🗑️] │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  [+ Nowy sezon]  [📋 Kopiuj sezony z poprzedniego roku]                         │
│                                                                                  │
│  ┌─ Podgląd wizualny (timeline) ───────────────────────────────────────────────┐ │
│  │  Sty  Lut  Mar  Kwi  Maj  Cze  Lip  Sie  Wrz  Paź  Lis  Gru              │ │
│  │  ─────────────────────────█████████████████████───────────────█──           │ │
│  │  🟦 niski                 🟥 wysoki            🟦 niski      🟨🟧          │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Timeline: prosty `<div>` z kolorowanymi segmentami proporcjonalnymi do dni w roku. Nie musi być interaktywny.

## C5. Zakładka "Grupy wiekowe"

```
┌─ Konfiguracja grup wiekowych ───────────────────────────────────────────────────┐
│                                                                                  │
│  Te grupy określają jak system liczy ceny za osoby w rezerwacjach.              │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  Grupa        │ Etykieta          │ Wiek od │ Wiek do │                    │ │
│  │  ─────────────┼───────────────────┼─────────┼─────────│                    │ │
│  │  Dorosły      │ [ Dorosły       ] │ [ 18  ] │ [ 99  ] │                    │ │
│  │  Dziecko gr.1 │ [ Dziecko 0-6   ] │ [  0  ] │ [  6  ] │                    │ │
│  │  Dziecko gr.2 │ [ Dziecko 7-12  ] │ [  7  ] │ [ 12  ] │                    │ │
│  │  Dziecko gr.3 │ [ Dziecko 13-17 ] │ [ 13  ] │ [ 17  ] │                    │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  ⚠️ Zmiana zakresów wpłynie na naliczanie cen w NOWYCH rezerwacjach.            │
│     Istniejące rezerwacje nie zostaną zmienione.                                 │
│                                                                                  │
│  [Zapisz]                                                                        │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## C6. Zakładka "Usługi stałe"

```
┌─ Cennik usług stałych ─────────────────────────────────────────────────────────┐
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  Nazwa       │ Kod      │ Cena    │ Naliczanie        │ VAT  │ Aktywna    │ │
│  │  ────────────┼──────────┼─────────┼───────────────────┼──────┼────────────│ │
│  │  Parking     │ PARKING  │  30,00  │ za dobę           │ 23%  │ ✅  [✏️🗑️]│ │
│  │  Zwierzę     │ PET      │  50,00  │ za pobyt          │ 23%  │ ✅  [✏️🗑️]│ │
│  │  Dostawka    │ EXTRA_BED│  80,00  │ za osobo-dobę     │  8%  │ ✅  [✏️🗑️]│ │
│  │  Łóżeczko dz.│BABY_COT │   0,00  │ za pobyt          │  -   │ ✅  [✏️🗑️]│ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  [+ Nowa usługa]                                                                 │
│                                                                                  │
│  Metody naliczania:                                                              │
│  • za dobę (PER_NIGHT) — cena × liczba nocy                                     │
│  • za pobyt (PER_STAY) — jednorazowo                                             │
│  • za osobo-dobę (PER_PERSON_PER_NIGHT) — cena × osoby × noce                   │
│  • jednorazowo (ONE_TIME) — raz przy zameldowaniu                                │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## C7. Zakładka "Długie pobyty"

```
┌─ Rabaty za długie pobyty ───────────────────────────────────────────────────────┐
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  Min. noce │ Rabat           │ Aktywny │ Akcje                             │ │
│  │  ──────────┼─────────────────┼─────────┼───────                            │ │
│  │  7         │ 5%              │ ✅      │ [✏️] [🗑️]                         │ │
│  │  14        │ 10%             │ ✅      │ [✏️] [🗑️]                         │ │
│  │  30        │ 15%             │ ✅      │ [✏️] [🗑️]                         │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  [+ Nowy próg rabatowy]                                                          │
│                                                                                  │
│  Przykład: Pobyt 10 nocy → rabat 5% (próg 7 nocy)                               │
│  Rabaty nie kumulują się — stosowany jest NAJWYŻSZY pasujący próg.              │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

# CZĘŚĆ D: INTEGRACJA Z RESZTĄ SYSTEMU

## D1. Okno rezerwacji — cennik w formularzu

W istniejącym oknie edycji rezerwacji (tape-chart dialog, zakładka Rozliczenie):

1. **Dodaj trzeci radio button** w trybie cenowym:
   ```
   (●) Cena za pokój  (○) Cena za osobę  (○) Plan cenowy [▼ wybierz]
   ```
   Jeśli "Plan cenowy" wybrany → dropdown z listą RatePlan/RateCode → ceny auto-fill.

2. **Pokaż ceny grup wiekowych** gdy są dostępne:
   ```
   Dorośli: [2] × 150,00 = 300,00
   Dz. 0-6: [1] × 0,00 = 0,00
   Dz. 7-12: [0] × 75,00 = 0,00
   Dz. 13-17: [0] × 120,00 = 0,00
   Bazowa pokoju: 350,00
   Suma/dobę: 650,00
   ```

3. **Pokaż restrykcje** jeśli CTA/CTD aktywne:
   ```
   ⚠️ Closed to Arrival w dniu 15.06 — zameldowanie niedostępne
   ```

4. **Pokaż rabat za długi pobyt** jeśli pasuje:
   ```
   ℹ️ Rabat za długi pobyt (10 nocy): -5% = -32,50 PLN/dobę
   ```

## D2. TapeChart — ceny na grafiku

W istniejącym TapeChart (jeśli ceny na grafiku JUŻ działają — sprawdź):
- Korzystaj z nowej logiki `getEffectivePriceForRoomOnDate` żeby wyświetlać poprawne ceny
- Pokaż nadpisania dzienne BOLD, normalne zwykłą czcionką
- Pokaż CTA/CTD jako kolorowe znaczniki na dniach (opcjonalnie — jeśli czas pozwala)

## D3. Booking Engine — ceny z grup wiekowych

W `app/actions/booking-engine.ts`:
- `getRoomTypesForBooking` — uwzględnij ceny z grup wiekowych
- Zwracaj ceny per grupa w odpowiedzi
- Formularz booking: dodaj pola na liczbę dzieci per grupa wiekowa

---

# CZĘŚĆ E: PLIKI DO UTWORZENIA / MODYFIKACJI — PODSUMOWANIE

### Nowe pliki:
```
app/cennik/components/
├── rate-plan-form.tsx           — formularz tworzenia/edycji planu
├── rate-plan-list.tsx           — lista planów cenowych
├── daily-rates-grid.tsx         — siatka cen dziennych (kalendarza)
├── daily-rate-edit-dialog.tsx   — dialog edycji ceny na dzień
├── bulk-change-dialog.tsx       — dialog zmiany hurtowej
├── copy-plans-dialog.tsx        — dialog kopiowania planów z modyfikacją
├── seasons-tab.tsx              — zakładka Sezony (lub link do /ustawienia/sezony)
├── seasons-timeline.tsx         — wizualny timeline sezonów
├── age-groups-tab.tsx           — zakładka Grupy wiekowe
├── service-rates-tab.tsx        — zakładka Usługi stałe
├── long-stay-tab.tsx            — zakładka Długie pobyty
```

### Modyfikacja istniejących:
```
prisma/schema.prisma                — nowe modele + pola w RatePlan
app/actions/rooms.ts                — nowe server actions + rozbudowa getEffectivePriceForRoomOnDate
app/cennik/page.tsx                 — zamień na tabbed layout z zakładkami
components/tape-chart/tabs/settlement-tab.tsx — grupy wiekowe, trzeci tryb cenowy
app/actions/booking-engine.ts       — grupy wiekowe w booking
```

---

# CZĘŚĆ F: KOLEJNOŚĆ IMPLEMENTACJI

```
1. Schema Prisma (A1-A7) + migracja
2. Server actions — CRUD dla nowych modeli (B1-B3)
3. Zakładka "Grupy wiekowe" (C5) — najprostsza, pozwala przetestować pipeline
4. Zakładka "Usługi stałe" (C6) — CRUD prosty
5. Zakładka "Długie pobyty" (C7) — CRUD prosty
6. Zakładka "Sezony" (C4) — z timeline
7. Rozbudowa formularza planu cenowego (C2) — nowe pola, restrykcje
8. Zakładka "Ceny dzienne" (C3) — siatka + edycja + bulk
9. Integracja: getEffectivePriceForRoomOnDate (B1 — rozbudowa)
10. Integracja: okno rezerwacji (D1)
11. Integracja: booking engine (D3)
12. Testy i weryfikacja
```

---

# CZĘŚĆ G: CHECKLIST

## Schema i migracja:
- [ ] Model Season istnieje (lub rozbudowany istniejący)
- [ ] RatePlan ma nowe pola: pricePerPerson, adultPrice, child1-3Price, closedToArrival, closedToDeparture, seasonId, includedMealPlan
- [ ] Model DailyRateOverride istnieje
- [ ] Model AgeGroupConfig istnieje
- [ ] Model LongStayDiscount istnieje
- [ ] Model ServiceRate istnieje
- [ ] Model HourlyRate istnieje
- [ ] Migracja przeszła bez błędów

## Server actions:
- [ ] getDailyRateOverrides działa
- [ ] setDailyRateOverride działa (upsert)
- [ ] deleteDailyRateOverride działa
- [ ] bulkSetDailyRateOverrides działa
- [ ] getLongStayDiscounts działa
- [ ] saveLongStayDiscount działa
- [ ] deleteLongStayDiscount działa
- [ ] getServiceRates działa
- [ ] saveServiceRate działa
- [ ] deleteServiceRate działa
- [ ] getAgeGroupConfig działa
- [ ] saveAgeGroupConfig działa
- [ ] createRatePlan obsługuje NOWE pola
- [ ] copyRatePlansWithModification działa
- [ ] getEffectivePriceForRoomOnDate uwzględnia: overrides > ratePlan > basePrice + longStay + derived

## UI — zakładki cennika:
- [ ] Strona /cennik ma zakładki (Tabs)
- [ ] Zakładka "Plany cenowe": lista planów + formularz z NOWYMI polami
- [ ] Formularz: grupy wiekowe (4 pola cen) widoczne i działają
- [ ] Formularz: CTA/CTD checkboxy działają
- [ ] Formularz: dropdown sezonu działa
- [ ] Formularz: dropdown wyżywienia działa
- [ ] Zakładka "Ceny dzienne": siatka miesiąca z cenami
- [ ] Siatka: klik na komórkę → dialog edycji
- [ ] Siatka: bulk selection → dialog zmiany hurtowej
- [ ] Siatka: nadpisania bold, weekendy kursywa
- [ ] Siatka: CTA/CTD oznaczone kolorowo
- [ ] Zakładka "Sezony": lista + CRUD + timeline wizualny
- [ ] Zakładka "Grupy wiekowe": 4 grupy z etykietami i zakresami
- [ ] Zakładka "Usługi stałe": lista + CRUD
- [ ] Zakładka "Długie pobyty": lista progów + CRUD

## Integracja:
- [ ] Okno rezerwacji: trzeci tryb cenowy "Plan cenowy" działa
- [ ] Okno rezerwacji: ceny grup wiekowych wyświetlają się
- [ ] Okno rezerwacji: restrykcje CTA/CTD sygnalizowane
- [ ] Okno rezerwacji: rabat za długi pobyt wyświetla się
- [ ] Istniejące rezerwacje NIE są zepsute (ceny bez grup wiekowych nadal działają)
- [ ] TapeChart nadal działa
- [ ] Booking engine nadal działa

---

# WAŻNE OSTRZEŻENIA

- Nowe pola w RatePlan są OPCJONALNE (nullable) — istniejące plany nie muszą mieć grup wiekowych
- `getEffectivePriceForRoomOnDate` MUSI być backward-compatible — jeśli brak nowych pól, zachowuj się jak dotychczas
- NIE usuwaj istniejących server actions — rozbudowuj je
- NIE zmieniaj nazw istniejących pól w Prisma — tylko DODAWAJ nowe
- ServiceRate, LongStayDiscount, AgeGroupConfig — jeśli PODOBNE modele już istnieją pod innymi nazwami w schema.prisma → ROZBUDUJ istniejące zamiast tworzyć nowe
- Sprawdź `app/actions/seasons.ts` — jeśli Season model JUŻ ISTNIEJE → nie twórz duplikatu
- Sprawdź `HotelConfig.seasons` (Json) — może trzeba migrować dane z Json do tabeli Season
# MODUŁ: Quick Booking na Dashboardzie + Baza Wyposażenia Pokoi

> Dwa mniejsze moduły w jednym dokumencie.
> Przeczytaj CAŁY. Zrób WSZYSTKO. Sprawdź checklistę na końcu.

---

# ═══════════════════════════════════════════════════════
# CZĘŚĆ 1: QUICK BOOKING NA DASHBOARDZIE
# ═══════════════════════════════════════════════════════

## CEL

Na dashboardzie (`/dashboard`) dodać widżet "Szybka rezerwacja" — recepcjonista wpisuje daty,
typ pokoju, liczbę osób → system proponuje pokój i cenę → jedno kliknięcie tworzy rezerwację.

Odpowiednik KWHotel "Quick booking" z Dashboardu (punkt 4.5 audytu).

## ISTNIEJĄCE ZASOBY

- `app/dashboard/page.tsx` — strona dashboardu
- `components/Dashboard.tsx` — komponent dashboardu
- `app/actions/reservations.ts` — `create` (tworzenie rezerwacji), `walk-in` (walk-in)
- `app/actions/rooms.ts` — `getEffectivePriceForRoomOnDate`, `getRooms`
- `app/actions/booking-engine.ts` — `getBookingAvailability`

## LAYOUT WIDŻETU

```
┌─ Szybka rezerwacja ──────────────────────────────────────────────────┐
│                                                                       │
│  Check-in: [📅 27.02.2026]  Check-out: [📅 01.03.2026]  Noce: 2    │
│  Typ:      [▼ Comfort     ]  Dorośli: [▼ 2]  Dzieci: [▼ 0]        │
│                                                                       │
│  [🔍 Szukaj dostępny pokój]                                          │
│                                                                       │
│  ┌─ Wynik ──────────────────────────────────────────────────────────┐│
│  │  ✅ Pokój 101 (Comfort, piętro 1) — dostępny                    ││
│  │  Cena: 350,00 PLN/dobę × 2 noce = 700,00 PLN                    ││
│  │                                                                    ││
│  │  Gość: [🔍 Szukaj lub wpisz nazwisko...          ]               ││
│  │  Tel:  [+48 _______________]  Email: [___________]               ││
│  │                                                                    ││
│  │  [Utwórz rezerwację]  [Otwórz pełny formularz]                  ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  Jeśli brak dostępnych: "Brak wolnych pokoi typu Comfort na 27.02"   │
│  [Pokaż inne typy z dostępnością]                                    │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## IMPLEMENTACJA

### 1. Nowy komponent `components/QuickBooking.tsx`

```tsx
'use client';

interface QuickBookingProps {
  rooms: Room[];
  roomTypes: RoomType[];
}

// Stan:
// - checkIn, checkOut (daty)
// - roomTypeId (dropdown)
// - adults, children (dropdowny 1-10)
// - searchResult: { room, price, nights } | null
// - guestSearch (string)
// - selectedGuest: Guest | null
// - newGuestName, newGuestPhone, newGuestEmail (jeśli nowy gość)
// - isSearching, isCreating (loading states)
```

### 2. Logika szukania pokoju

Po kliknięciu "Szukaj dostępny pokój":

```typescript
async function handleSearch() {
  // 1. Pobierz dostępność
  const availability = await getBookingAvailability({
    propertyId,
    checkIn: checkIn.toISOString(),
    checkOut: checkOut.toISOString(),
    roomTypeId,
    adults,
    children,
  });

  // 2. Jeśli brak — pokaż komunikat
  if (!availability || availability.availableRooms.length === 0) {
    setSearchResult({ available: false });
    return;
  }

  // 3. Wybierz najlepszy pokój (pierwszy dostępny, wg sell_priority jeśli jest)
  const bestRoom = availability.availableRooms[0];

  // 4. Pobierz cenę
  const price = await getEffectivePriceForRoomOnDate({
    roomId: bestRoom.id,
    date: checkIn.toISOString(),
  });

  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

  setSearchResult({
    available: true,
    room: bestRoom,
    pricePerNight: price.basePrice,
    totalPrice: price.basePrice * nights,
    nights,
  });
}
```

### 3. Szukanie gościa

Input z debounce 300ms:
```typescript
// Użyj istniejącego searchGuests z reservations.ts
const results = await searchGuests(guestSearch);
// Pokaż dropdown z wynikami
// Klik na wynik → setSelectedGuest(guest)
// Lub "Nowy gość" → pokaż pola name/phone/email
```

### 4. Tworzenie rezerwacji

```typescript
async function handleCreateReservation() {
  // Użyj istniejącej akcji create z reservations.ts
  const reservation = await createReservation({
    roomId: searchResult.room.id,
    guestId: selectedGuest?.id,
    // Jeśli nowy gość — najpierw utwórz gościa
    checkIn,
    checkOut,
    adults,
    children,
    source: 'WALK_IN',  // lub 'PHONE'
    status: 'CONFIRMED',
  });

  // Po utworzeniu: toast "Rezerwacja #X utworzona"
  // Opcjonalnie: otwórz pełne okno edycji
}
```

### 5. Przycisk "Otwórz pełny formularz"

Zamiast szybkiego tworzenia → otwiera okno edycji rezerwacji z pre-filled danymi (daty, pokój, gość).

### 6. Podłączenie do Dashboardu

W `components/Dashboard.tsx` lub `app/dashboard/page.tsx`:
```tsx
<QuickBooking rooms={rooms} roomTypes={roomTypes} />
```

Umieść widżet np. pod statystykami, przed listą przyjazdów. Lub w osobnej karcie/sekcji.

## CHECKLIST — Quick Booking

- [ ] Widżet Quick Booking widoczny na dashboardzie
- [ ] Date pickery check-in/check-out działają
- [ ] Dropdown typ pokoju działa
- [ ] Dropdown dorośli/dzieci działa
- [ ] Przycisk "Szukaj" → znajduje pokój
- [ ] Wyświetla: numer pokoju, cenę, sumę
- [ ] Brak pokoi → komunikat
- [ ] Szukanie gościa działa (searchGuests)
- [ ] Tworzenie rezerwacji działa (jedno kliknięcie)
- [ ] Toast po utworzeniu
- [ ] "Otwórz pełny formularz" → okno edycji rezerwacji
- [ ] Dashboard nadal działa (nie zepsute)

---

# ═══════════════════════════════════════════════════════
# CZĘŚĆ 2: BAZA WYPOSAŻENIA POKOI
# ═══════════════════════════════════════════════════════

## CEL

System zarządzania wyposażeniem pokoi — lista sprzętu (TV, minibar, klimatyzacja, suszarka, sejf...),
przypisywanie do pokoi, śledzenie stanu (sprawny / do naprawy / do wymiany).

Odpowiednik KWHotel sekcja 1.1-1.2 audytu.

## STAN OBECNY

- `Room.roomFeatures` — pole tekstowe/JSON z listą cech (np. "TV, WiFi, Łazienka")
- Brak osobnej tabeli wyposażenia
- Brak śledzenia stanu sprzętu
- Brak historii napraw

## NOWE MODELE PRISMA

```prisma
model Equipment {
  id          Int       @id @default(autoincrement())
  propertyId  Int
  name        String              // "Telewizor 42\" Samsung"
  category    String              // "TV", "MINIBAR", "AC", "SAFE", "DRYER", "BATHROOM", "FURNITURE", "OTHER"
  serialNumber String?            // numer seryjny
  purchaseDate DateTime?          // data zakupu
  warrantyUntil DateTime?         // gwarancja do
  notes       String?             // uwagi
  isActive    Boolean   @default(true)

  property    Property  @relation(fields: [propertyId], references: [id])
  assignments EquipmentAssignment[]
  repairs     EquipmentRepair[]

  @@index([propertyId, category])
}

model EquipmentAssignment {
  id          Int       @id @default(autoincrement())
  equipmentId Int
  roomId      Int
  assignedAt  DateTime  @default(now())
  removedAt   DateTime?            // null = aktualnie w pokoju
  status      String    @default("OK")  // OK, NEEDS_REPAIR, NEEDS_REPLACEMENT, OUT_OF_ORDER

  equipment   Equipment @relation(fields: [equipmentId], references: [id])
  room        Room      @relation(fields: [roomId], references: [id])

  @@index([roomId, removedAt])
}

model EquipmentRepair {
  id            Int       @id @default(autoincrement())
  equipmentId   Int
  roomId        Int?                // pokój w którym było przy zgłoszeniu
  reportedAt    DateTime  @default(now())
  reportedBy    Int?                // user ID
  description   String              // opis usterki
  priority      String    @default("NORMAL")  // LOW, NORMAL, HIGH, URGENT
  status        String    @default("REPORTED")  // REPORTED, IN_PROGRESS, COMPLETED, CANCELLED
  assignedTo    String?             // osoba odpowiedzialna
  completedAt   DateTime?
  completionNotes String?           // co zrobiono
  cost          Decimal?  @db.Decimal(10, 2)  // koszt naprawy

  equipment     Equipment @relation(fields: [equipmentId], references: [id])

  @@index([status])
}
```

## NOWY MODEL `EquipmentTemplate` (opcjonalnie)

Predefiniowane typy wyposażenia do szybkiego dodawania:

```prisma
model EquipmentTemplate {
  id          Int     @id @default(autoincrement())
  propertyId  Int
  name        String            // "TV 42\" Samsung"
  category    String
  isDefault   Boolean @default(false)  // domyślne wyposażenie nowego pokoju

  property    Property @relation(fields: [propertyId], references: [id])
}
```

## SERVER ACTIONS

Utwórz nowy plik: `app/actions/equipment.ts`

```typescript
'use server';

// --- CRUD Wyposażenia ---
export async function getEquipment(propertyId: number): Promise<Equipment[]>
export async function createEquipment(data: {...}): Promise<Equipment>
export async function updateEquipment(id: number, data: {...}): Promise<Equipment>
export async function deleteEquipment(id: number): Promise<void>

// --- Przypisywanie do pokoi ---
export async function getEquipmentForRoom(roomId: number): Promise<EquipmentAssignment[]>
// Zwraca sprzęt aktualnie w pokoju (removedAt IS NULL) + status

export async function assignEquipmentToRoom(equipmentId: number, roomId: number): Promise<EquipmentAssignment>
// Tworzy nowy assignment. Jeśli sprzęt jest w innym pokoju → przenieś (ustaw removedAt na starym)

export async function removeEquipmentFromRoom(assignmentId: number): Promise<void>
// Ustaw removedAt = now()

export async function updateEquipmentStatus(assignmentId: number, status: string): Promise<EquipmentAssignment>
// Zmiana statusu: OK → NEEDS_REPAIR → NEEDS_REPLACEMENT

export async function getEquipmentByCategory(propertyId: number, category?: string): Promise<Equipment[]>

export async function bulkAssignEquipment(roomId: number, equipmentIds: number[]): Promise<void>
// Przypisz wiele urządzeń do pokoju naraz

// --- Naprawy ---
export async function getRepairs(params: {
  propertyId: number;
  status?: string;
  priority?: string;
  roomId?: number;
}): Promise<EquipmentRepair[]>

export async function createRepair(data: {
  equipmentId: number;
  roomId?: number;
  description: string;
  priority: string;
  reportedBy?: number;
}): Promise<EquipmentRepair>

export async function updateRepair(id: number, data: {
  status?: string;
  assignedTo?: string;
  completionNotes?: string;
  cost?: number;
}): Promise<EquipmentRepair>

// --- Raporty ---
export async function getEquipmentReport(propertyId: number): Promise<{
  totalItems: number;
  needsRepair: number;
  needsReplacement: number;
  outOfOrder: number;
  activeRepairs: number;
  repairCostThisMonth: number;
}>
```

## UI — STRONA WYPOSAŻENIA

### Nowa strona: `app/wyposazenie/page.tsx`

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  🔧 Wyposażenie pokoi                                      [Karczma Łabędź]    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  [Sprzęt]  [Przypisania]  [Naprawy]  [Raport]                                  │
│                                                                                  │
│  ┌─ ZAKŁADKA: Sprzęt ───────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  Kategoria: [▼ Wszystkie]    Szukaj: [🔍 ________________]              │   │
│  │                                                                           │   │
│  │  Nazwa              │ Kategoria │ Nr seryjny │ Pokój  │ Status  │ Akcje │   │
│  │  ───────────────────┼───────────┼────────────┼────────┼─────────┼───────│   │
│  │  TV Samsung 42"     │ TV        │ SN-123456  │ 101    │ ✅ OK   │ ✏️🗑️ │   │
│  │  Minibar Dometic    │ MINIBAR   │ SN-789012  │ 101    │ 🔧 Napr.│ ✏️🗑️ │   │
│  │  Klimatyzacja LG    │ AC        │ SN-345678  │ 102    │ ✅ OK   │ ✏️🗑️ │   │
│  │  Sejf Burg-Wächter  │ SAFE      │ -          │ (mag.) │ ✅ OK   │ ✏️🗑️ │   │
│  │                                                                           │   │
│  │  [+ Dodaj sprzęt]  [📋 Importuj z szablonu]                              │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─ ZAKŁADKA: Przypisania ──────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  Pokój: [▼ 101]                                                          │   │
│  │                                                                           │   │
│  │  Wyposażenie pokoju 101:                                                  │   │
│  │  ☑ TV Samsung 42" ..................... ✅ OK                             │   │
│  │  ☑ Minibar Dometic .................... 🔧 Do naprawy                    │   │
│  │  ☑ Klimatyzacja LG ................... ✅ OK                             │   │
│  │  ☑ Suszarka do włosów ................ ✅ OK                             │   │
│  │  ☐ Sejf Burg-Wächter (w magazynie)                                       │   │
│  │                                                                           │   │
│  │  [Zapisz zmiany]  [Zgłoś naprawę]                                       │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─ ZAKŁADKA: Naprawy ─────────────────────────────────────────────────────┐    │
│  │                                                                           │   │
│  │  Status: [▼ Zgłoszone]  Priorytet: [▼ Wszystkie]                        │   │
│  │                                                                           │   │
│  │  Sprzęt           │ Pokój │ Opis        │ Priorytet │ Status    │ Data  │   │
│  │  ─────────────────┼───────┼─────────────┼───────────┼───────────┼───────│   │
│  │  Minibar Dometic  │ 101   │ Nie chłodzi │ Wysoki    │ Zgłoszono │ 25.02│   │
│  │  TV Samsung       │ 205   │ Brak obrazu │ Normalny  │ W trakcie │ 24.02│   │
│  │                                                                           │   │
│  │  [+ Zgłoś naprawę]                                                       │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Sidebar — dodaj link:
```tsx
{ title: "Wyposażenie", url: "/wyposazenie", icon: Wrench }  // lucide-react
```

W sekcji "Housekeeping" lub "Zarządzanie pokojami".

### Integracja z oknem pokoju `/pokoje`:
Na stronie zarządzania pokojami — przy każdym pokoju pokaż skrót wyposażenia:
```
Pokój 101 | Comfort | Piętro 1 | Wyposażenie: TV, Minibar, AC, Sejf (🔧 1 do naprawy)
```

### Integracja z oknem rezerwacji:
W sekcji DANE POKOJU (Brak 1 z okna rezerwacji) — pole "Wyposażenie" czytaj z `EquipmentAssignment` zamiast z `Room.roomFeatures` (lub jako fallback jeśli brak assignments).

## PLIKI DO UTWORZENIA

```
app/wyposazenie/
├── page.tsx                    — SSR wrapper
├── wyposazenie-client.tsx      — główny klient z zakładkami
├── equipment-list-tab.tsx      — lista sprzętu + CRUD
├── assignments-tab.tsx         — przypisania do pokoi
├── repairs-tab.tsx             — naprawy
├── report-tab.tsx              — raport
├── equipment-form-dialog.tsx   — formularz dodawania/edycji sprzętu
├── repair-form-dialog.tsx      — formularz zgłoszenia naprawy
app/actions/equipment.ts        — server actions
```

## CHECKLIST — Baza Wyposażenia

### Prisma:
- [ ] Model Equipment istnieje
- [ ] Model EquipmentAssignment istnieje
- [ ] Model EquipmentRepair istnieje
- [ ] Migracja OK

### Server Actions:
- [ ] getEquipment zwraca listę
- [ ] createEquipment tworzy nowy sprzęt
- [ ] assignEquipmentToRoom przypisuje
- [ ] removeEquipmentFromRoom usuwa przypisanie
- [ ] updateEquipmentStatus zmienia status
- [ ] getEquipmentForRoom zwraca sprzęt w pokoju
- [ ] createRepair zgłasza naprawę
- [ ] updateRepair zmienia status naprawy
- [ ] getRepairs z filtrami
- [ ] getEquipmentReport zwraca statystyki

### UI:
- [ ] Strona /wyposazenie istnieje
- [ ] Link w sidebar działa
- [ ] Zakładka Sprzęt: lista z filtrami + CRUD
- [ ] Zakładka Przypisania: widok pokoju + checkboxy
- [ ] Zakładka Naprawy: lista zgłoszeń + CRUD
- [ ] Zakładka Raport: statystyki
- [ ] Formularz dodawania sprzętu działa
- [ ] Formularz zgłaszania naprawy działa
- [ ] Status badge: OK (zielony), Do naprawy (żółty), Do wymiany (czerwony)

### Integracja:
- [ ] Okno rezerwacji: sekcja Dane Pokoju czyta wyposażenie
- [ ] Strona /pokoje: skrót wyposażenia przy pokoju
- [ ] Dashboard/housekeeping: info o naprawach (opcjonalnie)