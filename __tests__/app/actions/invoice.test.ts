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
      findUnique: vi.fn(),
      aggregate: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    invoice: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
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
import {
  createVatInvoice,
  postRoomChargeOnCheckout,
  printInvoiceForReservation,
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

  it("Dane nabywcy: faktura zawiera NIP, nazwę i adres firmy", async () => {
    const roomTx = makeRoomTransaction(300);
    const res = makeReservation({ transactions: [roomTx] });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(res as never);
    mockCennikConfig(8, false);
    mockDocumentNumbering();

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

    const result = await printInvoiceForReservation("res-1");

    expect(prisma.transaction.create).toHaveBeenCalled();
  });
});
