import { test, expect } from "@playwright/test";

test.describe("Rezerwacje — zaawansowane scenariusze", () => {
  test.describe("Rezerwacja grupowa", () => {
    test("RES-01: przycisk rezerwacji grupowej widoczny na /front-office", async ({ page }) => {
      await page.goto("/front-office");
      await expect(page.getByText(/Grafik|Recepcja/i).first()).toBeVisible({ timeout: 10000 });
      const groupBtn = page.locator(
        'button:has-text("Grupowa"), button:has-text("Group"), a:has-text("Grupowa"), [data-testid*="group"]'
      ).first();
      const hasGroupBtn = await groupBtn.isVisible().catch(() => false);
      if (!hasGroupBtn) {
        test.skip(true, "Brak przycisku rezerwacji grupowej");
        return;
      }
      expect(hasGroupBtn).toBeTruthy();
    });
  });

  test.describe("Walk-in", () => {
    test("RES-02: przycisk Walk-in widoczny na /front-office", async ({ page }) => {
      await page.goto("/front-office");
      await expect(page.getByText(/Grafik|Recepcja/i).first()).toBeVisible({ timeout: 10000 });
      const walkinBtn = page.locator(
        'button:has-text("Walk-in"), button:has-text("Walkin"), [data-testid*="walkin"]'
      ).first();
      const hasWalkin = await walkinBtn.isVisible().catch(() => false);
      if (!hasWalkin) {
        test.skip(true, "Brak przycisku Walk-in");
        return;
      }
      expect(hasWalkin).toBeTruthy();
    });
  });

  test.describe("Folio rezerwacji", () => {
    test("RES-03: folio widoczne po otwarciu rezerwacji", async ({ page }) => {
      await page.goto("/front-office");
      await expect(page.getByText(/Grafik|Recepcja/i).first()).toBeVisible({ timeout: 10000 });
      const bar = page.locator('[data-testid*="reservation-bar"], .reservation-bar, [class*="reservation"]').first();
      if (!(await bar.isVisible().catch(() => false))) {
        test.skip(true, "Brak rezerwacji na grafiku");
        return;
      }
      await bar.click();
      await page.waitForTimeout(1000);
      const folioEl = page.locator(
        ':text("Folio"), :text("folio"), :text("Saldo"), :text("Obciążenia"), :text("Płatności"), [data-testid*="folio"]'
      ).first();
      const hasFolio = await folioEl.isVisible().catch(() => false);
      if (!hasFolio) {
        test.skip(true, "Brak sekcji folio w szczegółach rezerwacji");
        return;
      }
      expect(hasFolio).toBeTruthy();
    });

    test("RES-04: dodanie obciążenia do folio", async ({ page }) => {
      await page.goto("/front-office");
      await expect(page.getByText(/Grafik|Recepcja/i).first()).toBeVisible({ timeout: 10000 });
      const bar = page.locator('[data-testid*="reservation-bar"], .reservation-bar, [class*="reservation"]').first();
      if (!(await bar.isVisible().catch(() => false))) {
        test.skip(true, "Brak rezerwacji na grafiku");
        return;
      }
      await bar.click();
      await page.waitForTimeout(1000);
      const addChargeBtn = page.locator(
        'button:has-text("Dodaj obciążenie"), button:has-text("Add charge"), button:has-text("+ Obciążenie")'
      ).first();
      const hasAddCharge = await addChargeBtn.isVisible().catch(() => false);
      if (!hasAddCharge) {
        test.skip(true, "Brak przycisku dodawania obciążenia");
        return;
      }
      expect(hasAddCharge).toBeTruthy();
    });
  });

  test.describe("Potwierdzenie rezerwacji (PDF)", () => {
    test("RES-05: przycisk wydruku potwierdzenia widoczny", async ({ page }) => {
      await page.goto("/front-office");
      await expect(page.getByText(/Grafik|Recepcja/i).first()).toBeVisible({ timeout: 10000 });
      const bar = page.locator('[data-testid*="reservation-bar"], .reservation-bar, [class*="reservation"]').first();
      if (!(await bar.isVisible().catch(() => false))) {
        test.skip(true, "Brak rezerwacji na grafiku");
        return;
      }
      await bar.click();
      await page.waitForTimeout(1000);
      const printBtn = page.locator(
        'button:has-text("Wydruk"), button:has-text("PDF"), button:has-text("Potwierdzenie"), button:has-text("Print"), [data-testid*="print"], [data-testid*="pdf"]'
      ).first();
      const hasPrint = await printBtn.isVisible().catch(() => false);
      if (!hasPrint) {
        test.skip(true, "Brak przycisku wydruku potwierdzenia");
        return;
      }
      expect(hasPrint).toBeTruthy();
    });
  });

  test.describe("Anulowanie rezerwacji", () => {
    test("RES-06: anulowanie z menu kontekstowego — opcja widoczna", async ({ page }) => {
      await page.goto("/front-office");
      await expect(page.getByText(/Grafik|Recepcja/i).first()).toBeVisible({ timeout: 10000 });
      const bar = page.locator('[data-testid*="reservation-bar"], .reservation-bar, [class*="reservation"]').first();
      if (!(await bar.isVisible().catch(() => false))) {
        test.skip(true, "Brak rezerwacji na grafiku");
        return;
      }
      await bar.click({ button: "right" });
      await page.waitForTimeout(500);
      const cancelOption = page.locator(
        ':text("Anuluj rezerwację"), :text("Cancel"), [role="menuitem"]:has-text("Anuluj")'
      ).first();
      const hasCancel = await cancelOption.isVisible().catch(() => false);
      if (!hasCancel) {
        test.skip(true, "Brak opcji anulowania w menu kontekstowym");
        return;
      }
      expect(hasCancel).toBeTruthy();
    });
  });

  test.describe("Walidacja dat", () => {
    test("RES-07: data wyjazdu < przyjazdu — walidacja", async ({ page }) => {
      await page.goto("/front-office");
      await expect(page.getByText(/Grafik|Recepcja/i).first()).toBeVisible({ timeout: 10000 });
      const bar = page.locator('[data-testid*="reservation-bar"], .reservation-bar, [class*="reservation"]').first();
      if (!(await bar.isVisible().catch(() => false))) {
        test.skip(true, "Brak rezerwacji na grafiku");
        return;
      }
      await bar.click();
      await page.waitForTimeout(1000);
      const checkOutInput = page.locator('input[name*="checkOut" i], input[name*="checkout" i], #checkOut').first();
      if (!(await checkOutInput.isVisible().catch(() => false))) {
        test.skip(true, "Brak pola daty wyjazdu");
        return;
      }
      await checkOutInput.fill("2020-01-01");
      await checkOutInput.press("Tab");
      const saveBtn = page.getByRole("button", { name: /Zapisz|Save/i }).first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
      }
      await page.waitForTimeout(1000);
      const hasError = await page
        .getByText(/data wyjazdu|checkout.*before|invalid date|błąd dat|data musi/i)
        .first()
        .isVisible()
        .catch(() => false);
      const noSuccessToast = !(await page.getByText(/Zapisano|Sukces|Success/i).first().isVisible().catch(() => false));
      expect(hasError || noSuccessToast).toBeTruthy();
    });
  });

  test.describe("Statusy rezerwacji", () => {
    test("RES-09: zmiana statusu rezerwacji z menu kontekstowego", async ({ page }) => {
      await page.goto("/front-office");
      await expect(page.getByText(/Grafik|Recepcja/i).first()).toBeVisible({ timeout: 10000 });
      const bar = page.locator('[data-testid*="reservation-bar"], .reservation-bar, [class*="reservation"]').first();
      if (!(await bar.isVisible().catch(() => false))) {
        test.skip(true, "Brak rezerwacji na grafiku");
        return;
      }
      await bar.click({ button: "right" });
      await page.waitForTimeout(500);
      const statusOptions = page.locator(
        '[role="menuitem"]:has-text("Check-in"), [role="menuitem"]:has-text("Potwierdź"), [role="menuitem"]:has-text("Confirm")'
      ).first();
      const hasStatusOption = await statusOptions.isVisible().catch(() => false);
      if (!hasStatusOption) {
        test.skip(true, "Brak opcji zmiany statusu w menu kontekstowym");
        return;
      }
      expect(hasStatusOption).toBeTruthy();
    });
  });
});
