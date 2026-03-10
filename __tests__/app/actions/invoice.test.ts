/**
 * Testy jednostkowe dla wystawiania faktur VAT, naliczania noclegu i konfiguracji VAT.
 * Pokrywają scenariusze, które powodowały błędy:
 * - brak firmy przy rezerwacji
 * - brak NIP nabywcy
 * - brak obciążeń (transakcji ROOM) → auto-naliczanie
 * - VAT 0% zamiast 8%
 * - brak ceny pokoju
 * - poprawne obliczenia netto/brutto/VAT
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocki bazy danych ───────────────────────────────────────────────────────

vi.mock("@/lib/db", () => {
  const mockPrisma: Record<string, unknown> = {
    reservation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      aggregate: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    invoice: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    cennikConfig: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    documentNumberingConfig: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    documentNumberCounter: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    reservationDayRate: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
    },
    room: {
      findMany: vi.fn(),
    },
    roomType: {
      findMany: vi.fn(),
    },
    ratePlan: {
      findMany: vi.fn(),
    },
    cashShift: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    blindDropRecord: { create: vi.fn(), findMany: vi.fn() },
    auditLog: { findFirst: vi.fn(), create: vi.fn() },
    fiscalReceiptTemplate: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };
  mockPrisma.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma));
  return { prisma: mockPrisma };
});

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("@/lib/permissions", () => ({
  can: vi.fn(() => Promise.resolve(true)),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));
vi.mock("@/lib/fiscal", () => ({
  isFiscalEnabled: vi.fn(() => Promise.resolve(false)),
  getFiscalConfig: vi.fn(() =>
    Promise.resolve({ enabled: false, driver: "mock", taxId: null, pointName: null })
  ),
  printFiscalInvoice: vi.fn(() => Promise.resolve({ success: true, invoiceNumber: "FV-MOCK" })),
  printFiscalReceipt: vi.fn(() => Promise.resolve({ success: true, receiptNumber: "PAR-001" })),
  supportsFiscalReports: vi.fn(() =>
    Promise.resolve({
      supportsXReport: false,
      supportsZReport: false,
      supportsPeriodicReport: false,
      supportsStorno: false,
    })
  ),
  printFiscalXReport: vi.fn(),
  printFiscalZReport: vi.fn(),
}));

vi.mock("@/app/actions/cennik-config", () => ({
  getCennikConfig: vi.fn(),
}));

vi.mock("@/app/actions/rooms", () => ({
  getEffectivePricesBatch: vi.fn(),
}));

// ─── Importy po mockach ─────────────────────────────────────────────────────

import { prisma } from "@/lib/db";
import { printFiscalReceipt } from "@/lib/fiscal";
import {
  createVatInvoice,
  postRoomChargeOnCheckout,
  printInvoiceForReservation,
  printFiscalReceiptForReservation,
  overrideRoomPrice,
} from "@/app/actions/finance";
import { getCennikConfig } from "@/app/actions/cennik-config";
import { getEffectivePricesBatch } from "@/app/actions/rooms";

// ─── Helpery do tworzenia danych testowych ──────────────────────────────────

function makeReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: "res-1",
    guestId: "guest-1",
    roomId: "room-1",
    companyId: "company-1",
    checkIn: new Date("2026-02-18"),
    checkOut: new Date("2026-02-19"),
    status: "CONFIRMED",
    room: {
      id: "room-1",
      number: "5",
      price: 300,
    },
    company: {
      id: "company-1",
      name: "Karczma Łabędź",
      nip: "5711640854",
      address: "ul. Główna 10",
      postalCode: "34-500",
      city: "Zakopane",
    },
    transactions: [],
    ...overrides,
  };
}

function makeRoomTransaction(amount: number, type = "ROOM") {
  return {
    id: `tx-${Math.random().toString(36).slice(2)}`,
    reservationId: "res-1",
    amount,
    type,
    status: "ACTIVE",
    createdAt: new Date(),
    paymentMethod: null,
    description: "Nocleg 2026-02-18 - 2026-02-19",
    quantity: 1,
    unitPrice: amount,
    vatRate: 8,
    vatAmount: null,
    netAmount: null,
    category: null,
    subcategory: null,
    departmentCode: null,
    invoiceId: null,
    receiptId: null,
    folioNumber: 1,
    paymentDetails: null,
    isReadOnly: false,
  };
}

function mockCennikConfig(vatPercent = 8, pricesAreNetto = false) {
  vi.mocked(getCennikConfig).mockResolvedValue({
    success: true,
    data: { currency: "PLN", vatPercent, pricesAreNetto },
  });
}

function mockDocumentNumbering() {
  vi.mocked(prisma.documentNumberingConfig.findUnique).mockResolvedValue({
    id: "cfg-inv",
    documentType: "INVOICE",
    prefix: "FV",
    separator: "/",
    yearFormat: "YYYY",
    sequencePadding: 4,
    resetYearly: true,
    description: "Faktura VAT",
    exampleNumber: "FV/2026/0001",
  } as never);
  vi.mocked(prisma.documentNumberCounter.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.documentNumberCounter.create).mockResolvedValue({
    id: "cnt-1",
    documentType: "INVOICE",
    year: 2026,
    lastSequence: 1,
  } as never);
  vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
}

// ─── Testy ──────────────────────────────────────────────────────────────────

describe("Fakturowanie – createVatInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);
  });

  it("Błąd: brak rezerwacji", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null);

    const result = await createVatInvoice("non-existent");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("nie istnieje");
    }
  });

  it("Błąd: brak firmy przy rezerwacji", async () => {
    const res = makeReservation({ company: null, companyId: null });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);

    const result = await createVatInvoice("res-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Brak firmy");
      expect(result.error).toContain("NIP");
    }
  });

  it("Błąd: firma bez NIP", async () => {
    const res = makeReservation({
      company: { id: "c-1", name: "Firma bez NIP", nip: null, address: null, postalCode: null, city: null },
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);

    const result = await createVatInvoice("res-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("NIP");
    }
  });

  it("Błąd: firma z pustym NIP (same spacje)", async () => {
    const res = makeReservation({
      company: { id: "c-1", name: "Firma", nip: "   ", address: null, postalCode: null, city: null },
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);

    const result = await createVatInvoice("res-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("NIP");
    }
  });

  it("Błąd: brak obciążeń i auto-naliczanie nie powiodło się (pokój bez ceny)", async () => {
    const res = makeReservation({
      transactions: [],
      room: { id: "room-1", number: "5", price: null },
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    vi.mocked(prisma.transaction.count).mockResolvedValue(0);
    vi.mocked(getEffectivePricesBatch).mockResolvedValue({});
    mockCennikConfig(8, false);

    const result = await createVatInvoice("res-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("większa od zera");
      expect(result.error).toContain("cenę");
    }
  });

  it("Błąd: duplikat faktury – rezerwacja ma już wystawioną fakturę NORMAL", async () => {
    const roomTx = makeRoomTransaction(235);
    const res = makeReservation({ transactions: [roomTx] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: "inv-1",
      number: "FV/022/03/K",
      reservationId: "res-1",
      invoiceType: "NORMAL",
    } as never);

    const result = await createVatInvoice("res-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("ma już wystawioną fakturę");
      expect(result.error).toContain("FV/022/03/K");
    }
  });

  it("Happy path: faktura z istniejącą transakcją ROOM, VAT 8% brutto", async () => {
    const roomTx = makeRoomTransaction(300);
    const res = makeReservation({ transactions: [roomTx] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    mockCennikConfig(8, false);
    mockDocumentNumbering();
    const mockInvoice = {
      id: "inv-1",
      number: "FV/2026/0001",
      amountNet: 277.78,
      amountVat: 22.22,
      amountGross: 300,
      issuedAt: new Date("2026-02-17"),
      reservationId: "res-1",
      vatRate: 8,
    };
    vi.mocked(prisma.invoice.create).mockResolvedValue(mockInvoice as never);

    const result = await createVatInvoice("res-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.number).toContain("FV");
      expect(result.data.amountGross).toBe(300);
      expect(result.data.amountVat).toBeGreaterThan(0);
      expect(result.data.amountNet).toBeLessThan(300);
    }
  });

  it("Happy path: VAT 8% brutto – poprawne obliczenia netto/VAT", async () => {
    const roomTx = makeRoomTransaction(300);
    const res = makeReservation({ transactions: [roomTx] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    mockCennikConfig(8, false);
    mockDocumentNumbering();

    const expectedNet = Math.round((300 / 1.08) * 100) / 100;
    const expectedVat = 300 - expectedNet;

    // @ts-expect-error - mock zwraca uproszczony obiekt, pełny typ Prisma nie jest potrzebny w teście
    vi.mocked(prisma.invoice.create).mockImplementation(async (args: { data: Record<string, unknown> }) => {
      expect(args.data.vatRate).toBe(8);
      expect(args.data.amountGross).toBeCloseTo(300, 2);
      expect(args.data.amountNet).toBeCloseTo(expectedNet, 2);
      expect(args.data.amountVat).toBeCloseTo(expectedVat, 2);

      return {
        id: "inv-1",
        number: "FV/2026/0001",
        amountNet: args.data.amountNet,
        amountVat: args.data.amountVat,
        amountGross: args.data.amountGross,
        issuedAt: new Date("2026-02-17"),
        reservationId: "res-1",
        vatRate: 8,
      } as never;
    });

    const result = await createVatInvoice("res-1");
    expect(result.success).toBe(true);
  });

  it("Regresja: VAT nie może być 0% dla standardowej faktury hotelowej", async () => {
    const roomTx = makeRoomTransaction(300);
    const res = makeReservation({ transactions: [roomTx] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    mockCennikConfig(8, false);
    mockDocumentNumbering();

    // @ts-expect-error - mock zwraca uproszczony obiekt, pełny typ Prisma nie jest potrzebny w teście
    vi.mocked(prisma.invoice.create).mockImplementation(async (args: { data: Record<string, unknown> }) => {
      expect(args.data.vatRate).not.toBe(0);
      expect(Number(args.data.amountVat)).toBeGreaterThan(0);

      return {
        id: "inv-1",
        number: "FV/2026/0001",
        amountNet: args.data.amountNet,
        amountVat: args.data.amountVat,
        amountGross: args.data.amountGross,
        issuedAt: new Date("2026-02-17"),
        reservationId: "res-1",
        vatRate: args.data.vatRate,
      } as never;
    });

    const result = await createVatInvoice("res-1");
    expect(result.success).toBe(true);
  });

  it("invoiceScope HOTEL_ONLY: tylko transakcje hotelowe (bez gastronomii)", async () => {
    const roomTx = makeRoomTransaction(300, "ROOM");
    const gastronomyTx = makeRoomTransaction(50, "GASTRONOMY");
    const res = makeReservation({
      transactions: [roomTx, gastronomyTx],
      invoiceScope: "HOTEL_ONLY",
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    mockCennikConfig(8, false);
    mockDocumentNumbering();

    // @ts-expect-error mock zwraca uproszczony obiekt
    vi.mocked(prisma.invoice.create).mockImplementation(async (args: { data: Record<string, unknown> }) => {
      expect(args.data.amountGross).toBe(300);
      expect(args.data.invoiceScope).toBe("HOTEL_ONLY");
      return {
        id: "inv-1",
        number: "FV/2026/0001",
        amountNet: 277.78,
        amountVat: 22.22,
        amountGross: 300,
        issuedAt: new Date("2026-02-17"),
        reservationId: "res-1",
        vatRate: 8,
      };
    });

    const result = await createVatInvoice("res-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amountGross).toBe(300);
    }
  });

  it("invoiceScope GASTRONOMY_ONLY: tylko transakcje gastronomiczne", async () => {
    const roomTx = makeRoomTransaction(300, "ROOM");
    const gastronomyTx = makeRoomTransaction(50, "GASTRONOMY");
    const res = makeReservation({
      transactions: [roomTx, gastronomyTx],
      invoiceScope: "GASTRONOMY_ONLY",
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    mockCennikConfig(8, false);
    mockDocumentNumbering();

    // @ts-expect-error mock zwraca uproszczony obiekt
    vi.mocked(prisma.invoice.create).mockImplementation(async (args: { data: Record<string, unknown> }) => {
      expect(args.data.amountGross).toBe(50);
      expect(args.data.invoiceScope).toBe("GASTRONOMY_ONLY");
      return {
        id: "inv-1",
        number: "FV/2026/0001",
        amountNet: 46.3,
        amountVat: 3.7,
        amountGross: 50,
        issuedAt: new Date("2026-02-17"),
        reservationId: "res-1",
        vatRate: 8,
      };
    });

    const result = await createVatInvoice("res-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amountGross).toBe(50);
    }
  });

  it("invoiceScope ALL (domyślny): wszystkie obciążenia", async () => {
    const roomTx = makeRoomTransaction(300, "ROOM");
    const gastronomyTx = makeRoomTransaction(50, "GASTRONOMY");
    const res = makeReservation({ transactions: [roomTx, gastronomyTx] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    mockCennikConfig(8, false);
    mockDocumentNumbering();

    // @ts-expect-error mock zwraca uproszczony obiekt
    vi.mocked(prisma.invoice.create).mockImplementation(async () => ({
      id: "inv-1",
      number: "FV/2026/0001",
      amountNet: 324.07,
      amountVat: 25.93,
      amountGross: 350,
      issuedAt: new Date("2026-02-17"),
      reservationId: "res-1",
      vatRate: 8,
    }));

    const result = await createVatInvoice("res-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amountGross).toBe(350);
    }
  });

  it("Dane nabywcy: faktura zawiera NIP, nazwę i adres firmy", async () => {
    const roomTx = makeRoomTransaction(300);
    const res = makeReservation({ transactions: [roomTx] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    mockCennikConfig(8, false);
    mockDocumentNumbering();

    // @ts-expect-error - mock zwraca uproszczony obiekt, pełny typ Prisma nie jest potrzebny w teście
    vi.mocked(prisma.invoice.create).mockImplementation(async (args: { data: Record<string, unknown> }) => {
      expect(args.data.buyerNip).toBe("5711640854");
      expect(args.data.buyerName).toBe("Karczma Łabędź");
      expect(args.data.buyerAddress).toBe("ul. Główna 10");
      expect(args.data.buyerPostalCode).toBe("34-500");
      expect(args.data.buyerCity).toBe("Zakopane");

      return {
        id: "inv-1",
        number: "FV/2026/0001",
        amountNet: 277.78,
        amountVat: 22.22,
        amountGross: 300,
        issuedAt: new Date("2026-02-17"),
        reservationId: "res-1",
        vatRate: 8,
      } as never;
    });

    const result = await createVatInvoice("res-1");
    expect(result.success).toBe(true);
  });

  it("Weryfikacja kwot: wpisana kwota na fakturze (amountGrossOverride 200) zapisana w Invoice.amountGross", async () => {
    const roomTx = makeRoomTransaction(300);
    const res = makeReservation({ transactions: [roomTx] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    mockCennikConfig(8, false);
    mockDocumentNumbering();

    let savedAmountGross: number | null = null;
    // @ts-expect-error mock zwraca uproszczony obiekt
    vi.mocked(prisma.invoice.create).mockImplementation(async (args: { data: Record<string, unknown> }) => {
      savedAmountGross = Number(args.data.amountGross);
      return {
        id: "inv-1",
        number: "FV/2026/0001",
        amountNet: args.data.amountNet,
        amountVat: args.data.amountVat,
        amountGross: args.data.amountGross,
        issuedAt: new Date("2026-02-17"),
        reservationId: "res-1",
        vatRate: 8,
      };
    });

    const result = await createVatInvoice("res-1", undefined, { amountGrossOverride: 200 });

    expect(result.success).toBe(true);
    expect(result.success && result.data.amountGross).toBe(200);
    expect(savedAmountGross).toBe(200);
  });

  it("Happy path: amountGrossOverride – faktura na podaną kwotę (split 200/100)", async () => {
    const roomTx = makeRoomTransaction(300);
    const res = makeReservation({ transactions: [roomTx] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    mockCennikConfig(8, false);
    mockDocumentNumbering();

    // @ts-expect-error mock zwraca uproszczony obiekt
    vi.mocked(prisma.invoice.create).mockImplementation(async (args: { data: Record<string, unknown> }) => {
      expect(args.data.amountGross).toBe(200);
      const net = Number(args.data.amountNet);
      const vat = Number(args.data.amountVat);
      expect(net + vat).toBeCloseTo(200, 2);
      return {
        id: "inv-1",
        number: "FV/2026/0001",
        amountNet: args.data.amountNet,
        amountVat: args.data.amountVat,
        amountGross: 200,
        issuedAt: new Date("2026-02-17"),
        reservationId: "res-1",
        vatRate: 8,
      };
    });

    const result = await createVatInvoice("res-1", undefined, { amountGrossOverride: 200 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amountGross).toBe(200);
    }
  });

  it("Edge case: amountGrossOverride 0 – ignorowane (używana suma z transakcji)", async () => {
    const roomTx = makeRoomTransaction(300);
    const res = makeReservation({ transactions: [roomTx] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    mockCennikConfig(8, false);
    mockDocumentNumbering();
    vi.mocked(prisma.invoice.create).mockResolvedValue({
      id: "inv-1",
      number: "FV/2026/0001",
      amountNet: 277.78,
      amountVat: 22.22,
      amountGross: 300,
      issuedAt: new Date("2026-02-17"),
      reservationId: "res-1",
      vatRate: 8,
    } as never);

    const result = await createVatInvoice("res-1", undefined, { amountGrossOverride: 0 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amountGross).toBe(300);
    }
  });

  it("Auto-naliczanie: bez transakcji ROOM wywołuje postRoomChargeOnCheckout", async () => {
    const res = makeReservation({ transactions: [] });
    vi.mocked(prisma.reservation.findUnique)
      .mockResolvedValueOnce(res as never)
      .mockResolvedValueOnce(res as never)
      .mockResolvedValueOnce({
        ...res,
        transactions: [makeRoomTransaction(300)],
      } as never);
    vi.mocked(prisma.transaction.count).mockResolvedValue(0);
    vi.mocked(getEffectivePricesBatch).mockResolvedValue({ "5-2026-02-18": 300 });
    vi.mocked(prisma.transaction.create).mockResolvedValue(makeRoomTransaction(300) as never);
    mockCennikConfig(8, false);
    mockDocumentNumbering();
    vi.mocked(prisma.invoice.create).mockResolvedValue({
      id: "inv-1",
      number: "FV/2026/0001",
      amountNet: 277.78,
      amountVat: 22.22,
      amountGross: 300,
      issuedAt: new Date("2026-02-17"),
      reservationId: "res-1",
      vatRate: 8,
    } as never);

    const result = await createVatInvoice("res-1");

    expect(result.success).toBe(true);
    expect(prisma.transaction.create).toHaveBeenCalled();
  });
});

// ─── postRoomChargeOnCheckout ───────────────────────────────────────────────

describe("Naliczanie noclegu – postRoomChargeOnCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Błąd: rezerwacja nie istnieje", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null);

    const result = await postRoomChargeOnCheckout("non-existent");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("nie istnieje");
    }
  });

  it("Idempotentność: nie nalicza podwójnie jeśli ROOM już istnieje", async () => {
    const res = makeReservation();
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    vi.mocked(prisma.transaction.count).mockResolvedValue(1);

    const result = await postRoomChargeOnCheckout("res-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.skipped).toBe(true);
    }
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it("Błąd: pokój bez ceny i bez stawki sezonowej", async () => {
    const res = makeReservation({
      room: { id: "room-1", number: "5", price: null },
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    vi.mocked(prisma.transaction.count).mockResolvedValue(0);
    vi.mocked(getEffectivePricesBatch).mockResolvedValue({});

    const result = await postRoomChargeOnCheckout("res-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("cenę");
    }
  });

  it("Błąd: pokój bez numeru", async () => {
    const res = makeReservation({
      room: null,
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    vi.mocked(prisma.transaction.count).mockResolvedValue(0);

    const result = await postRoomChargeOnCheckout("res-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("pokoju");
    }
  });

  it("Happy path: nalicza nocleg z ceny pokoju", async () => {
    const res = makeReservation();
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    vi.mocked(prisma.transaction.count).mockResolvedValue(0);
    vi.mocked(getEffectivePricesBatch).mockResolvedValue({});
    vi.mocked(prisma.transaction.create).mockResolvedValue({
      id: "tx-new",
      amount: 300,
      type: "ROOM",
    } as never);

    const result = await postRoomChargeOnCheckout("res-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.amount).toBe(300);
      expect(result.data?.skipped).toBeUndefined();
    }
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "ROOM",
          amount: 300,
          reservationId: "res-1",
        }),
      })
    );
  });

  it("Happy path: nalicza nocleg ze stawki sezonowej (priorytet nad ceną pokoju)", async () => {
    const res = makeReservation({
      room: { id: "room-1", number: "5", price: 200 },
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    vi.mocked(prisma.transaction.count).mockResolvedValue(0);
    vi.mocked(getEffectivePricesBatch).mockResolvedValue({ "5-2026-02-18": 350 });
    vi.mocked(prisma.transaction.create).mockResolvedValue({
      id: "tx-new",
      amount: 350,
      type: "ROOM",
    } as never);

    const result = await postRoomChargeOnCheckout("res-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.amount).toBe(350);
    }
  });

  it("Wiele nocy: nalicza sumę za każdą noc", async () => {
    const res = makeReservation({
      checkIn: new Date("2026-02-18"),
      checkOut: new Date("2026-02-21"),
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    vi.mocked(prisma.transaction.count).mockResolvedValue(0);
    vi.mocked(getEffectivePricesBatch).mockResolvedValue({
      "5-2026-02-18": 300,
      "5-2026-02-19": 350,
      "5-2026-02-20": 300,
    });
    vi.mocked(prisma.transaction.create).mockResolvedValue({
      id: "tx-new",
      amount: 950,
      type: "ROOM",
    } as never);

    const result = await postRoomChargeOnCheckout("res-1");

    expect(result.success).toBe(true);
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 950,
        }),
      })
    );
  });

  it("Opis noclegu: zawiera daty w formacie YYYY-MM-DD", async () => {
    const res = makeReservation();
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    vi.mocked(prisma.transaction.count).mockResolvedValue(0);
    vi.mocked(getEffectivePricesBatch).mockResolvedValue({});
    vi.mocked(prisma.transaction.create).mockResolvedValue({
      id: "tx-new",
      amount: 300,
      type: "ROOM",
    } as never);

    await postRoomChargeOnCheckout("res-1");

    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: expect.stringMatching(/Nocleg \d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2}/),
        }),
      })
    );
  });
});

// ─── getCennikConfig – auto-migracja VAT ────────────────────────────────────

describe("Konfiguracja VAT – getCennikConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("Nowa instalacja: domyślny VAT = 8%, ceny brutto", async () => {
    const { getCennikConfig: realGetCennikConfig } = await vi.importActual<
      typeof import("@/app/actions/cennik-config")
    >("@/app/actions/cennik-config");

    vi.mocked(prisma.cennikConfig.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.cennikConfig.create).mockResolvedValue({
      id: "default",
      currency: "PLN",
      vatPercent: 8,
      pricesAreNetto: false,
    } as never);

    const result = await realGetCennikConfig();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vatPercent).toBe(8);
      expect(result.data.pricesAreNetto).toBe(false);
    }
  });

  it("Auto-migracja: VAT 0% netto → aktualizuje na 8% brutto", async () => {
    const { getCennikConfig: realGetCennikConfig } = await vi.importActual<
      typeof import("@/app/actions/cennik-config")
    >("@/app/actions/cennik-config");

    vi.mocked(prisma.cennikConfig.findUnique).mockResolvedValue({
      id: "default",
      currency: "PLN",
      vatPercent: 0,
      pricesAreNetto: true,
    } as never);
    vi.mocked(prisma.cennikConfig.update).mockResolvedValue({
      id: "default",
      currency: "PLN",
      vatPercent: 8,
      pricesAreNetto: false,
    } as never);

    const result = await realGetCennikConfig();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vatPercent).toBe(8);
      expect(result.data.pricesAreNetto).toBe(false);
    }
    expect(prisma.cennikConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vatPercent: 8,
          pricesAreNetto: false,
        }),
      })
    );
  });

  it("Bez migracji: VAT 23% nie jest nadpisywany", async () => {
    const { getCennikConfig: realGetCennikConfig } = await vi.importActual<
      typeof import("@/app/actions/cennik-config")
    >("@/app/actions/cennik-config");

    vi.mocked(prisma.cennikConfig.findUnique).mockResolvedValue({
      id: "default",
      currency: "PLN",
      vatPercent: 23,
      pricesAreNetto: false,
    } as never);

    const result = await realGetCennikConfig();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vatPercent).toBe(23);
    }
    expect(prisma.cennikConfig.update).not.toHaveBeenCalled();
  });
});

// ─── overrideRoomPrice ──────────────────────────────────────────────────────

describe("Nadpisanie ceny noclegu – overrideRoomPrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Błąd: kwota <= 0", async () => {
    const res = makeReservation();
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);

    const result = await overrideRoomPrice("res-1", 0);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("większa od zera");

    const result2 = await overrideRoomPrice("res-1", -100);
    expect(result2.success).toBe(false);
  });

  it("Happy path: nadpisuje cenę gdy istnieje transakcja ROOM", async () => {
    const roomTx = makeRoomTransaction(300, "ROOM");
    const res = makeReservation({
      transactions: [roomTx],
      room: { id: "room-1", number: "5", price: 300 },
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    vi.mocked(prisma.reservationDayRate.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.reservation.update).mockResolvedValue(res as never);
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      ...roomTx,
      id: "tx-room-1",
      isManualOverride: false,
      originalAmount: null,
    } as never);
    vi.mocked(prisma.transaction.update).mockResolvedValue({} as never);

    const result = await overrideRoomPrice("res-1", 250);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(250);
    }
    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tx-room-1" },
        data: expect.objectContaining({
          amount: 250,
          unitPrice: 250,
          isManualOverride: true,
        }),
      })
    );
  });

  it("Happy path: tworzy transakcję ROOM gdy nie istnieje", async () => {
    const res = makeReservation({
      transactions: [],
      room: { id: "room-1", number: "5", price: 300 },
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    vi.mocked(prisma.reservationDayRate.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.reservation.update).mockResolvedValue(res as never);
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.transaction.create).mockResolvedValue({
      id: "tx-new",
      amount: 250,
      type: "ROOM",
    } as never);

    const result = await overrideRoomPrice("res-1", 250);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(250);
    }
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "ROOM",
          amount: 250,
          isManualOverride: true,
        }),
      })
    );
  });
});

// ─── printInvoiceForReservation ─────────────────────────────────────────────

describe("Druk faktury POSNET – printInvoiceForReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Błąd: brak firmy", async () => {
    const res = makeReservation({ company: null, companyId: null });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);

    const result = await printInvoiceForReservation("res-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Brak firmy");
    }
  });

  it("Błąd: firma bez NIP", async () => {
    const res = makeReservation({
      company: { id: "c-1", name: "Firma", nip: null, address: null, postalCode: null, city: null },
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);

    const result = await printInvoiceForReservation("res-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("NIP");
    }
  });

  it("Auto-naliczanie: bez transakcji ROOM próbuje naliczyć nocleg", async () => {
    const res = makeReservation({ transactions: [] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    vi.mocked(prisma.transaction.count).mockResolvedValue(0);
    vi.mocked(prisma.reservationDayRate.findMany).mockResolvedValue([]);
    vi.mocked(getEffectivePricesBatch).mockResolvedValue({ "5-2026-02-18": 300 });
    vi.mocked(prisma.transaction.create).mockResolvedValue(makeRoomTransaction(300) as never);

    await printInvoiceForReservation("res-1");

    expect(prisma.transaction.create).toHaveBeenCalled();
  });
});

// ─── printFiscalReceiptForReservation ───────────────────────────────────────

describe("Paragon fiskalny – printFiscalReceiptForReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.fiscalReceiptTemplate.findFirst).mockResolvedValue({
      id: "tpl-1",
      headerLine1: "Hotel",
      headerLine2: null,
      headerLine3: null,
      footerLine1: "Dziękujemy",
      footerLine2: null,
      footerLine3: null,
      itemNameRoom: null,
      itemNameDeposit: null,
      itemNameMinibar: null,
      itemNameService: null,
      itemNameLocalTax: null,
      itemNameParking: null,
      defaultVatRate: 8,
      includeRoomNumber: false,
      includeStayDates: false,
      roomNumberFormat: null,
    } as never);
  });

  it("Błąd: rezerwacja nie istnieje", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null);

    const result = await printFiscalReceiptForReservation("non-existent");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("nie istnieje");
    }
  });

  it("Błąd: brak obciążeń (bez amountOverride)", async () => {
    const res = makeReservation({ transactions: [] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    vi.mocked(prisma.transaction.count).mockResolvedValue(0);

    const result = await printFiscalReceiptForReservation("res-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Brak pozycji");
    }
  });

  it("Happy path: paragon na pełną kwotę z transakcji", async () => {
    const roomTx = makeRoomTransaction(300);
    const res = makeReservation({ transactions: [roomTx] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);

    const result = await printFiscalReceiptForReservation("res-1");

    expect(result.success).toBe(true);
    expect(vi.mocked(printFiscalReceipt)).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmount: 300,
        items: expect.arrayContaining([
          expect.objectContaining({ name: "Nocleg", unitPrice: 300 }),
        ]),
      })
    );
  });

  it("Happy path: amountOverride – paragon na podaną kwotę (split 100 PLN)", async () => {
    const roomTx = makeRoomTransaction(300);
    const res = makeReservation({ transactions: [roomTx] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);

    const result = await printFiscalReceiptForReservation("res-1", "CASH", 100);

    expect(result.success).toBe(true);
    expect(vi.mocked(printFiscalReceipt)).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmount: 100,
        items: [
          expect.objectContaining({
            name: "Nocleg",
            quantity: 1,
            unitPrice: 100,
            vatRate: 8,
          }),
        ],
      })
    );
  });

  it("Weryfikacja kwot: wpisana kwota na paragonie (amountOverride 100) pojawia się w request do kasy", async () => {
    const roomTx = makeRoomTransaction(300);
    const res = makeReservation({ transactions: [roomTx] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);

    const result = await printFiscalReceiptForReservation("res-1", "CASH", 100);

    expect(result.success).toBe(true);
    expect(vi.mocked(printFiscalReceipt)).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmount: 100,
        items: [
          expect.objectContaining({
            name: "Nocleg",
            quantity: 1,
            unitPrice: 100,
            vatRate: 8,
          }),
        ],
      })
    );
  });

  it("Edge case: amountOverride 0 – ignorowany (używana suma z transakcji)", async () => {
    const roomTx = makeRoomTransaction(300);
    const res = makeReservation({ transactions: [roomTx] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);

    const result = await printFiscalReceiptForReservation("res-1", "CASH", 0);

    expect(result.success).toBe(true);
    expect(vi.mocked(printFiscalReceipt)).toHaveBeenCalledWith(
      expect.objectContaining({ totalAmount: 300 })
    );
  });
});
