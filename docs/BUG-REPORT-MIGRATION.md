# BUG REPORT dla Claude - Problem migracji danych KWHotel → HotelSystem

## Co nie działa
Migracja rezerwacji z bazy KWHotel do HotelSystem pomija **długoterminowe rezerwacje** zaczynające się przed datą widoczną na grafiku. W efekcie na TapeChart brakuje rezerwacji typu "szef" (pokoje 002, 007) które trwają od listopada/grudnia 2025 do maja 2026.

## Gdzie w kodzie
- **Skrypt migracji:** `c:\HotelSystem\prisma\migrate-kwhotel.ts`
- **TapeChart (renderowanie):** `c:\HotelSystem\components\tape-chart\index.tsx` - funkcja `reservationPlacements` (linie ~1162-1188)

## Co powinno się dziać
Rezerwacje z KWHotel o `DataOd` wcześniejszej niż widoczny zakres, ale `DataDo` w widocznym zakresie, powinny być zaimportowane i wyświetlane na TapeChart (ucięte od lewej strony).

## Co się dzieje
1. **Migracja:** Długoterminowe rezerwacje (np. DataOd=2025-11-19, DataDo=2026-05-09) nie zostały zaimportowane
2. **TapeChart:** Nawet gdyby były, logika `reservationPlacements` filtruje je bo `startIdx = dateIndex.get(res.checkIn)` zwraca `null` dla dat poza zakresem

---

## SUROWE DANE Z KWHotel (plik kw_aktualny.sql) - okres 24.02-10.03.2026

