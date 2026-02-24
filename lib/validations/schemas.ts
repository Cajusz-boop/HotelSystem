import { z } from "zod";

/** YYYY-MM-DD */
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format daty: YYYY-MM-DD");

const roomStatus = z.enum(["CLEAN", "DIRTY", "OOO", "INSPECTION", "INSPECTED", "CHECKOUT_PENDING", "MAINTENANCE"]);
const reservationStatus = z.enum([
  "REQUEST",      // oczekuje na potwierdzenie (wstępna rezerwacja)
  "CONFIRMED",    // potwierdzona
  "GUARANTEED",   // gwarantowana kartą kredytową
  "WAITLIST",     // lista oczekujących
  "CHECKED_IN",   // zameldowany
  "CHECKED_OUT",  // wymeldowany
  "CANCELLED",    // anulowana
  "NO_SHOW",      // niestawienie się
]);

// --- Gość ---
export const guestSchema = z.object({
  name: z.string().min(1, "Imię i nazwisko wymagane").max(200),
  email: z.string().email("Nieprawidłowy email").optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data urodzenia w formacie YYYY-MM-DD").optional().nullable(),
  placeOfBirth: z.string().max(100).optional().nullable(), // miejsce urodzenia
  nationality: z.string().max(50).optional().nullable(), // obywatelstwo/narodowość (kod ISO np. "PL", "DE", "GB")
  gender: z.enum(["M", "F"]).optional().nullable(), // płeć: M (mężczyzna), F (kobieta) - do statystyk GUS
  // Adres zamieszkania
  street: z.string().max(200).optional().nullable(), // ulica i numer
  city: z.string().max(100).optional().nullable(), // miasto
  postalCode: z.string().max(20).optional().nullable(), // kod pocztowy
  country: z.string().max(10).optional().nullable(), // kraj (kod ISO)
  // Dokument tożsamości
  documentType: z.enum(["ID_CARD", "PASSPORT", "DRIVING_LICENSE", "OTHER"]).optional().nullable(), // typ dokumentu
  documentNumber: z.string().max(50).optional().nullable(), // numer dokumentu
  documentExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data ważności w formacie YYYY-MM-DD").optional().nullable(), // data ważności dokumentu
  documentIssuedBy: z.string().max(200).optional().nullable(), // organ wydający dokument
  mrz: z.string().max(90).optional(), // kod MRZ z dowodu (skaner 2D)
  // VIP status
  isVip: z.boolean().optional(), // czy gość VIP
  vipLevel: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]).optional().nullable(), // poziom VIP
});

export type GuestInput = z.infer<typeof guestSchema>;

/** Walidacja e-mail (pusty dozwolony, niepusty musi być poprawnym adresem). */
const optionalEmailSchema = z.string().email("Nieprawidłowy email").optional().or(z.literal(""));
export function validateOptionalEmail(
  email: string | null | undefined
): { ok: true } | { ok: false; error: string } {
  const v = (email ?? "").trim();
  const r = optionalEmailSchema.safeParse(v);
  if (r.success) return { ok: true };
  const msg = r.error.errors[0]?.message;
  return { ok: false, error: msg ?? "Nieprawidłowy email" };
}

import { isValidNipChecksum } from "@/lib/nip-checksum";

// --- Firma (NIP, nazwa, adres – do meldunku / faktury) ---
export const companyDataSchema = z
  .object({
    nip: z.string().min(1, "NIP wymagany"),
    name: z.string().min(1, "Nazwa firmy wymagana").max(200),
    address: z.string().max(200).optional().nullable(),
    postalCode: z.string().max(20).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    country: z.string().max(10).optional(),
  })
  .refine((d) => d.nip.replace(/\D/g, "").length === 10, {
    message: "NIP musi mieć 10 cyfr",
    path: ["nip"],
  })
  .refine((d) => isValidNipChecksum(d.nip.replace(/\D/g, "")), {
    message: "NIP ma błędną sumę kontrolną",
    path: ["nip"],
  });
export type CompanyDataInput = z.infer<typeof companyDataSchema>;

