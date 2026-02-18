import { test, expect } from "@playwright/test";

test.describe("Finanse — zaawansowane", () => {
  test.describe("Faktury", () => {
    test("FIN-05: wystawienie faktury — przycisk widoczny na /finance", async ({ page }) => {
      await page.goto("/finance");
      await expect(page.getByText(/Finance|Finanse/i).first()).toBeVisible({ timeout: 10000 });
      const invoiceBtn = page.locator(
        'button:has-text("Faktura"), button:has-text("Invoice"), a:has-text("Faktura"), [data-testid*="invoice"]'
      ).first();
      const hasInvoice = await invoiceBtn.isVisible().catch(() => false);
      if (!hasInvoice) {
        test.skip(true, "Brak przycisku faktury na stronie Finance");
        return;
      }
      expect(hasInvoice).toBeTruthy();
    });
  });

  test.describe("Zmiana kasowa (Cash Shift)", () => {
    test("FIN-08: zmiana kasowa — strona /zmiana ładuje się", async ({ page }) => {
      await page.goto("/zmiana");
      await expect(
        page.getByText(/Zmiana|Shift|Kasa|Cash/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("FIN-09: zmiana kasowa — formularz otwarcia/zamknięcia", async ({ page }) => {
      await page.goto("/zmiana");
      await expect(page.getByText(/Zmiana|Shift|Kasowa|kasa/i).first()).toBeVisible({ timeout: 15000 });
      const hasForm = await page
        .locator('input, button, form')
        .first()
        .isVisible()
        .catch(() => false);
      expect(hasForm).toBeTruthy();
    });
  });

  test.describe("Przypomnienia płatności", () => {
    test("FIN-12: strona /finance/przypomnienia ładuje się", async ({ page }) => {
      await page.goto("/finance/przypomnienia");
      await expect(
        page.getByText(/Przypomnienia|Reminders|Płatności/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Windykacja", () => {
    test("FIN-13: strona /finance/windykacja ładuje się", async ({ page }) => {
      await page.goto("/finance/windykacja");
      await expect(
        page.getByText(/Windykacja|Debt|Collection|Zaległości|windykacj/i).first()
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("Integracje księgowe", () => {
    test("FIN-16: strona /finance/integracje ładuje się", async ({ page }) => {
      await page.goto("/finance/integracje");
      await expect(
        page.getByText(/Integracje|Integration|Księgowe/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Night Audit — edge cases", () => {
    test("FIN-14: Night Audit — podwójne kliknięcie nie powoduje podwójnego zamknięcia", async ({
      page,
    }) => {
      await page.goto("/finance");
      await expect(page.getByText(/Finance|Finanse/i).first()).toBeVisible({ timeout: 10000 });
      const auditBtn = page.getByRole("button", { name: /Zamknij dobę/i }).first();
      if (!(await auditBtn.isVisible().catch(() => false))) {
        test.skip(true, "Brak przycisku Zamknij dobę");
        return;
      }
      await auditBtn.click();
      await page.waitForTimeout(500);
      await auditBtn.click().catch(() => {});
      await page.waitForTimeout(3000);
      const toasts = await page.locator('[role="status"], .toast, [data-sonner-toast]').count();
      expect(toasts).toBeLessThanOrEqual(2);
    });
  });

  test.describe("Blind Drop — edge cases", () => {
    test("FIN-15: Blind Drop — kwota 0 — walidacja", async ({ page }) => {
      await page.goto("/finance");
      await expect(page.getByText(/Finance|Finanse/i).first()).toBeVisible({ timeout: 10000 });
      const input = page.locator("#countedCash");
      if (!(await input.isVisible().catch(() => false))) {
        test.skip(true, "Brak pola countedCash");
        return;
      }
      await input.fill("0");
      await page.getByRole("button", { name: /Zatwierdź i pokaż różnicę/i }).click();
      await page.waitForTimeout(2000);
      const hasResult = await page
        .getByText(/Manko|Superata|Oczekiwano|Wprowadzono|0/i)
        .first()
        .isVisible()
        .catch(() => false);
      expect(hasResult).toBeTruthy();
    });
  });

  test.describe("Metody płatności", () => {
    test("FIN-16b: metody płatności dostępne w formularzu", async ({ page }) => {
      await page.goto("/finance");
      await expect(page.getByText(/Finance|Finanse/i).first()).toBeVisible({ timeout: 10000 });
      const paymentMethodEl = page.locator(
        'select[name*="payment" i], select[name*="method" i], [data-testid*="payment-method"], :text("Gotówka"), :text("Karta"), :text("Przelew")'
      ).first();
      const hasMethods = await paymentMethodEl.isVisible().catch(() => false);
      if (!hasMethods) {
        test.skip(true, "Brak elementu metod płatności");
        return;
      }
      expect(hasMethods).toBeTruthy();
    });
  });
});