```
RezID=49236 PokojID=1  DataOd=2026-02-23 DataDo=2026-02-26 Cena=940    Osob=1 KlientID=10744
RezID=32126 PokojID=2  DataOd=2025-11-19 DataDo=2026-05-09 Cena=0      Osob=2 KlientID=4247  Uwagi={Z powodów osobistych} ← DŁUGOTERMINOWA "SZEF"
RezID=49231 PokojID=2  DataOd=2026-02-23 DataDo=2026-02-26 Cena=1140   Osob=2 KlientID=10744
RezID=49245 PokojID=2  DataOd=2026-03-02 DataDo=2026-03-05 Cena=1020   Osob=1 KlientID=30389
RezID=49232 PokojID=3  DataOd=2026-02-23 DataDo=2026-02-26 Cena=1140   Osob=2 KlientID=10744
RezID=49246 PokojID=3  DataOd=2026-03-02 DataDo=2026-03-05 Cena=1020   Osob=1 KlientID=30389
RezID=49233 PokojID=4  DataOd=2026-02-23 DataDo=2026-02-26 Cena=1140   Osob=2 KlientID=10744
RezID=49247 PokojID=4  DataOd=2026-03-02 DataDo=2026-03-05 Cena=1020   Osob=1 KlientID=30389
RezID=49256 PokojID=5  DataOd=2026-02-24 DataDo=2026-02-24 Cena=240    Osob=1 KlientID=30394
RezID=49242 PokojID=5  DataOd=2026-02-25 DataDo=2026-02-26 Cena=578    Osob=1 KlientID=2890
RezID=49248 PokojID=5  DataOd=2026-03-02 DataDo=2026-03-05 Cena=1020   Osob=1 KlientID=30389
RezID=49243 PokojID=6  DataOd=2026-02-25 DataDo=2026-02-26 Cena=602.8  Osob=1 KlientID=2890
RezID=31710 PokojID=7  DataOd=2025-12-31 DataDo=2026-05-09 Cena=0      Osob=2 KlientID=4247  ← DŁUGOTERMINOWA "SZEF"
RezID=49258 PokojID=7  DataOd=2026-02-25 DataDo=2026-02-25 Cena=235    Osob=1 KlientID=12038
RezID=49269 PokojID=7  DataOd=2026-02-26 DataDo=2026-02-26 Cena=361.8  Osob=1 KlientID=30403
RezID=49263 PokojID=7  DataOd=2026-02-27 DataDo=2026-02-27 Cena=235    Osob=1 KlientID=11624
RezID=48647 PokojID=7  DataOd=2026-03-06 DataDo=2026-03-06 Cena=335    Osob=3 KlientID=30170
RezID=49227 PokojID=8  DataOd=2026-02-23 DataDo=2026-02-25 Cena=816    Osob=1 KlientID=30382
RezID=49270 PokojID=8  DataOd=2026-02-26 DataDo=2026-02-26 Cena=272    Osob=1 KlientID=30404
RezID=49264 PokojID=8  DataOd=2026-02-27 DataDo=2026-02-27 Cena=235    Osob=2 KlientID=11624
RezID=48964 PokojID=8  DataOd=2026-03-09 DataDo=2026-03-09 Cena=235    Osob=1 KlientID=67
RezID=49255 PokojID=9  DataOd=2026-02-25 DataDo=2026-02-25 Cena=255    Osob=1 KlientID=30393
RezID=49262 PokojID=9  DataOd=2026-02-25 DataDo=2026-02-25 Cena=0      Osob=4 KlientID=8963
RezID=49273 PokojID=9  DataOd=2026-02-26 DataDo=2026-02-26 Cena=392    Osob=1 KlientID=1131
RezID=49265 PokojID=9  DataOd=2026-02-27 DataDo=2026-02-27 Cena=235    Osob=4 KlientID=11624
RezID=49237 PokojID=10 DataOd=2026-02-24 DataDo=2026-02-24 Cena=406    Osob=2 KlientID=5128
RezID=49257 PokojID=10 DataOd=2026-02-25 DataDo=2026-02-25 Cena=305    Osob=2 KlientID=30396
RezID=49279 PokojID=10 DataOd=2026-02-26 DataDo=2026-02-26 Cena=235    Osob=1 KlientID=5680
RezID=49244 PokojID=10 DataOd=2026-03-06 DataDo=2026-03-06 Cena=0      Osob=5 KlientID=30388
RezID=48433 PokojID=10 DataOd=2026-03-07 DataDo=2026-03-07 Cena=0      Osob=5 KlientID=30072
RezID=49038 PokojID=11 DataOd=2026-02-23 DataDo=2026-02-25 Cena=989.4  Osob=1 KlientID=30012
RezID=49276 PokojID=11 DataOd=2026-02-26 DataDo=2026-02-26 Cena=285    Osob=2 KlientID=19025
RezID=49266 PokojID=11 DataOd=2026-02-27 DataDo=2026-02-28 Cena=600    Osob=2 KlientID=30400
RezID=48474 PokojID=11 DataOd=2026-03-07 DataDo=2026-03-07 Cena=0      Osob=5 KlientID=30103
RezID=48768 PokojID=12 DataOd=2026-02-24 DataDo=2026-02-24 Cena=446    Osob=2 KlientID=27552
RezID=48769 PokojID=12 DataOd=2026-02-24 DataDo=2026-02-24 Cena=0      Osob=4 KlientID=27552
RezID=49249 PokojID=12 DataOd=2026-02-25 DataDo=2026-02-25 Cena=331    Osob=1 KlientID=30390
RezID=49056 PokojID=12 DataOd=2026-02-26 DataDo=2026-02-26 Cena=255    Osob=1 KlientID=30415
RezID=49037 PokojID=12 DataOd=2026-02-28 DataDo=2026-02-28 Cena=305    Osob=2 KlientID=30345
RezID=48475 PokojID=12 DataOd=2026-03-07 DataDo=2026-03-07 Cena=0      Osob=4 KlientID=30103
RezID=49226 PokojID=13 DataOd=2026-02-24 DataDo=2026-02-24 Cena=272    Osob=1 KlientID=30381
RezID=48770 PokojID=13 DataOd=2026-02-24 DataDo=2026-02-24 Cena=0      Osob=4 KlientID=27552
RezID=49252 PokojID=13 DataOd=2026-02-25 DataDo=2026-02-25 Cena=449    Osob=1 KlientID=30036
RezID=49277 PokojID=13 DataOd=2026-02-26 DataDo=2026-02-26 Cena=245    Osob=1 KlientID=15344
RezID=49200 PokojID=13 DataOd=2026-02-28 DataDo=2026-02-28 Cena=285    Osob=2 KlientID=30368
RezID=49250 PokojID=14 DataOd=2026-02-24 DataDo=2026-02-24 Cena=240    Osob=1 KlientID=30391
RezID=49253 PokojID=14 DataOd=2026-02-25 DataDo=2026-02-25 Cena=245    Osob=1 KlientID=30036
RezID=49235 PokojID=14 DataOd=2026-02-28 DataDo=2026-02-28 Cena=285    Osob=2 KlientID=30384
RezID=49208 PokojID=14 DataOd=2026-03-04 DataDo=2026-03-04 Cena=235    Osob=1 KlientID=24101
RezID=49254 PokojID=15 DataOd=2026-02-25 DataDo=2026-02-25 Cena=245    Osob=1 KlientID=30036
RezID=49268 PokojID=15 DataOd=2026-02-25 DataDo=2026-02-25 Cena=354    Osob=1 KlientID=30402
RezID=49278 PokojID=15 DataOd=2026-02-26 DataDo=2026-02-28 Cena=705    Osob=1 KlientID=30372
RezID=49260 PokojID=16 DataOd=2026-02-25 DataDo=2026-02-25 Cena=320    Osob=1 KlientID=2191
RezID=49272 PokojID=16 DataOd=2026-02-26 DataDo=2026-02-26 Cena=235    Osob=2 KlientID=1131
RezID=49261 PokojID=21 DataOd=2026-02-25 DataDo=2026-02-25 Cena=320    Osob=1 KlientID=28320
RezID=49251 PokojID=22 DataOd=2026-02-24 DataDo=2026-02-24 Cena=286    Osob=1 KlientID=30392
RezID=49259 PokojID=22 DataOd=2026-02-25 DataDo=2026-02-25 Cena=387    Osob=2 KlientID=30398
RezID=49271 PokojID=23 DataOd=2026-02-25 DataDo=2026-02-25 Cena=230    Osob=1 KlientID=30406
RezID=49274 PokojID=24 DataOd=2026-02-28 DataDo=2026-02-28 Cena=295    Osob=2 KlientID=30410
RezID=49275 PokojID=25 DataOd=2026-02-28 DataDo=2026-02-28 Cena=245    Osob=1 KlientID=30410
RezID=48434 PokojID=29 DataOd=2026-03-07 DataDo=2026-03-07 Cena=0      Osob=2 KlientID=30073
```

