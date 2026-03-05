/**
 * Testy jednostkowe dla lib/rate-code-utils.ts
 * Wzór ceny: basePrice + pricePerPerson × pax
 */
import { describe, it, expect } from "vitest";
import { computeRateCodePricePerNight } from "@/lib/rate-code-utils";

describe("computeRateCodePricePerNight", () => {
  describe("wzór: basePrice + pricePerPerson × pax", () => {
    it("1 osoba: 185 + 50×1 = 235", () => {
      const result = computeRateCodePricePerNight(
        { basePrice: 185, pricePerPerson: 50 },
        1
      );
      expect(result).toBe(235);
    });

    it("2 osoby: 185 + 50×2 = 285", () => {
      const result = computeRateCodePricePerNight(
        { basePrice: 185, pricePerPerson: 50 },
        2
      );
      expect(result).toBe(285);
    });

    it("4 osoby: 185 + 50×4 = 385", () => {
      const result = computeRateCodePricePerNight(
        { basePrice: 185, pricePerPerson: 50 },
        4
      );
      expect(result).toBe(385);
    });

    it("5 osób: 185 + 50×5 = 435", () => {
      const result = computeRateCodePricePerNight(
        { basePrice: 185, pricePerPerson: 50 },
        5
      );
      expect(result).toBe(435);
    });

    it("Comfort z widokiem: 205 + 50×4 = 405", () => {
      const result = computeRateCodePricePerNight(
        { basePrice: 205, pricePerPerson: 50 },
        4
      );
      expect(result).toBe(405);
    });

    it("pax=0 → traktuje jak 1 (min)", () => {
      const result = computeRateCodePricePerNight(
        { basePrice: 185, pricePerPerson: 50 },
        0
      );
      expect(result).toBe(235);
    });
  });

  describe("stała cena (price)", () => {
    it("zwraca price gdy brak wzoru", () => {
      const result = computeRateCodePricePerNight({ price: 300 }, 2);
      expect(result).toBe(300);
    });

    it("zwraca price niezależnie od pax", () => {
      expect(computeRateCodePricePerNight({ price: 400 }, 1)).toBe(400);
      expect(computeRateCodePricePerNight({ price: 400 }, 5)).toBe(400);
    });
  });

  describe("priorytety", () => {
    it("wzór ma pierwszeństwo przed price gdy oba ustawione", () => {
      const result = computeRateCodePricePerNight(
        { price: 999, basePrice: 185, pricePerPerson: 50 },
        2
      );
      expect(result).toBe(285);
    });

    it("gdy tylko basePrice (bez pricePerPerson) → fallback do price", () => {
      const result = computeRateCodePricePerNight(
        { price: 250, basePrice: 185, pricePerPerson: null },
        2
      );
      expect(result).toBe(250);
    });

    it("gdy tylko pricePerPerson (bez basePrice) → fallback do price", () => {
      const result = computeRateCodePricePerNight(
        { price: 300, basePrice: null, pricePerPerson: 50 },
        2
      );
      expect(result).toBe(300);
    });
  });

  describe("edge cases", () => {
    it("pusty obiekt zwraca null", () => {
      expect(computeRateCodePricePerNight({}, 2)).toBeNull();
    });

    it("null/undefined w polach → null gdy brak wzoru i price", () => {
      expect(
        computeRateCodePricePerNight(
          { price: null, basePrice: null, pricePerPerson: null },
          2
        )
      ).toBeNull();
    });

    it("ujemny pax → traktuje jak 1", () => {
      const result = computeRateCodePricePerNight(
        { basePrice: 185, pricePerPerson: 50 },
        -1
      );
      expect(result).toBe(235);
    });
  });
});
