import { test, expect } from "@playwright/test";
import { parseMRZ } from "../lib/mrz";

/**
 * CI-GAP-03 [Gap 2.3] Unit: Parsowanie MRZ – 3-liniowy (dowód TD1) i 2-liniowy (paszport TD3).
 */

test.describe("parseMRZ – Unit (Gap 2.3)", () => {
  test("3-liniowy TD1 (dowód) – nazwisko z linii 3", () => {
    const mrz =
      "IDPOL12345678<<<<<<<<<<<<<<<\n8001012M2501015POL<<<<<<<<<<<<<6\nKOWALSKI<<JAN<<<<<<<<<<<<<<<<<<";
    const r = parseMRZ(mrz);
    expect(r).not.toBeNull();
    expect(r!.surname).toBe("KOWALSKI");
    expect(r!.givenNames).toBe("JAN");
  });

  test("2-liniowy TD3 (paszport) – nazwisko z linii 1, znaki 6–44", () => {
    const mrz =
      "P<POLNOWAK<<ANNA<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\nAB1234567<9POL8001012F2501015<<<<<<<<<<<<06";
    const r = parseMRZ(mrz);
    expect(r).not.toBeNull();
    expect(r!.surname).toBe("NOWAK");
    expect(r!.givenNames).toBe("ANNA");
  });

  test("1-liniowy fallback – Surname<<Given", () => {
    const r = parseMRZ("IDPOLKOWALSKI<<JAN<<<<<<<<<<<<<<<<<<<<<<<");
    expect(r).not.toBeNull();
    expect(r!.surname).toBe("IDPOLKOWALSKI");
    expect(r!.givenNames).toBe("JAN");
  });

  test("pusty MRZ zwraca null", () => {
    expect(parseMRZ("")).toBeNull();
    expect(parseMRZ("   ")).toBeNull();
  });
});