### Klient 4247 (szef):
```sql
-- W tabeli klienci:
(4247,'szef',...)
```

### Mapowanie pokoi (KWHotel PokojID → numer):
```
PokojID 1  = 001 BEZ ŁAZIENKI
PokojID 2  = 002 AP130/180
PokojID 7  = 007 130/180
PokojID 21 = SI 021
PokojID 22 = SI 022
...
```

---

## SUROWE DANE Z HotelSystem (tabela Reservation) - ten sam okres

```
id                             room    checkIn     checkOut    status       guest                              adults
cmm56j5gc1jg0crxcft1fl31v      001     2026-02-23  2026-02-26  CHECKED_OUT  TERKAN SP...                       1
cmm56nxbs0007aexckge04wcf      001     2026-02-27  2026-02-28  CONFIRMED    ŁUKASZ WOJENKOWSKI                 1
cmm56j5fu1jfvcrxcy6bfcmn9      002     2026-02-23  2026-02-26  CHECKED_OUT  TERKAN SP...                       2      ← OK
cmm56j5h61jg9crxcq8cok8ft      002     2026-03-02  2026-03-05  CONFIRMED    AMBROZIAK ROBERT                   1      ← OK
                               002     ← BRAK REZERWACJI "szef" 2025-11-19 → 2026-05-09 !!!
cmm56j5fx1jfwcrxcd9eaku8l      003     2026-02-23  2026-02-26  CHECKED_OUT  TERKAN SP...                       2
cmm56j5ha1jgacrxcubut3z5p      003     2026-03-02  2026-03-05  CONFIRMED    AMBROZIAK ROBERT                   1
cmm56j5g21jfxcrxcqz3z5eje      004     2026-02-23  2026-02-26  CHECKED_OUT  TERKAN SP...                       2
cmm56j5hk1jgbcrxczv4ri9af      004     2026-03-02  2026-03-05  CONFIRMED    AMBROZIAK ROBERT                   1
cmm56j5dg1jfccrxcb651kufr      005     2026-02-23  2026-02-24  CHECKED_OUT  Karol Iżbicki                      2
cmm56j5iq1jgkcrxcu2lt997g      005     2026-02-24  2026-02-25  CHECKED_OUT  Grala                              1
cmm56j5gv1jg6crxcw4dhs3xs      005     2026-02-25  2026-02-26  CHECKED_OUT  PETROFER-POLSKA                    1
cmm56j5hp1jgccrxc9otj6n92      005     2026-03-02  2026-03-05  CONFIRMED    AMBROZIAK ROBERT                   1
cmm56j5g51jfycrxcevnk9t5i      006     2026-02-23  2026-02-24  CHECKED_OUT  TATRAPET POLSKA                    1
cmm56j5gz1jg7crxcff5sxf1o      006     2026-02-25  2026-02-26  CHECKED_OUT  PETROFER-POLSKA                    1
cmm56j5iz1jgmcrxcvyzzok1j      007     2026-02-25  2026-02-26  CHECKED_OUT  ZBIGNIEW SZCZEPANIAK               1
cmm56j5kc1jgxcrxcij4uksxt      007     2026-02-26  2026-02-27  CHECKED_OUT  Mariusz Miśkiewicz                 1
cmm56j5jl1jgrcrxc5ltdr5o6      007     2026-02-27  2026-02-28  CHECKED_OUT  JAN KOWALSKI                       1
cmm56j2wq1izncrxcxeh96jls      007     2026-03-06  2026-03-07  CONFIRMED    Kłosińska Magdalena                3
                               007     ← BRAK REZERWACJI "szef" 2025-12-31 → 2026-05-09 !!!
```

