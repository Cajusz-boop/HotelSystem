# MODUŁ: Booking Engine — Rozbudowa

> **STAN OBECNY:** Strona `/booking` z wyborem dat, typu pokoju, danymi gościa, zapis rezerwacji.
> Payment link jako osobny krok. Brak grup wiekowych, rezerwacji "na zapytanie", wielojęzyczności.
> **CEL:** Doprowadzić Booking Engine do pełnego silnika rezerwacji online.
> **ZASADA:** Przeczytaj CAŁY. Zrób WSZYSTKO. Sprawdź checklistę.

---

## ISTNIEJĄCE ZASOBY

```
Pliki:
  app/booking/page.tsx                — strona publiczna
  app/booking/booking-form.tsx        — formularz rezerwacji
  app/actions/booking-engine.ts       — getBookingAvailability, getRoomTypesForBooking, submitBookingFromEngine
  app/actions/finance.ts              — createPaymentLink
  app/pay/[token]/page.tsx            — płatność po linku

Modele (istniejące):
  Reservation, Guest, Room, RoomType, PaymentLink
```

---

## DOCELOWY FLOW REZERWACJI ONLINE

```
KROK 1: Wybór dat i gości
┌─────────────────────────────────────────────────────────────────┐
│  🏨 Karczma Łabędź — Rezerwacja Online                         │
│                                                                  │
│  Check-in:  [📅 15.03.2026]    Check-out: [📅 18.03.2026]      │
│                                                                  │
│  Dorośli:    [▼ 2]                                              │
│  Dzieci 0-6: [▼ 1]    Dzieci 7-12: [▼ 0]    Dzieci 13-17: [▼ 0]│
│                                                                  │
│  Kod promocyjny: [________________] (opcjonalnie)               │
│                                                                  │
│  [Szukaj dostępnych pokoi →]                                    │
└─────────────────────────────────────────────────────────────────┘

KROK 2: Wybór pokoju
┌─────────────────────────────────────────────────────────────────┐
│  15.03 — 18.03.2026 (3 noce) | 2 dorosłych, 1 dziecko 0-6    │
│                                                                  │
│  ┌─ Comfort ────────────────────────────────────────────────┐   │
│  │  [📷 galeria]                                             │   │
│  │  Pokój z balkonem, TV, WiFi, łazienka                     │   │
│  │  Maks: 4 osoby | 25m² | Piętro 1-2                       │   │
│  │                                                            │   │
│  │  Cena za pokój:           350 PLN/noc                     │   │
│  │  Dorosły ×2:              300 PLN/noc                     │   │
│  │  Dziecko 0-6 ×1:           0 PLN/noc (gratis)            │   │
│  │  ──────────────────────────────────────                    │   │
│  │  Suma/noc:                650 PLN                          │   │
│  │  × 3 noce =             1 950 PLN                          │   │
│  │                                                            │   │
│  │  Plan: (●) Bez wyżywienia (○) Śniadanie +45/os (○) HB +90│  │
│  │                                                            │   │
│  │  Warunki: zwrotna do 48h przed | min. 1 noc               │   │
│  │                                                            │   │
│  │  [Rezerwuj →]  [Zapytaj o dostępność]                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Suite ──────────────────────────────────────────────────┐   │
│  │  (analogicznie)                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

KROK 3: Dane gościa
┌─────────────────────────────────────────────────────────────────┐
│  Comfort | 15-18.03.2026 | 3 noce | 1 950 PLN                  │
│                                                                  │
│  Imię i nazwisko*: [Jan Kowalski                    ]           │
│  Email*:           [jan@example.com                 ]           │
│  Telefon*:         [+48 600 123 456                 ]           │
│  Kraj:             [▼ Polska                        ]           │
│                                                                  │
│  Uwagi do rezerwacji:                                            │
│  [Proszę o pokój z widokiem na jezioro                      ]   │
│                                                                  │
│  ☑ Akceptuję regulamin hotelu                                   │
│  ☑ Zgadzam się na przetwarzanie danych (RODO)                   │
│  ☐ Chcę otrzymywać oferty marketingowe                          │
│                                                                  │
│  [← Wróć]  [Rezerwuj i zapłać →]  lub  [Rezerwuj bez płatności]│
└─────────────────────────────────────────────────────────────────┘

KROK 4: Płatność (jeśli wybrano "Rezerwuj i zapłać")
┌─────────────────────────────────────────────────────────────────┐
│  Podsumowanie:                                                   │
│  Comfort | 15-18.03 | 3 noce | 2 dor. + 1 dz.                  │
│  Śniadanie: 3 × 45 PLN = 135 PLN                               │
│  Suma: 2 085 PLN                                                 │
│                                                                  │
│  ┌─ Płatność ──────────────────────────────────────────────┐    │
│  │  (●) Zapłać teraz pełną kwotę: 2 085 PLN               │    │
│  │  (○) Wpłać zaliczkę: 30% = 625,50 PLN                   │    │
│  │                                                          │    │
│  │  Metoda: [▼ Przelew online (PayU/TPay)]                 │    │
│  │                                                          │    │
│  │  [Przejdź do płatności →]                                │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  lub: Dane do przelewu tradycyjnego:                             │
│  Karczma Łabędź | PL 12 3456 7890 1234 5678 | tytuł: REZ-1042  │
└─────────────────────────────────────────────────────────────────┘

KROK 5: Potwierdzenie
┌─────────────────────────────────────────────────────────────────┐
│  ✅ Rezerwacja potwierdzona!                                     │
│                                                                  │
│  Nr rezerwacji: 1042                                             │
│  Pokój: Comfort | 15-18.03.2026 | 3 noce                       │
│  Kwota: 2 085 PLN (opłacona / oczekuje na wpłatę)              │
│                                                                  │
│  Potwierdzenie wysłane na: jan@example.com                      │
│                                                                  │
│  [📄 Pobierz potwierdzenie PDF]                                 │
│  [🔗 Link do odprawy online]                                    │
│  [🏠 Wróć na stronę hotelu]                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## ZMIANY W SERVER ACTIONS

### Rozbudowa `app/actions/booking-engine.ts`

#### 1. `getRoomTypesForBooking` — ROZBUDUJ

Obecna funkcja prawdopodobnie zwraca typy pokoi z ceną bazową. Rozbuduj:

```typescript
export async function getRoomTypesForBooking(params: {
  propertyId: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  childAges?: number[];     // NOWE — wiek każdego dziecka (do przypisania grup)
  promoCode?: string;       // NOWE — kod promocyjny
}): Promise<BookingRoomType[]> {
  // 1. Pobierz dostępne typy pokoi
  // 2. Dla każdego typu: oblicz cenę z getEffectivePriceForRoomOnDate
  //    (uwzględnij grupy wiekowe z cennika!)
  // 3. Przelicz dzieci na grupy wiekowe wg AgeGroupConfig
  // 4. Oblicz cenę posiłków jeśli plan wchodzi w cenę (includedMealPlan)
  // 5. Sprawdź restrykcje (CTA/CTD, min/max stay)
  // 6. Zastosuj kod promocyjny jeśli podany
  // 7. Zwróć z pełną kalkulacją ceny

  return roomTypes.map(rt => ({
    id: rt.id,
    name: rt.name,
    description: rt.description,
    photoUrl: rt.photoUrl,
    translations: rt.translations,
    maxOccupancy: rt.maxOccupancy,
    bedsDescription: rt.bedsDescription,
    features: '...', // z pokoi tego typu
    available: availableCount,
    priceBreakdown: {
      basePrice: 350,           // cena za pokój/dobę
      adultPrice: 150,          // za dorosłego
      adultCount: 2,
      childPrices: [            // per dziecko z ceną wg grupy wiekowej
        { age: 3, group: 'CHILD1', label: 'Dziecko 0-6', price: 0 },
      ],
      nightlyTotal: 650,
      nights: 3,
      subtotal: 1950,
      mealOptions: [            // dostępne plany wyżywienia
        { plan: 'RO', label: 'Bez wyżywienia', pricePerPerson: 0, total: 0 },
        { plan: 'BB', label: 'Śniadanie', pricePerPerson: 45, total: 270 },
        { plan: 'HB', label: 'Śniadanie + obiad', pricePerPerson: 90, total: 540 },
      ],
      promoDiscount: 0,
      grandTotal: 1950,
    },
    restrictions: {
      minStay: 1,
      maxStay: null,
      isNonRefundable: false,
      closedToArrival: false,
      closedToDeparture: false,
    },
  }));
}
```

#### 2. `submitBookingFromEngine` — ROZBUDUJ

```typescript
export async function submitBookingFromEngine(params: {
  propertyId: number;
  roomTypeId: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  childAges?: number[];
  mealPlan: string;           // NOWE — wybrany plan wyżywienia
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestCountry?: string;
  notes?: string;
  marketingConsent: boolean;  // NOWE — zgoda marketingowa
  promoCode?: string;
  bookingType: 'INSTANT' | 'REQUEST';  // NOWE — rezerwacja natychmiastowa vs zapytanie
  paymentIntent: 'FULL' | 'ADVANCE' | 'NONE';  // NOWE — co zamierza zapłacić
}): Promise<{
  reservationId: number;
  confirmationNumber: string;
  totalAmount: number;
  paymentLink?: string;       // link do płatności (jeśli paymentIntent != NONE)
  checkInLink?: string;       // link do odprawy online
}> {
  // 1. Znajdź wolny pokój wybranego typu (auto-assign)
  //    Użyj sellPriority do wyboru najlepszego pokoju
  // 2. Utwórz gościa (lub znajdź po email)
  //    Zapisz marketingConsent
  // 3. Utwórz rezerwację
  //    status: bookingType === 'REQUEST' ? 'PENDING' : 'CONFIRMED'
  //    mealPlan: params.mealPlan
  //    source: 'WEBSITE'
  //    channel: 'DIRECT'
  // 4. Utwórz transakcje (ROOM, MEAL jeśli plan != RO)
  // 5. Jeśli paymentIntent != 'NONE' → createPaymentLink
  //    kwota: FULL → total, ADVANCE → 30% (lub konfigurowalna)
  // 6. Wyślij email potwierdzenia (sendReservationConfirmationWithTemplate)
  // 7. Zwróć dane
}
```

#### 3. NOWA: `submitBookingRequest` — rezerwacja na zapytanie

```typescript
export async function submitBookingRequest(params: {
  propertyId: number;
  roomTypeId: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  message: string;            // wiadomość od gościa
}): Promise<{
  requestId: number;
  message: string;            // "Dziękujemy, odpowiemy w ciągu 24h"
}> {
  // 1. Utwórz rezerwację ze statusem 'PENDING' (lub 'REQUEST')
  // 2. Wyślij email do hotelu (notification)
  // 3. Wyślij email do gościa (potwierdzenie zapytania)
  // 4. Zwróć potwierdzenie
}
```

---

## ROZBUDOWA UI — `app/booking/`

### Nowe pliki:
```
app/booking/
├── page.tsx                    — SSR wrapper (istniejący, rozbuduj)
├── booking-form.tsx            — formularz krok 1 (istniejący, rozbuduj)
├── room-selection.tsx          — NOWY: krok 2 (wybór pokoju z cenami)
├── guest-form.tsx              — NOWY: krok 3 (dane gościa + RODO)
├── payment-step.tsx            — NOWY: krok 4 (wybór płatności)
├── confirmation.tsx            — NOWY: krok 5 (potwierdzenie)
├── booking-stepper.tsx         — NOWY: nawigacja kroków (1→2→3→4→5)
└── room-card.tsx               — NOWY: karta typu pokoju z cenami i galerią
```

### Krok 1 — rozbudowa istniejącego formularza:

Dodaj:
- Pola na dzieci per grupa wiekowa (zamiast jednego pola "Dzieci"):
  ```
  Dzieci 0-6 lat:  [▼ 0]
  Dzieci 7-12 lat: [▼ 0]
  Dzieci 13-17 lat:[▼ 0]
  ```
  Etykiety i zakresy pobierz z `AgeGroupConfig` (jeśli istnieje z modułu cennika). Fallback: hardcoded.
- Pole kodu promocyjnego (opcjonalne)

### Krok 2 — room-card.tsx:

Karta typu pokoju:
- Galeria zdjęć (jeśli `RoomType.photoUrl` istnieje — na razie placeholder)
- Opis, wyposażenie, maks. osób, metraż
- **Rozbicie ceny** (per grupa wiekowa) — czytelna tabela
- **Plany wyżywienia** — radio buttons z cenami
- **Restrykcje** — min stay, bezzwrotna, CTA/CTD → info text
- Dwa przyciski: [Rezerwuj →] i [Zapytaj o dostępność]

### Krok 3 — guest-form.tsx:

- Pola: imię i nazwisko*, email*, telefon*, kraj (dropdown)
- Textarea: uwagi
- Checkboxy RODO: regulamin* + dane osobowe* + marketing (opcja)
- Walidacja: required pola muszą być wypełnione

### Krok 4 — payment-step.tsx:

- Radio: zapłać pełną kwotę / wpłać zaliczkę (30%) / rezerwuj bez płatności
- Jeśli "zapłać" → podsumowanie + przycisk → redirect do bramki (paymentLink)
- Jeśli "bez płatności" → info o danych do przelewu (z HotelConfig)

### Krok 5 — confirmation.tsx:

- Podsumowanie rezerwacji
- Nr rezerwacji
- Status płatności
- Link do PDF potwierdzenia (`/api/reservations/[id]/confirmation/pdf` — JUŻ ISTNIEJE)
- Link do odprawy online (`/check-in/guest/[token]` — JUŻ ISTNIEJE)

### Stepper (booking-stepper.tsx):

```
  ① Daty i goście  →  ② Wybór pokoju  →  ③ Dane  →  ④ Płatność  →  ⑤ Gotowe
       ●                   ○                 ○          ○              ○
