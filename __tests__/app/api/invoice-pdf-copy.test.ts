/**
 * Testy faktury PDF – oryginał + kopia na dwóch stronach.
 * GET /api/finance/invoice/[id]/pdf zwraca HTML z dwoma stronami (oryginał, kopia).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    invoice: { findUnique: vi.fn() },
    invoiceTemplate: { findUnique: vi.fn(), create: vi.fn() },
    transaction: { findMany: vi.fn() },
    reservation: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/ksef/env", () => ({
  getEffectiveKsefEnv: vi.fn(() => "disabled"),
}));

import { prisma } from "@/lib/db";
import { GET } from "@/app/api/finance/invoice/[id]/pdf/route";

function makeRequest(invoiceId: string): NextRequest {
  return new NextRequest(`https://test.example/api/finance/invoice/${invoiceId}/pdf`);
}

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    number: "FV/2026/0001",
    amountNet: 277.78,
    amountVat: 22.22,
    amountGross: 300,
    vatRate: 8,
    issuedAt: new Date("2026-02-17"),
    buyerName: "Firma Test Sp. z o.o.",
    buyerNip: "1234567890",
    buyerAddress: "ul. Testowa 1",
    buyerPostalCode: "00-001",
    buyerCity: "Warszawa",
    reservationId: "res-1",
    invoiceScope: "ALL",
    paymentMethod: "CASH",
    paymentDueDate: null,
    customFieldValues: null,
    notes: null,
    placeOfIssue: "Warszawa",
    issuedByName: "Jan Admin",
    receivedByName: "",
    ksefUuid: null,
    lineItems: [],
    deliveryDate: null,
    receiverName: null,
    receiverAddress: null,
    receiverPostalCode: null,
    receiverCity: null,
    ...overrides,
  };
}

function makeTemplate() {
  return {
    templateType: "DEFAULT",
    sellerName: "Hotel Test",
    sellerAddress: "ul. Kwiatowa 1",
    sellerPostalCode: "00-100",
    sellerCity: "Warszawa",
    sellerNip: "9876543210",
    fontFamily: "Arial",
    fontSize: 12,
    primaryColor: "#333",
    headerText: null,
    footerText: "Dziękujemy",
    thanksText: "Zapraszamy",
    defaultPaymentMethod: "CASH",
    defaultPaymentDays: 14,
    defaultUnit: "szt.",
    placeOfIssue: "Warszawa",
    issuedByName: "Admin",
    roomProductName: "Usługa hotelowa",
    showPkwiu: false,
    showUnit: true,
    showDiscount: false,
    logoBase64: null,
    logoUrl: null,
    logoPosition: null,
    logoWidth: null,
  };
}

describe("GET /api/finance/invoice/[id]/pdf – oryginał + kopia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(makeInvoice() as never);
    vi.mocked(prisma.invoiceTemplate.findUnique).mockResolvedValue(makeTemplate() as never);
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null);
  });

  it("zwraca 400 gdy brak id", async () => {
    const req = new NextRequest("https://test.example/api/finance/invoice//pdf");
    const res = await GET(req, { params: Promise.resolve({ id: "" }) });
    expect(res.status).toBe(400);
  });

  it("zwraca 404 gdy faktura nie istnieje", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(null);
    const req = makeRequest("non-existent");
    const res = await GET(req, { params: Promise.resolve({ id: "non-existent" }) });
    expect(res.status).toBe(404);
  });

  it("zwraca HTML zawierający oryginał i kopię na dwóch stronach", async () => {
    const req = makeRequest("inv-1");
    const res = await GET(req, { params: Promise.resolve({ id: "inv-1" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");

    const html = await res.text();

    // Strona 1: oryginał
    expect(html).toContain("oryginał</h1>");

    // Strona 2: kopia (w div.invoice-page-copy)
    expect(html).toContain("invoice-page-copy");
    expect(html).toContain("kopia</h1>");

    // Oba wystąpienia – oryginał raz, kopia raz
    const oryginalCount = (html.match(/oryginał<\/h1>/g) || []).length;
    const kopiaCount = (html.match(/kopia<\/h1>/g) || []).length;
    expect(oryginalCount).toBe(1);
    expect(kopiaCount).toBe(1);

    // Page break dla kopii
    expect(html).toContain("page-break-before");
  });

  it("zwraca HTML z danymi faktury", async () => {
    const req = makeRequest("inv-1");
    const res = await GET(req, { params: Promise.resolve({ id: "inv-1" }) });
    const html = await res.text();

    expect(html).toContain("FV/2026/0001");
    expect(html).toContain("300.00");
    expect(html).toContain("Firma Test");
  });
});