---

## KLUCZOWE ROZBIEŻNOŚCI

| Pokój | KWHotel | HotelSystem | Problem |
|-------|---------|-------------|---------|
| **002** | "szef" 2025-11-19 → 2026-05-09 | **BRAK** | Długoterminowa rezerwacja nie zaimportowana |
| **007** | "szef" 2025-12-31 → 2026-05-09 | **BRAK** | Długoterminowa rezerwacja nie zaimportowana |

---

## Relevantne typy/modele (Prisma)

```prisma
model Reservation {
  id                  String           @id @default(cuid())
  confirmationNumber  String?          @unique
  guestId             String
  guest               Guest            @relation(...)
  roomId              String
  room                Room             @relation(...)
  checkIn             DateTime         @db.Date
  checkOut            DateTime         @db.Date
  status              ReservationStatus
  adults              Int?
  children            Int?
  notes               String?          @db.Text
  // ... inne pola
}

enum ReservationStatus {
  PENDING
  CONFIRMED
  CHECKED_IN
  CHECKED_OUT
  CANCELLED
  NO_SHOW
}
```

### Struktura KWHotel (MySQL):
```sql
CREATE TABLE `rezerwacje` (
  `RezerwacjaID` int(11) NOT NULL AUTO_INCREMENT,
  `PokojID` int(11) DEFAULT NULL,
  `DataOd` datetime NOT NULL,        -- data zameldowania
  `DataDo` datetime NOT NULL,        -- data wymeldowania
  `Cena` decimal(15,4) DEFAULT NULL,
  `Wplata` decimal(15,4) DEFAULT NULL,
  `Uwagi` varchar(1024) DEFAULT NULL,
  `Osob` tinyint(3) unsigned NOT NULL DEFAULT '1',
  `KlientID` int(11) DEFAULT NULL,
  `status_id` tinyint(3) unsigned NOT NULL DEFAULT '0',
  -- ... więcej pól
);
```

---

## Logi/error

Brak błędów - rezerwacje po prostu nie są importowane. Prawdopodobnie skrypt migracji filtruje po dacie lub jest inny warunek wykluczający.

---

## Proponowane naprawy

### 1. Migracja - dodać import długoterminowych rezerwacji
W `migrate-kwhotel.ts` zmienić warunek pobierania rezerwacji:
```typescript
// BYŁO (prawdopodobnie):
WHERE DataOd >= '2026-01-01'

// POWINNO BYĆ:
WHERE DataDo >= CURDATE()  // wszystkie trwające lub przyszłe
```

### 2. TapeChart - renderowanie rezerwacji zaczynających się przed widocznym zakresem
W `components/tape-chart/index.tsx`, funkcja `reservationPlacements`:

```typescript
// BYŁO:
let startIdx = dateIndex.get(res.checkIn);
if (startIdx == null) return null;  // ← BŁĄD: odrzuca rezerwacje z checkIn < dates[0]

// POWINNO BYĆ:
let startIdx = dateIndex.get(res.checkIn);
if (startIdx == null) {
  if (res.checkIn < dates[0]) {
    startIdx = 0;  // clamp do pierwszego dnia widocznego
  } else {
    return null;
  }
}
```

---

## Źródło danych
- **Plik SQL:** `c:\Users\hp\Downloads\kw_aktualny (1).sql`
- **Baza HotelSystem:** MariaDB na Hetzner (`hotel.karczma-labedz.pl`)
- **Data exportu:** 2026-02-27