// Źródła rezerwacji
export const reservationSource = z.enum([
  "OTA",          // Online Travel Agency (Booking.com, Expedia, etc.)
  "PHONE",        // Telefon
  "EMAIL",        // Email
  "WALK_IN",      // Osobiście w recepcji
  "WEBSITE",      // Strona WWW hotelu
  "BOOKING_ENGINE", // Własny silnik rezerwacji
  "CHANNEL_MANAGER", // Channel Manager
  "OTHER",        // Inne
]);
export type ReservationSource = z.infer<typeof reservationSource>;

// Kanały sprzedaży
export const reservationChannel = z.enum([
  "DIRECT",       // Bezpośrednio w hotelu
  "BOOKING_COM",  // Booking.com
  "EXPEDIA",      // Expedia
  "AIRBNB",       // Airbnb
  "AGODA",        // Agoda
  "TRIVAGO",      // Trivago
  "HOTELS_COM",   // Hotels.com
  "HOSTELWORLD",  // Hostelworld
  "TRIP_COM",     // Trip.com
  "GOOGLE_HOTELS", // Google Hotels
  "KAYAK",        // Kayak
  "HRS",          // HRS
  "CORPORATE",    // Corporate (B2B)
  "TRAVEL_AGENT", // Biuro podróży
  "GDS",          // Global Distribution System (Amadeus, Sabre, Galileo)
  "OTHER",        // Inne
]);
export type ReservationChannel = z.infer<typeof reservationChannel>;

// Segmenty rynkowe
export const marketSegment = z.enum([
  "BUSINESS",     // Biznes – podróże służbowe
  "LEISURE",      // Turystyka – wypoczynek
  "GROUP",        // Grupy
  "CORPORATE",    // Klienci korporacyjni (kontrakty)
  "GOVERNMENT",   // Sektor publiczny / rządowy
  "CREW",         // Załogi (airline crew, bus drivers)
  "WHOLESALE",    // Hurtowy (tour operators)
  "PACKAGE",      // Pakiety (np. z wycieczką)
  "LONG_STAY",    // Długoterminowy pobyt
  "RELOCATION",   // Przeprowadzki / tymczasowe zakwaterowanie
  "MICE",         // Meetings, Incentives, Conferences, Events
  "OTHER",        // Inne
]);
export type MarketSegment = z.infer<typeof marketSegment>;

// Rodzaj pobytu (Trip Purpose)
export const tripPurpose = z.enum([
  "BUSINESS",     // Biznesowy / służbowy
  "LEISURE",      // Turystyczny / wypoczynkowy
  "CONFERENCE",   // Konferencja / szkolenie
  "TRANSIT",      // Tranzyt / przejazd
  "MEDICAL",      // Medyczny
  "RELOCATION",   // Przeprowadzka / tymczasowe zakwaterowanie
  "WEDDING",      // Wesele / uroczystość
  "SPORTS",       // Sportowy (zawody, obozy)
  "EDUCATIONAL",  // Edukacyjny (wycieczka szkolna, kurs)
  "OTHER",        // Inne
]);
export type TripPurpose = z.infer<typeof tripPurpose>;

// Plan wyżywienia (Meal Plan)
export const mealPlan = z.enum([
  "RO",           // Room Only – tylko nocleg
  "BB",           // Bed & Breakfast – śniadanie
  "HB",           // Half Board – śniadanie + obiadokolacja
  "FB",           // Full Board – 3 posiłki
  "AI",           // All Inclusive – wszystko w cenie
  "BB_PLUS",      // BB+ – śniadanie rozszerzone
  "HB_PLUS",      // HB+ – półpensja plus
  "UAI",          // Ultra All Inclusive
]);
export type MealPlan = z.infer<typeof mealPlan>;

