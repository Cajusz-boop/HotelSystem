# ARCHITECTURE.md — ŁabędzSystem (HotelSystem)

> **CEL TEGO PLIKU**: Kontekst architektoniczny dla AI (Cursor/Claude).
> Cursor MUSI przeczytać ten plik przed każdą zmianą w kodzie.
> Aktualizuj po każdym istotnym merge/bugfixie.

---

## 1. STACK & DEPLOY

| Warstwa        | Technologia                              |
|----------------|------------------------------------------|
| Framework      | Next.js 14 (App Router, Server Actions)  |
| Język          | TypeScript (strict)                      |
| ORM            | Prisma (jedyne źródło prawdy dla bazy)   |
| Baza           | MySQL (Hetzner VPS)                      |
| UI             | shadcn/ui + Tailwind CSS                 |
| Deploy         | GitHub Actions → Hetzner, PM2            |
| Node flag      | `NODE_OPTIONS=--max-old-space-size=2048` |
| Prisma migrate | `prisma db push` (w CI/CD)              |

---

## 2. MODUŁY PRODUKCYJNE (krytyczne — nie łam!)

### 2.1 TapeChart + Rezerwacje
- **Główny widok**: grafik pokojów (CSS Grid, NIE @tanstack/react-virtual — usunięte po bugu zoom)
- **Model bazowy**: `Reservation` → `Room`, `Guest`, `Company`, `RateCode`
- **Statusy rezerwacji**: `PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT` (+ `CANCELLED`, `NO_SHOW`)
- **Pricing flow**: RateCode.price/basePrice/pricePerPerson → RatePlan (daty/sezon) → DailyRateOverride → ReservationDayRate (per dzień)
- **Grupy**: `ReservationGroup` — wiele rezerwacji pod jednym ID (wesela, grupy firmowe)
- **Folio**: `ReservationFolio` (split billing: GUEST / COMPANY, multi-folio per rezerwacja)

### 2.2 Fakturowanie (VAT / Fiskalne)
- **Faktury**: `Invoice` + `InvoiceLineItem` + `InvoiceCorrection`
- **Typy faktur**: NORMAL, ADVANCE, FINAL; sourceType: RESERVATION, EVENT, VOUCHER, MANUAL, CONSOLIDATED
- **Faktura zbiorcza**: `Invoice` z `companyId` + `InvoiceReservation[]` (snapshot danych per rezerwacja)
- **Numeracja**: `DocumentNumberingConfig` + `DocumentNumberCounter` (prefix/separator/rok/miesiąc/seria)
- **Szablony**: `InvoiceTemplate` (logo, dane sprzedawcy, stopka, kolory)
- **KSeF**: `KsefSession` → `KsefSentBatch` → `KsefPendingSend` (kolejka retry przy 5xx MF)
- **Paragony fiskalne**: `FiscalReceiptTemplate` + `FiscalJob` (kolejka drukowania)
- **Rachunki nie-VAT**: `Receipt` (dla zwolnionych z VAT)
- **Noty księgowe**: `AccountingNote` (DEBIT/CREDIT — kary, odszkodowania, odsetki)

### 2.3 Rozliczenia (tab "Rozlicz")
- **Transakcje**: `Transaction` — centralne konto gościa (ROOM, DEPOSIT, VOID, LOCAL_TAX, MINIBAR, GASTRONOMY, SPA, PARKING)
- **Folio**: `Transaction.folioNumber` (1, 2, 3...) — split billing
- **Płatności**: `paymentMethod` (CASH, CARD, TRANSFER, VOUCHER, BLIK, SPLIT)
- **VAT per pozycja**: `vatRate`, `vatAmount`, `netAmount` na Transaction
- **Override ceny**: `isManualOverride` + `originalAmount` — UWAGA: jeśli `isManualOverride=true`, auto-przeliczenie NIE nadpisuje kwoty!
- **Void**: `status` ACTIVE → VOIDED; `voidedAt`, `voidedBy`, `voidReason`
- **Rabaty**: `appliesToTransactionId` (rabat per pozycja) lub type=DISCOUNT bez niego (rabat na całość)
- **Refundacje**: `refundedTransactionId` wskazuje na oryginalną transakcję
- **Fakturowanie z rezerwacji**: `Reservation.invoiceSingleLine` (jedna linia vs rozbite), `invoiceScope` (ALL/HOTEL_ONLY/GASTRONOMY_ONLY)
- **Nadpisanie wpłat**: `Reservation.paidAmountOverride` — ręczna kwota na fakturze zamiast sumy transakcji

