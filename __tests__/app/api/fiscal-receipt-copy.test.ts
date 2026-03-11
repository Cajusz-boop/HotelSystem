/**
 * Testy API kopia paragonu – GET /api/finance/fiscal-receipt-copy
 * Sprawdza, że endpoint zwraca HTML z kopią paragonu (pozycje, kwoty, split).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/app/actions/finance", () => ({
  getFiscalReceiptTemplate: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { getFiscalReceiptTemplate } from "@/app/actions/finance";
import { GET } from "@/app/api/finance/fiscal-receipt-copy/route";

function makeRequest(reservationId: string, amount?: number): NextRequest {
  const url = amount != null
    ? `https://test.example/api/finance/fiscal-receipt-copy?reservationId=${reservationId}&amount=${amount}`
    : `https://test.example/api/finance/fiscal-receipt-copy?reservationId=${reservationId}`;
  return new NextRequest(url);
}

describe("GET /api/finance/fiscal-receipt-copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFiscalReceiptTemplate).mockResolvedValue({
      success: true,
      data: {
        headerLine1: "Hotel Test",
        headerLine2: "ul. Kwiatowa 1",
        footerLine1: "Dziękujemy",
      },
    } as never);
  });

  it("zwraca 400 gdy brak reservationId", async () => {
    const req = new NextRequest("https://test.example/api/finance/fiscal-receipt-copy");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("Brak reservationId");
  });

  it("zwraca 404 gdy rezerwacja nie istnieje", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null);
    const req = makeRequest("non-existent");
    const res = await GET(req);
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toContain("Rezerwacja nie istnieje");
  });

  it("zwraca 400 gdy brak pozycji na paragonie (pusta rezerwacja, bez amount)", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: "res-1",
      transactions: [],
      guest: null,
    } as never);
    const req = makeRequest("res-1");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("Brak pozycji na paragonie");
  });

  it("zwraca HTML z kopią paragonu – kwota z transakcji", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: "res-1",
      transactions: [
        { id: "tx-1", type: "ROOM", amount: 300, status: "ACTIVE" },
      ],
      guest: { name: "Jan Kowalski" },
    } as never);

    const req = makeRequest("res-1");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("KOPIA PARAGONU");
    expect(html).toContain("Paragon");
    expect(html).toContain("300.00");
    expect(html).toContain("Usługa gastronomiczna");
    expect(html).toContain("Hotel Test");
    expect(html).toContain("Jan Kowalski");
  });

  it("zwraca HTML z kwotą override (split) gdy podano amount", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: "res-1",
      transactions: [
        { id: "tx-1", type: "ROOM", amount: 300, status: "ACTIVE" },
      ],
      guest: { name: "Anna Nowak" },
    } as never);

    const req = makeRequest("res-1", 100);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("KOPIA PARAGONU");
    expect(html).toContain("100.00");
    expect(html).toContain("Usługa gastronomiczna");
  });

  it("wyświetla numer paragonu gdy przekazano receiptNumber", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: "res-1",
      transactions: [
        { id: "tx-1", type: "ROOM", amount: 200, status: "ACTIVE" },
      ],
      guest: { name: "Jan Test" },
    } as never);

    const req = new NextRequest(
      "https://test.example/api/finance/fiscal-receipt-copy?reservationId=res-1&receiptNumber=PAR-123"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Nr paragonu: PAR-123");
    expect(html).toContain("Nr PAR-123");
  });

  it("zwraca 200 gdy pusta rezerwacja ale podano amount (split)", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: "res-1",
      transactions: [],
      guest: null,
    } as never);

    const req = makeRequest("res-1", 50);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("50.00");
    expect(html).toContain("Usługa gastronomiczna");
  });
});