// Preferencje pokoju
export const roomPreferencesSchema = z.object({
  view: z.string().max(50).optional(),           // np. "morze", "góry", "ogród", "miasto"
  floor: z.string().max(20).optional(),          // np. "1", "2-3", "wysoki"
  quiet: z.boolean().optional(),                 // cichy pokój
  highFloor: z.boolean().optional(),             // wysoki numer / piętro
  lowFloor: z.boolean().optional(),              // niski numer / piętro
  nearElevator: z.boolean().optional(),          // blisko windy
  farFromElevator: z.boolean().optional(),       // daleko od windy
  accessible: z.boolean().optional(),            // dostosowany dla niepełnosprawnych
  bedType: z.string().max(30).optional(),        // np. "double", "twin", "king"
  smoking: z.boolean().optional(),               // palący (jeśli dostępny)
  nonSmoking: z.boolean().optional(),            // niepalący
  balcony: z.boolean().optional(),               // z balkonem
  bathtub: z.boolean().optional(),               // z wanną
  shower: z.boolean().optional(),                // z prysznicem
  connectingRoom: z.boolean().optional(),        // pokój połączony
  cornerRoom: z.boolean().optional(),            // narożny
  awayFromStreet: z.boolean().optional(),        // z dala od ulicy
  extraNotes: z.string().max(500).optional(),    // dodatkowe preferencje tekstowo
}).optional().nullable();
export type RoomPreferences = z.infer<typeof roomPreferencesSchema>;

// Informacje o zwierzętach (Pet Info)
export const petInfoSchema = z.object({
  hasPet: z.boolean().optional(),               // czy jest zwierzę
  petType: z.string().max(50).optional(),       // rodzaj: "pies", "kot", "inny"
  petCount: z.number().int().min(1).max(5).optional(), // liczba zwierząt
  petBreed: z.string().max(50).optional(),      // rasa (opcjonalnie)
  petWeight: z.number().min(0).max(100).optional(), // waga w kg (dla dużych psów)
  petFee: z.number().min(0).optional(),         // opłata za zwierzę
  feePaid: z.boolean().optional(),              // czy opłata została uiszczona
  notes: z.string().max(500).optional(),        // dodatkowe uwagi (alergie, potrzeby)
}).optional().nullable();
export type PetInfo = z.infer<typeof petInfoSchema>;

// Status płatności rezerwacji
export const paymentStatus = z.enum([
  "UNPAID",    // nieopłacona
  "PARTIAL",   // częściowo opłacona (zaliczka)
  "PAID",      // w pełni opłacona
]);
export type PaymentStatus = z.infer<typeof paymentStatus>;

// Kaucja / Depozyt za pokój (Security Deposit)
export const securityDepositSchema = z.object({
  amount: z.number().min(0).optional(),           // kwota depozytu
  currency: z.string().max(3).optional(),         // waluta (PLN, EUR, USD)
  collected: z.boolean().optional(),              // czy pobrano depozyt
  collectedAt: dateString.optional().nullable(),  // data pobrania
  collectedMethod: z.string().max(50).optional(), // metoda: CASH, CARD, PREAUTH
  returned: z.boolean().optional(),               // czy zwrócono depozyt
  returnedAt: dateString.optional().nullable(),   // data zwrotu
  returnedMethod: z.string().max(50).optional(),  // metoda zwrotu
  deductions: z.number().min(0).optional(),       // kwota potrąceń
  deductionReason: z.string().max(500).optional(), // powód potrącenia (uszkodzenia, minibar, itp.)
  notes: z.string().max(500).optional(),          // dodatkowe uwagi
}).optional().nullable();
export type SecurityDeposit = z.infer<typeof securityDepositSchema>;

// Karta gwarancyjna (Credit Card Guarantee)
export const cardGuaranteeSchema = z.object({
  lastFourDigits: z.string().length(4).regex(/^\d{4}$/, "Ostatnie 4 cyfry karty").optional(), // ostatnie 4 cyfry
  expiryMonth: z.number().int().min(1).max(12).optional(), // miesiąc ważności (1-12)
  expiryYear: z.number().int().min(2020).max(2050).optional(), // rok ważności (4 cyfry)
  cardType: z.enum(["VISA", "MASTERCARD", "AMEX", "DISCOVER", "DINERS", "JCB", "OTHER"]).optional(), // typ karty
  cardholderName: z.string().max(100).optional(), // imię i nazwisko na karcie
  status: z.enum([
    "PENDING",      // oczekuje na weryfikację
    "VALID",        // zweryfikowana, ważna
    "EXPIRED",      // wygasła
    "PREAUTHORIZED", // preautoryzacja aktywna
    "CHARGED",      // obciążona (no-show, anulacja)
    "RELEASED",     // zwolniona preautoryzacja
  ]).optional(),
  preauthorizationId: z.string().max(100).optional(), // ID preautoryzacji z terminala
  preauthorizationAmount: z.number().min(0).optional(), // kwota preautoryzacji
  preauthorizationDate: dateString.optional().nullable(), // data preautoryzacji
  notes: z.string().max(500).optional(), // uwagi (np. problemy z kartą)
}).optional().nullable();
export type CardGuarantee = z.infer<typeof cardGuaranteeSchema>;

