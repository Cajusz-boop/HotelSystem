/**
 * Testy jednostkowe dla lib/reservation-display-amount.ts
 * Kwota rezerwacji do wyświetlenia (nocleg + posiłki, fallback gdy brak ROOM).
 */
import { describe, it, expect } from "vitest";
import {
  reservationDisplayAmount,
  sumChargeAmountFromTransactions,
  hasRoomCharge,
} from "@/lib/reservation-display-amount";

describe("reservationDisplayAmount", () => {
  const checkIn = new Date("2025-03-01T12:00:00");
  const checkOut = new Date("2025-03-03T10:00:00"); // 2 noce

  it("zwraca sumę transakcji gdy jest transakcja ROOM", () => {
    const res = {
      transactions: [
        { amount: 400, type: "ROOM" },
        { amount: 200, type: "RESTAURANT" },
      ],
      checkIn,
      checkOut,
    };
    expect(reservationDisplayAmount(res)).toBe(600);
  });

  it("zwraca nocleg + posiłki gdy brak ROOM, ale jest rateCodePrice", () => {
    const res = {
      transactions: [{ amount: 200, type: "RESTAURANT" }],
      rateCodePrice: 300,
      checkIn,
      checkOut,
    };
    // 200 (posiłki) + 300*2 (nocleg fallback: 2 noce × 300)
    expect(reservationDisplayAmount(res)).toBe(800);
  });

  it("zwraca tylko transakcje gdy brak ROOM i brak rateCodePrice", () => {
    const res = {
      transactions: [{ amount: 372, type: "RESTAURANT" }],
      checkIn,
      checkOut,
    };
    expect(reservationDisplayAmount(res)).toBe(372);
  });

  it("zwraca tylko transakcje gdy rateCodePrice = 0", () => {
    const res = {
      transactions: [{ amount: 100, type: "RESTAURANT" }],
      rateCodePrice: 0,
      checkIn,
      checkOut,
    };
    expect(reservationDisplayAmount(res)).toBe(100);
  });

  it("pomija transakcje płatności (PAYMENT, DEPOSIT, REFUND, VOID)", () => {
    const res = {
      transactions: [
        { amount: 500, type: "ROOM" },
        { amount: -500, type: "PAYMENT" },
      ],
      checkIn,
      checkOut,
    };
    expect(reservationDisplayAmount(res)).toBe(500);
  });

  it("zwraca 0 gdy brak transakcji", () => {
    const res = {
      transactions: [],
      rateCodePrice: 200,
      checkIn,
      checkOut,
    };
    expect(reservationDisplayAmount(res)).toBe(400); // 2 noce × 200
  });

  it("zwraca 0 gdy brak transakcji i brak rateCodePrice", () => {
    const res = {
      transactions: [],
      checkIn,
      checkOut,
    };
    expect(reservationDisplayAmount(res)).toBe(0);
  });

  it("liczy poprawnie 1 noc", () => {
    const res = {
      transactions: [],
      rateCodePrice: 150,
      checkIn: new Date("2025-03-01"),
      checkOut: new Date("2025-03-02"),
    };
    expect(reservationDisplayAmount(res)).toBe(150);
  });
});

describe("sumChargeAmountFromTransactions", () => {
  it("sumuje obciążenia, pomija płatności", () => {
    const tx = [
      { amount: 100, type: "ROOM" },
      { amount: 50, type: "RESTAURANT" },
      { amount: -150, type: "PAYMENT" },
    ];
    expect(sumChargeAmountFromTransactions(tx)).toBe(150);
  });

  it("zwraca 0 dla pustej tablicy", () => {
    expect(sumChargeAmountFromTransactions([])).toBe(0);
  });

  it("zwraca 0 dla undefined", () => {
    expect(sumChargeAmountFromTransactions(undefined)).toBe(0);
  });
});

describe("hasRoomCharge", () => {
  it("zwraca true gdy jest transakcja ROOM z amount > 0", () => {
    const tx = [{ amount: 200, type: "ROOM" }];
    expect(hasRoomCharge(tx)).toBe(true);
  });

  it("zwraca false gdy ROOM ma amount = 0", () => {
    const tx = [{ amount: 0, type: "ROOM" }];
    expect(hasRoomCharge(tx)).toBe(false);
  });

  it("zwraca false gdy brak ROOM", () => {
    const tx = [{ amount: 100, type: "RESTAURANT" }];
    expect(hasRoomCharge(tx)).toBe(false);
  });

  it("zwraca false dla pustej tablicy", () => {
    expect(hasRoomCharge([])).toBe(false);
  });
});