---

## 3. KLUCZOWE MODELE I ICH RELACJE

```
Property (obiekt hotelowy)
 ├── Room[] ──→ Reservation[] ──→ Transaction[]
 │                  │                   ├── Invoice?
 │                  │                   └── Receipt?
 │                  ├── Guest
 │                  ├── Company?
 │                  ├── RateCode?
 │                  ├── ReservationGroup?
 │                  ├── ReservationFolio[] (split billing)
 │                  ├── ReservationDayRate[] (ceny per dzień)
 │                  ├── ReservationSurcharge[] (dopłaty: EXTRA_BED, CHILD, PET)
 │                  ├── Invoice[] / Proforma[] / Receipt[]
 │                  ├── Order[] (gastronomia z POS)
 │                  ├── MealConsumption[] (tracking BB/HB/FB)
 │                  └── ... (SPA, Laundry, Transfer, Parking, Camping, Rental)
 ├── RoomGroup[] ──→ RoomGroupRoom[]
 ├── ParkingSpot[]
 └── SurchargeType[]

Guest
 ├── loyaltyTier? → LoyaltyTier
 ├── GuestRelation[] (rodzina/towarzyszący)
 ├── GuestDiscount[] (rabaty czasowe)
 └── ... (GDPR fields, preferencje, dokument tożsamości)

Company
 ├── CorporateContract[] (umowy cenowe)
 ├── Invoice[] (faktury zbiorcze)
 └── AccountingNote[]

EventOrder (imprezy: wesela, stypy, komunia)
 ├── Reservation[] (powiązane rezerwacje pokojów)
 ├── MenuPackage? (menu z dopłatami)
 └── Google Calendar sync (googleCalendarEvents JSON)
```

---

## 4. KONWENCJE KODOWE

### 4.1 Pricing — hierarchia źródeł ceny
1. `ReservationDayRate` (per dzień, edytowalna) — najwyższy priorytet
2. `DailyRateOverride` (nadpisanie na typ pokoju + dzień)
3. `RatePlan` (sezonowy cennik per typ pokoju)
4. `RateCode.price` / `RateCode.basePrice + pricePerPerson × pax`
5. `Room.price` (statyczna cena na pokoju — fallback)

**ZASADA**: Jeśli `Transaction.isManualOverride === true`, NIE nadpisuj kwoty automatycznie.

### 4.2 Identyfikatory
- Wszystkie ID: `cuid()` (string)
- NIP firmy: `Company.nip` (unique, 10 cyfr PL lub VAT UE)
- Numer rezerwacji: `Reservation.confirmationNumber` (unique, np. "ABC123")
- Numery dokumentów: `DocumentNumberingConfig` definiuje format

### 4.3 Daty
- `checkIn` / `checkOut`: `DateTime @db.Date` (bez godziny)
- **checkOut = ostatni dzień pobytu + 1** (konwencja: noc 01→02.03 = checkIn: 01.03, checkOut: 02.03)
- Godziny: `eta`/`etd`, `checkInTime`/`checkOutTime` jako `String` "HH:mm"

### 4.4 Kwoty / Pieniądze
- Wszystkie kwoty: `Decimal @db.Decimal(12, 2)` — NIE Float!
- VAT rate: `Decimal @db.Decimal(5, 2)` (np. 8.00 = 8%)
- Waluta domyślna: PLN (pole `currency` na Reservation, ale 99% to PLN)

### 4.5 Soft delete
- `Room.isDeleted` + `Room.deletedAt` + `Room.deletedBy`
- Rezerwacje: NIE mają soft delete — tylko `CANCELLED` status