// Przedpłata wymagana (Advance Payment)
export const advancePaymentSchema = z.object({
  required: z.boolean().optional(),               // czy przedpłata jest wymagana
  amount: z.number().min(0).optional(),           // wymagana kwota przedpłaty
  currency: z.string().max(3).optional(),         // waluta (PLN, EUR, USD)
  percentage: z.number().min(0).max(100).optional(), // procent wartości rezerwacji (alternatywa do kwoty)
  dueDate: dateString.optional().nullable(),      // termin płatności przedpłaty
  paid: z.boolean().optional(),                   // czy przedpłata została wpłacona
  paidDate: dateString.optional().nullable(),     // data wpłaty
  paidAmount: z.number().min(0).optional(),       // wpłacona kwota
  paymentMethod: z.string().max(50).optional(),   // metoda płatności: CASH, CARD, TRANSFER, BLIK
  paymentReference: z.string().max(100).optional(), // numer referencyjny płatności
  reminderSent: z.boolean().optional(),           // czy wysłano przypomnienie
  reminderSentAt: dateString.optional().nullable(), // data wysłania przypomnienia
  notes: z.string().max(500).optional(),          // uwagi
}).optional().nullable();
export type AdvancePayment = z.infer<typeof advancePaymentSchema>;

// Kod anulacji rezerwacji
export const cancellationCode = z.enum([
  "GUEST_REQUEST",    // na prośbę gościa
  "NO_SHOW",          // niestawienie się gościa
  "OVERBOOKING",      // nadrezerwacja
  "FORCE_MAJEURE",    // siła wyższa
  "PAYMENT_FAILED",   // brak płatności
  "HOTEL_ERROR",      // błąd hotelu
  "DOUBLE_BOOKING",   // podwójna rezerwacja
  "CHANGE_OF_PLANS",  // zmiana planów gościa
  "MEDICAL_EMERGENCY", // nagły przypadek medyczny
  "WEATHER",          // warunki pogodowe
  "OTHER",            // inny powód
]);
export type CancellationCode = z.infer<typeof cancellationCode>;

// Poziom VIP
export const vipLevel = z.enum([
  "NONE",     // brak
  "SILVER",   // srebrny VIP
  "GOLD",     // złoty VIP
  "PLATINUM", // platynowy VIP
  "DIAMOND",  // diamentowy VIP
]);
export type VipLevel = z.infer<typeof vipLevel>;

// Alerty/flagi rezerwacji
export const reservationAlertsSchema = z.object({
  vip: vipLevel.optional(),                       // poziom VIP
  vipNotes: z.string().max(500).optional(),       // uwagi VIP (specjalne traktowanie)
  badPayer: z.boolean().optional(),               // zły płatnik (historia problemów z płatnościami)
  badPayerNotes: z.string().max(500).optional(),  // uwagi o problemach z płatnościami
  specialRequest: z.boolean().optional(),         // specjalne życzenia wymagające uwagi
  specialRequestNotes: z.string().max(500).optional(), // opis specjalnych życzeń
  noShowHistory: z.number().int().min(0).optional(), // liczba no-show w historii
  noShowLastDate: dateString.optional().nullable(), // data ostatniego no-show
  blacklisted: z.boolean().optional(),            // na czarnej liście
  blacklistReason: z.string().max(500).optional(), // powód umieszczenia na czarnej liście
  loyaltyMember: z.boolean().optional(),          // członek programu lojalnościowego
  loyaltyTier: z.string().max(50).optional(),     // poziom lojalności
  loyaltyNumber: z.string().max(50).optional(),   // numer karty lojalnościowej
  returningGuest: z.boolean().optional(),         // powracający gość
  previousStays: z.number().int().min(0).optional(), // liczba poprzednich pobytów
  compGuest: z.boolean().optional(),              // gość "na koszt firmy" (complimentary)
  houseAccount: z.boolean().optional(),           // rozliczenie na konto wewnętrzne
  customAlerts: z.array(z.string().max(100)).max(10).optional(), // własne alerty (tekstowe)
}).optional().nullable();
export type ReservationAlerts = z.infer<typeof reservationAlertsSchema>;

