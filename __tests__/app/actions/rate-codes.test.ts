/**
 * Testy jednostkowe dla app/actions/rate-codes.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    rateCode: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/config-snapshot", () => ({
  autoExportConfigSnapshot: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { getRateCodes, createRateCode, updateRateCode, deleteRateCode } from "@/app/actions/rate-codes";
import { computeRateCodePricePerNight } from "@/lib/rate-code-utils";

describe("rate-codes.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("computeRateCodePricePerNight", () => {
    it("wzór STAŁY: 185 + 50×3 = 335", () => {
      const result = computeRateCodePricePerNight(
        { basePrice: 185, pricePerPerson: 50 },
        3
      );
      expect(result).toBe(335);
    });

    it("stała cena 285", () => {
      const result = computeRateCodePricePerNight({ price: 285 }, 4);
      expect(result).toBe(285);
    });
  });

  describe("createRateCode", () => {
    it("tworzy kod ze wzorem (basePrice + pricePerPerson)", async () => {
      const created = {
        id: "rc-1",
        code: "STALY",
        name: "Gość stały",
        price: null,
        basePrice: 185,
        pricePerPerson: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.rateCode.create).mockResolvedValue(created as never);

      const result = await createRateCode({
        code: "STALY",
        name: "Gość stały",
        basePrice: 185,
        pricePerPerson: 50,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe("STALY");
        expect(result.data.basePrice).toBe(185);
        expect(result.data.pricePerPerson).toBe(50);
      }
    });

    it("tworzy kod ze stałą ceną", async () => {
      const created = {
        id: "rc-2",
        code: "BB",
        name: "Śniadanie",
        price: 40,
        basePrice: null,
        pricePerPerson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.rateCode.create).mockResolvedValue(created as never);

      const result = await createRateCode({
        code: "BB",
        name: "Śniadanie",
        price: 40,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.price).toBe(40);
      }
    });

    it("walidacja: brak kodu zwraca błąd", async () => {
      const result = await createRateCode({
        code: "",
        name: "Test",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("Kod");
    });

    it("walidacja: ujemna basePrice zwraca błąd", async () => {
      const result = await createRateCode({
        code: "X",
        name: "Test",
        basePrice: -10,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("bazowa");
    });
  });

  describe("getRateCodes", () => {
    it("zwraca listę z basePrice i pricePerPerson", async () => {
      vi.mocked(prisma.rateCode.findMany).mockResolvedValue([
        {
          id: "rc-1",
          code: "STALY",
          name: "Gość stały",
          price: null,
          basePrice: 185,
          pricePerPerson: 50,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as never);

      const result = await getRateCodes();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].basePrice).toBe(185);
        expect(result.data[0].pricePerPerson).toBe(50);
      }
    });
  });

  describe("updateRateCode", () => {
    it("aktualizuje basePrice i pricePerPerson", async () => {
      const updated = {
        id: "rc-1",
        code: "STALY",
        name: "Gość stały",
        price: null,
        basePrice: 195,
        pricePerPerson: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.rateCode.update).mockResolvedValue(updated as never);

      const result = await updateRateCode("rc-1", {
        basePrice: 195,
        pricePerPerson: 50,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.basePrice).toBe(195);
      }
    });
  });

  describe("deleteRateCode", () => {
    it("usuwa kod stawki", async () => {
      vi.mocked(prisma.rateCode.delete).mockResolvedValue({} as never);

      const result = await deleteRateCode("rc-1");

      expect(result.success).toBe(true);
      expect(prisma.rateCode.delete).toHaveBeenCalledWith({ where: { id: "rc-1" } });
    });
  });
});