### 4.6 JSON fields (ważne — Cursor musi znać strukturę!)
- `Property.mealPrices`: `{ breakfast: number, lunch: number, dinner: number }`
- `Property.statusCombinationColors`: `{ "CONFIRMED_PAID": "#hex", ... }`
- `Reservation.childrenAges`: `number[]` np. `[3, 7, 12]`
- `Reservation.securityDeposit`: `{ amount, collected, returned, refundDate, deductions, notes }`
- `Reservation.advancePayment`: `{ required, amount, dueDate, paid, paidDate, paidAmount, method, notes }`
- `Reservation.alerts`: `{ vip, badPayer, specialRequest, noShowHistory, blacklisted, loyalty, notes }`
- `Transaction.paymentDetails`: `{ methods: [{ type: "CASH", amount: 100 }, ...] }`
- `EventOrder.menu`: obiekt z wyborami z MenuPackage + dopłatami
- `Guest.mealPreferences`: `{ vegetarian, vegan, glutenFree, lactoseFree, halal, kosher, allergies: string[], other }`

---

## 5. INTEGRACJE

| System           | Model/Mechanizm                          | Status     |
|------------------|------------------------------------------|------------|
| POS-Karczma      | `Order` + `UnassignedGastronomyCharge`   | Produkcja  |
| KSeF (e-faktury) | `KsefSession` → `KsefSentBatch`         | W budowie  |
| Booking.com      | `ChannelMapping` + `ChannelPropertyConfig` | Plan C (GAS+scraping) |
| Google Calendar  | `EventOrder.googleCalendar*` fields      | Produkcja  |
| Drukarka fiskalna| `FiscalJob` (kolejka)                    | Produkcja  |
| Księgowość       | `AccountingExport` (Optima/Subiekt/wFirma) | Planowane |
| SMS              | `SmsLog` (Twilio/SMSAPI)                | Gotowe     |
| E-mail           | Google Workspace SMTP Relay + nodemailer/puppeteer | Produkcja |

---

## 6. SERVER ACTIONS (`app/actions/`)

### Core (rezerwacje, TapeChart, pokoje)
`reservations.ts`, `tape-chart.ts`, `rooms.ts`, `properties.ts`, `companies.ts`, `travel-agents.ts`, `booking-engine.ts`

### Finanse i faktury
`finance.ts`, `ksef.ts`, `jpk.ts`, `owner-settlements.ts`, `collections.ts`, `dunning.ts`, `reports-legal.ts`

### Pricing i cennik
`rate-codes.ts`, `cennik-config.ts`, `cennik-pricing.ts`, `seasons.ts`, `derived-rates.ts`, `surcharges.ts`, `packages.ts`, `cancellation-policy.ts`

### Dodatkowe usługi
`gastronomy.ts`, `meals.ts`, `assortment.ts`, `minibar.ts`, `spa.ts`, `laundry.ts`, `attractions.ts`, `transfers.ts`, `parking.ts`, `camping.ts`, `rentals.ts`

### Eventy i MICE
`mice.ts`, `hotel-events.ts`

### Goście i auth
`auth.ts`, `guest-auth.ts`, `guest-app.ts`, `digital-keys.ts`, `gdpr.ts`, `two-fa.ts`

### Blokady i lista oczekujących
`allotments.ts`, `waitlist.ts`

### Użytkownicy i uprawnienia
`users.ts`, `permissions.ts`, `session-settings.ts`

### Komunikacja
`email.ts`, `mailing.ts`, `sms.ts`, `staff-announcements.ts`, `shift-handover.ts`, `telephony.ts`

### Konfiguracja i integracje
`hotel-config.ts`, `integrations.ts`, `channel-manager.ts`, `dictionaries.ts`, `loyalty.ts`

### Raporty, audit, eksport
`dashboard.ts`, `scheduled-reports.ts`, `audit.ts`, `export-pms.ts`, `import-pms.ts`

### Specjalne
`web-check-in.ts`, `kiosk.ts`, `training-demo.ts`

---

## 7. PUŁAPKI (znane bugi / regresje — Cursor MUSI to wiedzieć)

### 🔴 P1 — Krytyczne (zepsuły produkcję)

1. **isManualOverride blokuje auto-pricing**
   - Kiedy: Auto-przeliczenie cen w "Rozlicz" tab
   - Problem: Jeśli kiedykolwiek ręcznie zmieniono cenę (`isManualOverride=true`), automatyczna kalkulacja zwraca 0.00 PLN
   - Zasada: ZAWSZE sprawdzaj `isManualOverride` przed auto-update. Jeśli true → nie ruszaj.