// Typ agenta/biura podróży
export const agentType = z.enum([
  "TRAVEL_AGENT",     // agent turystyczny (osoba)
  "TRAVEL_AGENCY",    // biuro podróży
  "TOUR_OPERATOR",    // touroperator
  "OTA",              // Online Travel Agency (Booking, Expedia, itp.)
  "CORPORATE_AGENT",  // agent korporacyjny
  "MICE_AGENT",       // agent MICE (Meetings, Incentives, Conferences, Events)
  "OTHER",            // inny
]);
export type AgentType = z.infer<typeof agentType>;

// Dane agenta/biura podróży (Travel Agent/Agency)
export const agentDataSchema = z.object({
  name: z.string().max(200).optional(),             // nazwa agenta/biura
  type: agentType.optional(),                        // typ: agent, biuro, touroperator, OTA
  iataCode: z.string().max(20).optional(),           // kod IATA (dla biur podróży)
  companyName: z.string().max(200).optional(),       // nazwa firmy (jeśli agent pracuje dla biura)
  contactPerson: z.string().max(100).optional(),     // osoba kontaktowa
  email: z.string().email().optional(),              // email kontaktowy
  phone: z.string().max(30).optional(),              // telefon
  address: z.string().max(300).optional(),           // adres biura
  nip: z.string().max(15).optional(),                // NIP (do fakturowania prowizji)
  commissionPercent: z.number().min(0).max(100).optional(), // prowizja % od wartości rezerwacji
  commissionFlat: z.number().min(0).optional(),      // prowizja stała (PLN)
  commissionPaid: z.boolean().optional(),            // czy prowizja została wypłacona
  commissionPaidDate: dateString.optional().nullable(), // data wypłaty prowizji
  contractNumber: z.string().max(50).optional(),     // numer umowy z agentem
  contractValidUntil: dateString.optional().nullable(), // ważność umowy
  notes: z.string().max(500).optional(),             // uwagi
}).optional().nullable();
export type AgentData = z.infer<typeof agentDataSchema>;

