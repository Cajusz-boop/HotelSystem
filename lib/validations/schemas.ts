import { z } from "zod";

/** YYYY-MM-DD */
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format daty: YYYY-MM-DD");

const roomStatus = z.enum(["CLEAN", "DIRTY", "OOO"]);
const reservationStatus = z.enum([
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
]);

// --- Gość ---
export const guestSchema = z.object({
  name: z.string().min(1, "Imię i nazwisko wymagane").max(200),
  email: z.string().email("Nieprawidłowy email").optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  mrz: z.string().max(90).optional(), // kod MRZ z dowodu (skaner 2D)
});

export type GuestInput = z.infer<typeof guestSchema>;

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
  });
export type CompanyDataInput = z.infer<typeof companyDataSchema>;

// --- Rezerwacja (dla formularzy i Server Actions) ---
export const reservationSchema = z
  .object({
    guestName: z.string().min(1, "Nazwa gościa wymagana").max(200),
    room: z.string().min(1, "Pokój wymagany").max(20),
    companyId: z.string().optional().nullable(),
    companyData: companyDataSchema.optional().nullable(), // firma do meldunku – przy tworzeniu rezerwacji zapisana do Company i powiązana
    rateCodeId: z.string().optional().nullable(),
    checkIn: dateString,
    checkOut: dateString,
    status: reservationStatus.default("CONFIRMED"),
    pax: z.number().int().min(0).max(20).optional(),
    mrz: z.string().max(90).optional(), // kod MRZ z dowodu (formularz meldunkowy)
  })
  .refine(
    (data) => {
      const in_ = new Date(data.checkIn);
      const out = new Date(data.checkOut);
      return out > in_;
    },
    { message: "Data wyjazdu musi być po dacie przyjazdu", path: ["checkOut"] }
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
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

// --- Przeniesienie rezerwacji (Tape Chart drag) ---
export const moveReservationSchema = z.object({
  reservationId: z.string().min(1, "ID rezerwacji wymagane"),
  newRoomNumber: z.string().min(1, "Numer pokoju wymagany").max(20),
});

export type MoveReservationInput = z.infer<typeof moveReservationSchema>;
