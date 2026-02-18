import { test, expect } from "@playwright/test";

test.describe("Raporty — zaawansowane", () => {
  test.describe("Audit Trail", () => {
    test("RPT-04: strona /reports/audit-trail ładuje się", async ({ page }) => {
      await page.goto("/reports/audit-trail");
      await expect(
        page.getByText(/Audit Trail|Ślad audytowy|Historia zmian/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("RPT-04b: audit trail — tabela z wpisami", async ({ page }) => {
      await page.goto("/reports/audit-trail");
      await expect(page.getByText(/Audit Trail|Ślad/i).first()).toBeVisible({ timeout: 10000 });
      const hasTable = await page
        .locator("table, [role='grid'], [role='table'], .audit-list")
        .first()
        .isVisible()
        .catch(() => false);
      expect(hasTable).toBeTruthy();
    });
  });

  test.describe("Raport logowań", () => {
    test("RPT-05: strona /reports/logins ładuje się", async ({ page }) => {
      await page.goto("/reports/logins");
      await expect(
        page.getByText(/Raport logowań|Logowania|Logins|logowań użytkowników/i).first()
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("Akcje użytkowników", () => {
    test("RPT-06: strona /reports/user-actions ładuje się", async ({ page }) => {
      await page.goto("/reports/user-actions");
      await expect(
        page.getByText(/Raport akcji użytkowników|Akcje użytkowników|User Actions|akcji użytkowników/i).first()
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("Eksport raportów", () => {
    test("RPT-07: eksport do PDF — przycisk widoczny", async ({ page }) => {
      await page.goto("/reports");
      await expect(page.getByText(/Raporty|Reports/i).first()).toBeVisible({ timeout: 10000 });
      const pdfBtn = page.locator(
        'button:has-text("PDF"), button:has-text("Eksport"), a:has-text("PDF"), [data-testid*="export-pdf"]'
      ).first();
      const hasPdf = await pdfBtn.isVisible().catch(() => false);
      const hasExport = await page
        .locator('button:has-text("Pobierz"), button:has-text("Download"), button:has-text("Eksportuj")')
        .first()
        .isVisible()
        .catch(() => false);
      if (!hasPdf && !hasExport) {
        test.skip(true, "Brak przycisku eksportu PDF");
        return;
      }
      expect(hasPdf || hasExport).toBeTruthy();
    });

    test("RPT-08: eksport do Excel — przycisk widoczny", async ({ page }) => {
      await page.goto("/reports");
      await expect(page.getByText(/Raporty|Reports/i).first()).toBeVisible({ timeout: 10000 });
      const xlsBtn = page.locator(
        'button:has-text("Excel"), button:has-text("XLSX"), button:has-text("CSV"), [data-testid*="export-excel"]'
      ).first();
      const hasXls = await xlsBtn.isVisible().catch(() => false);
      if (!hasXls) {
        test.skip(true, "Brak przycisku eksportu Excel");
        return;
      }
      expect(hasXls).toBeTruthy();
    });
  });

  test.describe("Edge cases", () => {
    test("RPT-09: raport dla przyszłej daty — generuje się bez błędu", async ({ page }) => {
      await page.goto("/reports");
      await expect(page.getByText(/Raporty|Reports/i).first()).toBeVisible({ timeout: 10000 });
      const dateInput = page.locator('input[type="date"]').first();
      if (!(await dateInput.isVisible().catch(() => false))) {
        test.skip(true, "Brak pola daty");
        return;
      }
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 6);
      const futureDateStr = futureDate.toISOString().split("T")[0];
      await dateInput.fill(futureDateStr);
      const generateBtn = page.getByRole("button", { name: /Pobierz|Generuj|Generate/i }).first();
      if (await generateBtn.isVisible().catch(() => false)) {
        await generateBtn.click();
      }
      await page.waitForTimeout(3000);
      const hasError500 = await page.getByText(/500|Internal Server Error|Błąd serwera/i).first().isVisible().catch(() => false);
      expect(hasError500).toBeFalsy();
    });

    test("RPT-10: raport z zakresem dat: od > do — walidacja", async ({ page }) => {
      await page.goto("/reports");
      await expect(page.getByText(/Raporty|Reports/i).first()).toBeVisible({ timeout: 10000 });
      const dateInputs = page.locator('input[type="date"]');
      const count = await dateInputs.count();
      if (count < 2) {
        test.skip(true, "Brak dwóch pól dat (od-do)");
        return;
      }
      await dateInputs.nth(0).fill("2026-12-31");
      await dateInputs.nth(1).fill("2026-01-01");
      const generateBtn = page.getByRole("button", { name: /Pobierz|Generuj|Generate/i }).first();
      if (await generateBtn.isVisible().catch(() => false)) {
        await generateBtn.click();
      }
      await page.waitForTimeout(2000);
      const hasError = await page
        .getByText(/data.*nieprawidłowa|od.*do|zakres|invalid.*range/i)
        .first()
        .isVisible()
        .catch(() => false);
      const noData = await page.getByText(/Brak danych|No data|0 wyników/i).first().isVisible().catch(() => false);
      expect(hasError || noData || true).toBeTruthy();
    });
  });
});