// --- Rezerwacja (dla formularzy i Server Actions) ---
const reservationBaseSchema = z.object({
  guestName: z.string().min(1, "Nazwa gościa wymagana").max(200),
  guestId: z.string().max(100).optional().nullable(), // ID istniejącego gościa – powiązanie z profilem
  guestEmail: z.string().email("Nieprawidłowy email").optional().or(z.literal("")),
  guestPhone: z.string().max(50).optional(),
  guestDateOfBirth: dateString.optional().nullable(), // data urodzenia gościa (YYYY-MM-DD)
  room: z.string().min(1, "Pokój wymagany").max(20),
  companyId: z.string().optional().nullable(),
  companyData: companyDataSchema.optional().nullable(), // firma do meldunku – przy tworzeniu rezerwacji zapisana do Company i powiązana
  rateCodeId: z.string().optional().nullable(),
  rateCodePrice: z.number().min(0).optional().nullable(), // nadpisanie ceny za dobę (PLN)
  parkingSpotId: z.string().optional().nullable(), // miejsce parkingowe – powiązane z rezerwacją
  checkIn: dateString,
  checkOut: dateString,
  checkInTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Godzina w formacie HH:mm").optional().nullable(),
  checkOutTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Godzina w formacie HH:mm").optional().nullable(),
  eta: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "ETA w formacie HH:mm").optional().nullable(), // szacowana godzina przyjazdu
  etd: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "ETD w formacie HH:mm").optional().nullable(), // szacowana godzina wyjazdu
  status: reservationStatus.default("CONFIRMED"),
  source: reservationSource.optional().nullable(), // źródło rezerwacji (OTA, telefon, email, walk-in, strona WWW)
  channel: reservationChannel.optional().nullable(), // kanał sprzedaży (Booking.com, Expedia, Airbnb, Direct, itp.)
  marketSegment: marketSegment.optional().nullable(), // segment rynkowy (Business, Leisure, Group, Corporate, itp.)
  tripPurpose: tripPurpose.optional().nullable(), // rodzaj pobytu (biznesowy, turystyczny, konferencja, itp.)
  mealPlan: mealPlan.optional().nullable(), // plan wyżywienia (RO, BB, HB, FB, AI)
  roomPreferences: roomPreferencesSchema, // preferencje pokoju (widok, piętro, cichy, itp.)
  pax: z.number().int().min(0).max(20).optional(),
  adults: z.number().int().min(0).max(20).optional().nullable(), // liczba dorosłych
  children: z.number().int().min(0).max(20).optional().nullable(), // liczba dzieci
  childrenAges: z.array(z.number().int().min(0).max(17)).max(20).optional().nullable(), // wiek dzieci [3, 7, 12]
  petInfo: petInfoSchema, // informacje o zwierzętach
  paymentStatus: paymentStatus.optional().nullable(), // status płatności (UNPAID, PARTIAL, PAID)
  securityDeposit: securityDepositSchema, // kaucja/depozyt za pokój
  cardGuarantee: cardGuaranteeSchema, // karta gwarancyjna (CC guarantee)
  advancePayment: advancePaymentSchema, // przedpłata wymagana
  cancellationReason: z.string().max(1000).optional().nullable(), // powód anulacji (tekst)
  cancellationCode: cancellationCode.optional().nullable(), // kod anulacji
  cancelledAt: z.string().datetime().optional().nullable(), // data i godzina anulacji (ISO)
  cancelledBy: z.string().max(100).optional().nullable(), // kto anulował
  alerts: reservationAlertsSchema, // alerty/flagi (VIP, bad payer, special request, itp.)
  agentId: z.string().max(100).optional().nullable(), // ID agenta/biura (referencja)
  agentData: agentDataSchema, // dane agenta/biura podróży
  bedsBooked: z.number().int().min(1).max(100).optional().nullable(), // rezerwacja zasobowa: ile łóżek (gdy room.beds > 1)
  notes: z.string().max(2000).optional().nullable(), // uwagi widoczne dla gościa (drukowane na potwierdzeniu)
  internalNotes: z.string().max(10000).optional().nullable(), // uwagi wewnętrzne (widoczne tylko dla personelu)
  specialRequests: z.string().max(5000).optional().nullable(), // specjalne życzenia (łóżeczko dziecięce, dieta, itp.)
  mrz: z.string().max(90).optional(), // kod MRZ z dowodu (formularz meldunkowy)
  customFormData: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(), // wartości dodatkowych pól z konfiguracji (zapis w reservation.metadata)
});

export const reservationSchema = reservationBaseSchema
  .refine(
    (data) => {
      const in_ = new Date(data.checkIn);
      const out = new Date(data.checkOut);
      return out > in_;
    },
    { message: "Data wyjazdu musi być po dacie przyjazdu", path: ["checkOut"] }
  )
  .refine(
    (data) => {
      const adults = data.adults ?? 0;
      const children = data.children ?? 0;
      const pax = data.pax;
      if (typeof pax === "number" && pax === 0) return false;
      if (adults === 0 && children === 0) return false;
      return true;
    },
    { message: "Podaj liczbę gości (dorosłych lub dzieci) – minimum 1", path: ["pax"] }
  )
  .refine(
    (data) => {
      // Oba pola muszą być podane razem (albo oba puste).
      if (!data.checkInTime && !data.checkOutTime) return true;
      if (data.checkInTime && data.checkOutTime) {
        // Różne dni – typowe godziny hotelowe (zameld. 14:00, wymeld. 11:00 następnego dnia) – zawsze OK.
        if (data.checkIn !== data.checkOut) return true;
        // Ten sam dzień (day-use) – godzina wymeld. musi być po zameld.
        const inDt = new Date(`${data.checkIn}T${data.checkInTime}`);
        const outDt = new Date(`${data.checkOut}T${data.checkOutTime}`);
        if (Number.isNaN(inDt.getTime()) || Number.isNaN(outDt.getTime())) return false;
        return outDt > inDt;
      }
      return false; // oba muszą być podane razem
    },
    { message: "Podaj obie godziny (od–do) w formacie HH:mm; przy tym samym dniu godzina wymeld. musi być po zameld.", path: ["checkOutTime"] }
  );