2. **TapeChart zoom — dwa systemy pozycjonowania**
   - Kiedy: Zmiana zoom w TapeChart
   - Problem: `@tanstack/react-virtual` i CSS Grid liczyły pozycje niezależnie → paski "jechały" przy zoom ≠ 100%
   - Rozwiązanie: Usunięto react-virtual, wszystko na CSS Grid
   - Zasada: NIE dodawaj virtualizacji do TapeChart bez pełnego testu zoom.

3. **Faktura zbiorcza — companyId filtering**
   - Kiedy: Generowanie faktury zbiorczej z TapeChart
   - Problem: Filtrowanie rezerwacji po `companyId` pomijało rezerwacje z `companyId` na folio (nie na rezerwacji)
   - Zasada: Sprawdzaj `companyId` ZARÓWNO na `Reservation` JAK i na `ReservationFolio`.

4. **KWHotel migration — DataDo off-by-one**
   - Kiedy: Import rezerwacji z KWHotel
   - Problem: `DataDo` w KWHotel = ostatnia noc (nie checkout). Poprawka: `checkOut = DataDo + 1`
   - Zasada: Przy imporcie z zewnętrznych systemów — zawsze weryfikuj konwencję dat.

### 🟡 P2 — Ważne (wymagały debugowania)

5. **Night Audit — edycja zablokowanych transakcji**
   - `Transaction.isReadOnly = true` po Night Audit
   - Recepcja nie może edytować — tylko MANAGER może (role-based permission)

6. **Double-window bug w fakturach**
   - Otwarcie dwóch okien faktury jednocześnie → duplikat numeracji
   - Zasada: Numeracja (`DocumentNumberCounter`) musi być atomowa (transaction/lock).

7. **MariaDB case sensitivity (dev→prod)**
   - Windows: `lower_case_table_names=1` (case-insensitive)
   - Linux: `lower_case_table_names=0` (case-sensitive)
   - Zasada: Nazwy tabel w Prisma schema ZAWSZE PascalCase. Na Linux wymaga `RENAME TABLE`.

### 🟢 P3 — Dobre do wiedzenia

8. **Booking.com iCal nie działa dla multi-unit room types** → Plan C (GAS monitoring)
9. **DOM overload na TapeChart** — limit ~18k elementów, rozwiązany redukcją zakresu dat (365→42 dni w widoku tygodniowym)
10. **IndexedDB corruption w POS** — nie dotyczy HotelSystem, ale uwaga przy integracji z POS-Karczma
11. **syncEventQuote — pozycje RESERVATION z brutto fallback**
    - Kiedy: Transaction bez unitPrice/netAmount
    - Problem: fallback na tx.amount = brutto, kosztorys liczy to jako netto
    - Zasada: przy tworzeniu Transaction ZAWSZE ustawiaj unitPrice i netAmount

---

## 8. SCHEMA OVERVIEW (~80 modeli)

### Core (rezerwacje + goście)
`Property`, `Room`, `RoomType`, `RoomGroup`, `RoomGroupRoom`, `Guest`, `GuestRelation`, `GuestDiscount`, `GuestAppToken`, `Company`, `CorporateContract`, `TravelAgent`, `Reservation`, `ReservationGroup`, `ReservationOccupant`, `ReservationFolio`, `ReservationDayRate`, `ReservationSurcharge`

### Pricing
`RateCode`, `RatePlan`, `DerivedRateRule`, `DailyRateOverride`, `LongStayDiscount`, `Season`, `ServiceRate`, `AgeGroupConfig`, `CennikConfig`, `Package`, `PackageComponent`

### Finanse
`Transaction`, `Invoice`, `InvoiceLineItem`, `InvoiceCorrection`, `InvoiceReservation`, `Proforma`, `Receipt`, `AccountingNote`, `PaymentLink`, `CardPreauth`, `CardSettlementBatch`, `CashShift`, `CashDocument`, `BlindDropRecord`, `DocumentNumberingConfig`, `DocumentNumberCounter`

### Dokumenty i szablony
`InvoiceTemplate`, `DocumentTemplate`, `FiscalReceiptTemplate`, `EmailTemplate`

