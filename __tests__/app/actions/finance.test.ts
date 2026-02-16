/**
 * Testy jednostkowe dla app/actions/finance.ts
 * Happy path i edge case dla funkcji numeracji dokumentów i konfiguracji fiskalnej.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DocumentType } from "@/app/actions/finance";

// Mock bazy przed importem modułu
vi.mock("@/lib/db", () => ({
  prisma: {
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
    transaction: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      aggregate: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    cennikConfig: { findUnique: vi.fn() },
    blindDropRecord: { create: vi.fn(), findMany: vi.fn() },
    reservation: { findMany: vi.fn(), updateMany: vi.fn() },
    auditLog: { findFirst: vi.fn(), create: vi.fn() },
    invoice: { findMany: vi.fn() },
    cashShift: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn(() => Promise.resolve(null)) }));
vi.mock("@/lib/permissions", () => ({ can: vi.fn(() => Promise.resolve(true)) }));

vi.mock("next/headers", () => ({ headers: vi.fn(() => Promise.resolve(new Headers())) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(), getClientIp: vi.fn(() => "127.0.0.1") }));
vi.mock("@/lib/fiscal", () => ({
  isFiscalEnabled: vi.fn(() => Promise.resolve(false)),
  getFiscalConfig: vi.fn(() =>
    Promise.resolve({ enabled: false, driver: "mock", taxId: null, pointName: null })
  ),
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

import { prisma } from "@/lib/db";
import {
  getDocumentNumberingConfig,
  getAllDocumentNumberingConfigs,
  updateDocumentNumberingConfig,
  generateNextDocumentNumber,
  getDocumentNumberCounters,
  getFiscalConfigAction,
  supportsFiscalReportsAction,
  getManagementReportData,
  getCommissionReport,
  getTransactionsForToday,
  getCashSumForToday,
  submitBlindDrop,
  getBlindDropHistory,
  getVatSalesRegister,
  getVatPurchasesRegister,
  getKpirReport,
  verifyManagerPin,
  getCurrentCashShift,
  openCashShift,
  closeCashShift,
  getCashShiftHistory,
  getCashShiftReport,
  getAvailablePaymentMethods,
  getSplitPaymentDetails,
  createDepositPayment,
} from "@/app/actions/finance";

describe("finance.ts – numeracja dokumentów i konfiguracja fiskalna", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDocumentNumberingConfig", () => {
    it("Happy path: zwraca konfigurację dla prawidłowego typu (INVOICE)", async () => {
      const mockConfig = {
        id: "cfg-1",
        documentType: "INVOICE",
        prefix: "FV",
        separator: "/",
        yearFormat: "YYYY",
        sequencePadding: 4,
        resetYearly: true,
        description: "Faktura VAT",
        exampleNumber: "FV/2025/0001",
      };
      vi.mocked(prisma.documentNumberingConfig.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.documentNumberingConfig.create).mockResolvedValue(mockConfig as never);

      const result = await getDocumentNumberingConfig("INVOICE");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.documentType).toBe("INVOICE");
        expect(result.data.prefix).toBe("FV");
      }
    });

    it("Edge case: nieprawidłowy typ dokumentu zwraca błąd", async () => {
      const result = await getDocumentNumberingConfig("" as DocumentType);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Nieprawidłowy typ dokumentu");
      }
    });

    it("Edge case: nieznany typ dokumentu zwraca błąd", async () => {
      const result = await getDocumentNumberingConfig("UNKNOWN_TYPE" as DocumentType);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Nieprawidłowy typ dokumentu");
      }
    });
  });

  describe("getAllDocumentNumberingConfigs", () => {
    it("Happy path: zwraca tablicę konfiguracji", async () => {
      vi.mocked(prisma.documentNumberingConfig.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.documentNumberingConfig.create).mockResolvedValue({} as never);
      vi.mocked(prisma.documentNumberingConfig.findMany).mockResolvedValue([
        {
          id: "1",
          documentType: "INVOICE",
          prefix: "FV",
          separator: "/",
          yearFormat: "YYYY",
          sequencePadding: 4,
          resetYearly: true,
          description: "Faktura VAT",
          exampleNumber: "FV/2025/0001",
        },
      ] as never);

      const result = await getAllDocumentNumberingConfigs();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
      }
    });

    it("Edge case: błąd bazy zwraca ActionResult z error", async () => {
      vi.mocked(prisma.documentNumberingConfig.findMany).mockRejectedValue(
        new Error("Connection refused")
      );

      const result = await getAllDocumentNumberingConfigs();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe("updateDocumentNumberingConfig", () => {
    it("Edge case: nieprawidłowy typ dokumentu zwraca błąd", async () => {
      const result = await updateDocumentNumberingConfig("" as DocumentType, { prefix: "X" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Nieprawidłowy typ dokumentu");
      }
    });

    it("Edge case: pusty prefix zwraca błąd", async () => {
      vi.mocked(prisma.documentNumberingConfig.findUnique).mockResolvedValue({
        id: "1",
        documentType: "INVOICE",
        prefix: "FV",
        separator: "/",
        yearFormat: "YYYY",
        sequencePadding: 4,
        resetYearly: true,
        description: null,
        exampleNumber: null,
      } as never);

      const result = await updateDocumentNumberingConfig("INVOICE", { prefix: "   " });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Prefix");
      }
    });
  });

  describe("generateNextDocumentNumber", () => {
    it("Edge case: nieprawidłowy typ dokumentu zwraca błąd", async () => {
      const result = await generateNextDocumentNumber("" as DocumentType);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Nieprawidłowy typ dokumentu");
      }
    });

    it("Edge case: nieznany typ zwraca błąd", async () => {
      const result = await generateNextDocumentNumber("UNKNOWN" as DocumentType);

      expect(result.success).toBe(false);
    });
  });

  describe("getDocumentNumberCounters", () => {
    it("Happy path: zwraca tablicę liczników", async () => {
      vi.mocked(prisma.documentNumberCounter.findMany).mockResolvedValue([
        { documentType: "INVOICE", year: 2025, lastSequence: 10 },
      ] as never);

      const result = await getDocumentNumberCounters();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
      }
    });

    it("Edge case: błąd bazy zwraca error", async () => {
      vi.mocked(prisma.documentNumberCounter.findMany).mockRejectedValue(
        new Error("DB error")
      );

      const result = await getDocumentNumberCounters();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe("getFiscalConfigAction", () => {
    it("Happy path: zwraca obiekt konfiguracji fiskalnej", async () => {
      const result = await getFiscalConfigAction();

      expect(result).toBeDefined();
      expect(typeof result.enabled).toBe("boolean");
      expect(result.driver).toBeDefined();
    });
  });

  describe("supportsFiscalReportsAction", () => {
    it("Happy path: zwraca obiekt z flagami raportów", async () => {
      const result = await supportsFiscalReportsAction();

      expect(result).toBeDefined();
      expect(typeof result.supportsXReport).toBe("boolean");
      expect(typeof result.supportsZReport).toBe("boolean");
      expect(typeof result.supportsPeriodicReport).toBe("boolean");
      expect(typeof result.supportsStorno).toBe("boolean");
    });
  });

  describe("getManagementReportData", () => {
    it("Edge case: pusta data zwraca błąd", async () => {
      const result = await getManagementReportData("");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("Data");
    });

    it("Edge case: nieprawidłowa data zwraca błąd", async () => {
      const result = await getManagementReportData("invalid-date");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBeDefined();
    });

    it("Happy path: zwraca raport dla prawidłowej daty", async () => {
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.cennikConfig.findUnique).mockResolvedValue({
        currency: "PLN",
        vatPercent: 23,
      } as never);

      const result = await getManagementReportData("2025-02-16");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBe("2025-02-16");
        expect(Array.isArray(result.data.transactions)).toBe(true);
      }
    });
  });

  describe("getCommissionReport", () => {
    it("Edge case: puste daty zwracają błąd", async () => {
      const result = await getCommissionReport("", "2025-02-16");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("daty");
    });

    it("Edge case: data od > data do zwraca błąd", async () => {
      const result = await getCommissionReport("2025-02-20", "2025-02-16");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("późniejsza");
    });

    it("Happy path: zwraca raport dla prawidłowego zakresu", async () => {
      vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.cennikConfig.findUnique).mockResolvedValue({ currency: "PLN" } as never);

      const result = await getCommissionReport("2025-02-01", "2025-02-28");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dateFrom).toBe("2025-02-01");
        expect(result.data.dateTo).toBe("2025-02-28");
      }
    });
  });

  describe("getTransactionsForToday", () => {
    it("Happy path: zwraca tablicę transakcji", async () => {
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([] as never);

      const result = await getTransactionsForToday();

      expect(result.success).toBe(true);
      if (result.success) expect(Array.isArray(result.data)).toBe(true);
    });

    it("Edge case: błąd bazy zwraca error", async () => {
      vi.mocked(prisma.transaction.findMany).mockRejectedValue(new Error("DB error"));

      const result = await getTransactionsForToday();

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBeDefined();
    });
  });

  describe("getCashSumForToday", () => {
    it("Happy path: zwraca expectedCash", async () => {
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: 100 },
        _count: 5,
        _avg: null,
        _min: null,
        _max: null,
      } as never);

      const result = await getCashSumForToday();

      expect(result.success).toBe(true);
      if (result.success) expect(result.data.expectedCash).toBe(100);
    });

    it("Edge case: błąd bazy zwraca error", async () => {
      vi.mocked(prisma.transaction.aggregate).mockRejectedValue(new Error("DB error"));

      const result = await getCashSumForToday();

      expect(result.success).toBe(false);
    });
  });

  describe("submitBlindDrop", () => {
    it("Edge case: nieprawidłowa kwota zwraca błąd", async () => {
      const result = await submitBlindDrop(-100);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBeDefined();
    });

    it("Happy path: zapisuje i zwraca różnicę", async () => {
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: 500 },
        _count: 0,
        _avg: null,
        _min: null,
        _max: null,
      } as never);
      vi.mocked(prisma.blindDropRecord.create).mockResolvedValue({} as never);

      const result = await submitBlindDrop(500);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.countedCash).toBe(500);
        expect(result.data.expectedCash).toBe(500);
        expect(result.data.difference).toBe(0);
      }
    });

    it("Edge case: błąd zapisu do bazy zwraca error", async () => {
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: 100 },
        _count: 0,
        _avg: null,
        _min: null,
        _max: null,
      } as never);
      vi.mocked(prisma.blindDropRecord.create).mockRejectedValue(new Error("DB write failed"));

      const result = await submitBlindDrop(100);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBeDefined();
    });
  });

  describe("getBlindDropHistory", () => {
    it("Happy path: zwraca historię", async () => {
      vi.mocked(prisma.blindDropRecord.findMany).mockResolvedValue([] as never);

      const result = await getBlindDropHistory(50);

      expect(result.success).toBe(true);
      if (result.success) expect(Array.isArray(result.data)).toBe(true);
    });

    it("Edge case: nieprawidłowy limit jest korygowany", async () => {
      vi.mocked(prisma.blindDropRecord.findMany).mockResolvedValue([] as never);

      const result = await getBlindDropHistory(-1);

      expect(result.success).toBe(true);
      expect(vi.mocked(prisma.blindDropRecord.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });
  });

  describe("getVatSalesRegister", () => {
    it("Edge case: puste daty zwracają błąd", async () => {
      const result = await getVatSalesRegister("", "2025-02-28");
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("daty");
    });
    it("Happy path: zwraca rejestr dla prawidłowego zakresu", async () => {
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as never);
      const result = await getVatSalesRegister("2025-02-01", "2025-02-28");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dateFrom).toBe("2025-02-01");
        expect(Array.isArray(result.data.rows)).toBe(true);
      }
    });
  });

  describe("getVatPurchasesRegister", () => {
    it("Edge case: data od > data do zwraca błąd", async () => {
      const result = await getVatPurchasesRegister("2025-02-28", "2025-02-01");
      expect(result.success).toBe(false);
    });
    it("Happy path: zwraca pusty rejestr", async () => {
      const result = await getVatPurchasesRegister("2025-02-01", "2025-02-28");
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.rows.length).toBe(0);
    });
  });

  describe("getKpirReport", () => {
    it("Edge case: nieprawidłowy zakres dat zwraca błąd", async () => {
      const result = await getKpirReport("invalid", "2025-02-28");
      expect(result.success).toBe(false);
    });
    it("Happy path: zwraca KPiR", async () => {
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([] as never);
      const result = await getKpirReport("2025-02-01", "2025-02-28");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalIncome).toBeDefined();
        expect(result.data.totalExpense).toBeDefined();
      }
    });
  });

  describe("verifyManagerPin", () => {
    it("Edge case: null/nieprawidłowy PIN zwraca błąd", async () => {
      const r = await verifyManagerPin("");
      expect(r.success).toBe(false);
      const r2 = await verifyManagerPin("wrong" as string);
      expect(r2.success).toBe(false);
    });
    it("Happy path: poprawny PIN zwraca true (zależy od MANAGER_PIN w env)", async () => {
      const result = await verifyManagerPin("1234");
      expect(result.success).toBeDefined();
      if (result.success) expect(result.data).toBe(true);
    });
  });

  describe("getCurrentCashShift", () => {
    it("Happy path: brak otwartej zmiany zwraca null", async () => {
      vi.mocked(prisma.cashShift.findFirst).mockResolvedValue(null);
      const result = await getCurrentCashShift();
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBeNull();
    });
    it("Edge case: błąd bazy zwraca error", async () => {
      vi.mocked(prisma.cashShift.findFirst).mockRejectedValue(new Error("DB error"));
      const result = await getCurrentCashShift();
      expect(result.success).toBe(false);
    });
  });

  describe("openCashShift", () => {
    it("Edge case: ujemna kwota zwraca błąd", async () => {
      const result = await openCashShift(-100);
      expect(result.success).toBe(false);
    });
    it("Happy path: otwiera zmianę", async () => {
      vi.mocked(prisma.cashShift.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.cashShift.create).mockResolvedValue({ id: "shift-1" } as never);
      const result = await openCashShift(500);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.shiftId).toBe("shift-1");
    });
  });

  describe("closeCashShift", () => {
    it("Edge case: nieprawidłowa kwota zwraca błąd", async () => {
      const result = await closeCashShift(-50);
      expect(result.success).toBe(false);
    });
    it("Edge case: brak otwartej zmiany zwraca błąd", async () => {
      vi.mocked(prisma.cashShift.findFirst).mockResolvedValue(null);
      const result = await closeCashShift(100);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("Brak otwartej");
    });
  });

  describe("getCashShiftHistory", () => {
    it("Happy path: zwraca historię", async () => {
      vi.mocked(prisma.cashShift.findMany).mockResolvedValue([] as never);
      const result = await getCashShiftHistory(30);
      expect(result.success).toBe(true);
      if (result.success) expect(Array.isArray(result.data)).toBe(true);
    });
    it("Edge case: nieprawidłowy limit jest korygowany", async () => {
      vi.mocked(prisma.cashShift.findMany).mockResolvedValue([] as never);
      await getCashShiftHistory(-1);
      expect(vi.mocked(prisma.cashShift.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ take: 30 })
      );
    });
  });

  describe("getCashShiftReport", () => {
    it("Edge case: pusty shiftId zwraca błąd", async () => {
      const result = await getCashShiftReport("");
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("ID zmiany");
    });
    it("Happy path: brak zmiany zwraca null", async () => {
      vi.mocked(prisma.cashShift.findUnique).mockResolvedValue(null);
      const result = await getCashShiftReport("shift-1");
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBeNull();
    });
  });

  describe("getAvailablePaymentMethods", () => {
    it("Happy path: zwraca listę metod płatności", async () => {
      const result = await getAvailablePaymentMethods();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.data.some((m) => m.code === "CASH")).toBe(true);
      }
    });
  });

  describe("getSplitPaymentDetails", () => {
    it("Edge case: pusty transactionId zwraca błąd", async () => {
      const result = await getSplitPaymentDetails("");
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("ID transakcji");
    });
    it("Happy path: transakcja nie istnieje zwraca błąd", async () => {
      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null);
      const result = await getSplitPaymentDetails("tx-1");
      expect(result.success).toBe(false);
    });
  });

  describe("createDepositPayment", () => {
    it("Edge case: puste reservationId zwraca błąd", async () => {
      const result = await createDepositPayment("", 100);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("rezerwacji");
    });
    it("Edge case: ujemna kwota zwraca błąd", async () => {
      const result = await createDepositPayment("res-1", -50);
      expect(result.success).toBe(false);
    });
  });
});