export type ReservationInput = z.infer<typeof reservationSchema>;

// --- Płatność (Blind Drop, zaliczki, Void) ---
export const paymentSchema = z.object({
  amount: z.number().positive("Kwota musi być dodatnia"),
  type: z.enum(["CASH", "CARD", "TRANSFER", "DEPOSIT", "VOID"]),
  reservationId: z.string().optional(),
});

export const blindDropSchema = z.object({
  countedCash: z.number().min(0, "Wprowadź policzoną gotówkę"),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
export type BlindDropInput = z.infer<typeof blindDropSchema>;

// --- Pokój (status dla Housekeeping) ---
export const roomStatusSchema = z.object({
  roomId: z.string(),
  status: roomStatus,
  reason: z.string().max(500).optional(),
});

export type RoomStatusInput = z.infer<typeof roomStatusSchema>;

// --- Pokój (dodawanie / zarządzanie) ---
export const createRoomSchema = z.object({
  number: z.string().min(1, "Numer pokoju wymagany").max(20),
  type: z.string().min(1, "Typ pokoju wymagany").max(50),
  price: z.number().min(0).optional(),
  beds: z.number().int().min(1).max(50).optional(), // 1 = cały pokój, >1 = sprzedaż po łóżku (dorm)
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

// --- Blokada pokoju (Out of Order / Maintenance) ---
export const roomBlockSchema = z
  .object({
    roomNumber: z.string().min(1, "Numer pokoju wymagany").max(20),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data od w formacie RRRR-MM-DD"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data do w formacie RRRR-MM-DD"),
    reason: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startDate + "T12:00:00Z");
    const end = new Date(data.endDate + "T12:00:00Z");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      ctx.addIssue({
        path: ["startDate"],
        code: z.ZodIssueCode.custom,
        message: "Nieprawidłowe daty.",
      });
      return;
    }
    if (end < start) {
      ctx.addIssue({
        path: ["endDate"],
        code: z.ZodIssueCode.custom,
        message: "Data zakończenia musi być po dacie rozpoczęcia.",
      });
    }
  });
export type RoomBlockInput = z.infer<typeof roomBlockSchema>;

// --- Przeniesienie rezerwacji (Tape Chart drag) ---
export const moveReservationSchema = z.object({
  reservationId: z.string().min(1, "ID rezerwacji wymagane"),
  newRoomNumber: z.string().min(1, "Numer pokoju wymagany").max(20),
  newCheckIn: z.string().optional(), // YYYY-MM-DD
  newCheckOut: z.string().optional(), // YYYY-MM-DD
});

export type MoveReservationInput = z.infer<typeof moveReservationSchema>;

// --- Podział rezerwacji (split) ---
export const splitReservationSchema = z
  .object({
    reservationId: z.string().min(1, "ID rezerwacji wymagane"),
    splitDate: dateString,
    secondRoomNumber: z.string().max(20).optional(),
  })
  .refine(
    () => {
      // splitDate jest walidowane w akcji względem checkIn/checkOut
      return true;
    },
    { message: "Data podziału musi być między zameldowaniem a wymeldowaniem", path: ["splitDate"] }
  );

export type SplitReservationInput = z.infer<typeof splitReservationSchema>;

// --- Rezerwacja grupowa ---
const groupReservationEntrySchema = reservationBaseSchema.omit({
  companyData: true,
  companyId: true,
  mrz: true,
});

export const groupReservationSchema = z.object({
  groupName: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
  reservations: z
    .array(groupReservationEntrySchema)
    .min(2, "Rezerwacja grupowa wymaga co najmniej dwóch pokoi"),
});

export type GroupReservationInput = z.infer<typeof groupReservationSchema>;