```

Użyj prostego flexbox z kółkami i liniami. Aktywny krok = niebieski, zrobione = zielone, przyszłe = szare.

---

## WIELOJĘZYCZNOŚĆ (opcjonalnie — jeśli czas pozwala)

Booking Engine to strona publiczna, więc powinna obsługiwać EN/DE oprócz PL.

Sprawdź: `components/i18n-provider.tsx` i `components/language-switcher.tsx` — JUŻ ISTNIEJĄ.

Jeśli i18n jest skonfigurowane:
- Dodaj tłumaczenia stringów w Booking Engine
- Użyj `RoomType.translations` do nazw typów pokoi

Jeśli i18n nie działa jeszcze: zostaw jako TODO, ale przygotuj strukturę (wydziel stringi do obiektu).

---

## STYL WIZUALNY

Booking Engine to strona **publiczna** — musi wyglądać profesjonalnie:
- Pełna szerokość (bez sidebara)
- Logo hotelu na górze
- Ciemne tło nagłówka + białe karty na jasnoszarym tle
- Fonty: spójne z resztą, ale większe (text-base/text-lg)
- Mobile-first: cały flow musi działać na telefonie
- Przycisk "Rezerwuj" duży, widoczny (bg-blue-600, py-3, text-lg)

---

## CHECKLIST

- [x] Krok 1: pola dzieci per grupa wiekowa (0-6, 7-12, 13-17)
- [x] Krok 1: pole kodu promocyjnego
- [x] Krok 2: karty typów pokoi z rozbiciem cen per grupa
- [x] Krok 2: plany wyżywienia (radio) z ceną
- [x] Krok 2: info o restrykcjach (min stay, bezzwrotna)
- [x] Krok 2: przycisk "Zapytaj o dostępność" (booking request)
- [x] Krok 3: formularz gościa z walidacją
- [x] Krok 3: checkboxy RODO (regulamin, dane, marketing)
- [x] Krok 4: wybór pełna kwota / zaliczka / bez płatności
- [x] Krok 4: redirect do bramki (createPaymentLink na kroku 4 po wyborze kwoty)
- [x] Krok 4: dane do przelewu tradycyjnego (placeholder; HotelConfig bez nr konta)
- [x] Krok 5: podsumowanie + nr rezerwacji
- [x] Krok 5: link do PDF potwierdzenia
- [x] Krok 5: link do odprawy online
- [x] Stepper wizualny (5 kroków)
- [x] submitBookingFromEngine: obsługuje grupy wiekowe
- [x] submitBookingFromEngine: obsługuje mealPlan
- [x] submitBookingFromEngine: obsługuje bookingType REQUEST
- [x] submitBookingRequest: tworzy rezerwację PENDING + wysyła maile
- [x] Email potwierdzenia wysyłany automatycznie
- [x] Responsywność: mobile OK (cały flow na telefonie)
- [x] Istniejący booking: flow nadal działa (submitBookingFromEngineSimple)

### Braki / TODO (opcjonalne)

- [ ] **Transakcje ROOM/MEAL:** Doc: "Utwórz transakcje (ROOM, MEAL jeśli plan != RO)" — createReservation nie tworzy transakcji; rozliczenie można dodać przy check-in/checkout lub w module finansów.
- [ ] **Email do hotelu przy zapytaniu:** submitBookingRequest wysyła tylko do gościa; brak powiadomienia e-mail do recepcji (wymaga konfiguracji adresu).
- [ ] **Dane do przelewu z konfiguracji:** HotelConfig nie ma pola nr konta/IBAN; "dane do przelewu" to placeholder — dodać pole lub osobny endpoint publiczny.
- [ ] **Wielojęzyczność (PL/EN/DE):** Zostawione jako TODO; stringi można wydzielić do obiektu i podłączyć i18n.
- [ ] **Kod promocyjny:** Parametr promoCode przekazywany do getRoomTypesForBookingWithPrices; logika rabatu (promoDiscount) nie zaimplementowana — zwracane 0.