### Gastronomia (integracja z POS)
`MenuItem`, `Order`, `OrderItem`, `MealConsumption`, `UnassignedGastronomyCharge`, `Dish`, `AssortmentItem`

### Menu imprezowe
`MenuPackage`, `MenuPackageSection`, `MenuPackageSurcharge`

### Eventy / MICE
`EventOrder`, `GroupQuote`, `HotelEvent`

### Dodatkowe usługi
`SpaResource`, `SpaBooking`, `LaundryService`, `LaundryOrder`, `LaundryOrderItem`, `TransferBooking`, `Attraction`, `AttractionBooking`, `MinibarItem`, `MinibarConsumption`, `ShopProduct`, `ReceptionSale`, `ReceptionSaleItem`, `ParkingSpot`, `ParkingBooking`, `Campsite`, `CampsiteBooking`, `RentalItem`, `RentalBooking`, `PhoneCallLog`

### Housekeeping
`CleaningSchedule`, `MaintenanceIssue`

### Użytkownicy i uprawnienia
`User`, `Permission`, `RolePermission`, `RoleGroup`, `RoleGroupPermission`

### Lojalnościowy
`LoyaltyProgram`, `LoyaltyTier`, `LoyaltyTransaction`

### Vouchery
`GiftVoucher`, `VoucherRedemption`, `VoucherTemplate`

### Waluta
`CurrencyExchangeRate`, `CurrencyConversion`

### KSeF
`KsefSession`, `KsefSentBatch`, `KsefPendingSend`

### Channel Manager
`ChannelMapping`, `ChannelPropertyConfig`

### Audit / Logs / Config
`AuditLog`, `LoginLog`, `DunningLog`, `CollectionCase`, `SmsLog`, `SurchargeType`, `HotelConfig`, `ScheduledReport`, `FiscalJob`, `AccountingExport`, `OwnerSettlement`

### Kalendarz
`GoogleCalendarWatchChannel`, `ShiftHandover`, `StaffAnnouncement`, `WebCheckInToken`

### Blokady
`RoomBlock`, `Allotment`, `WaitlistEntry`

---

## 9. ZASADY DLA CURSORA

### Przed każdą zmianą:
1. **Przeczytaj ten plik** — sprawdź sekcję 7. PUŁAPKI
2. **Faza rekonesansu** — wylistuj pliki do zmiany + istniejące funkcje do reużycia
3. **Nie twórz duplikatów** — sprawdź czy server action / helper / komponent już istnieje
4. **Sprawdź isManualOverride** — przy każdej zmianie w Transaction/pricing

### Przy dodawaniu nowego modelu:
1. Dodaj do `schema.prisma` → `prisma db push`
2. Dodaj indeksy (`@@index`) na FK i pola filtrowania
3. Zaktualizuj ten plik (sekcja 8)
4. Kwoty = `Decimal @db.Decimal(12, 2)`, nie Float

### Przy modyfikacji fakturowania:
1. Sprawdź `DocumentNumberingConfig` — format numeracji
2. Uwaga na atomowość `DocumentNumberCounter`
3. Nie łam `InvoiceTemplate` — logo/dane sprzedawcy stamtąd
4. KSeF flow: Invoice → KsefSession → KsefSentBatch

### Przy modyfikacji TapeChart:
1. Nie dodawaj react-virtual (usunięte celowo)
2. CSS Grid = jedyny system pozycjonowania
3. Testuj zoom 50%, 75%, 100%, 125%, 150%
4. DOM budget: max ~18k elementów

---

## 10. CHANGELOG PUŁAPEK

| Data       | Pułapka | Commit/PR | Rozwiązanie |
|------------|---------|-----------|-------------|
| —          | isManualOverride 0.00 PLN | — | Guard na isManualOverride przed auto-calc |
| —          | TapeChart zoom divergence | — | Usunięto react-virtual, pure CSS Grid |
| —          | companyId filtering zbiorcza | — | Sprawdzaj company na Reservation + Folio |
| —          | DataDo off-by-one KWHotel | — | checkOut = DataDo + 1 |
| 2025-03-13 | syncEventQuote brutto fallback | — | TODO: wymusić unitPrice/netAmount na Transaction |

> **Aktualizuj tę tabelę po każdym bugfixie!**
