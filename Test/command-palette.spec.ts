import { test, expect } from "@playwright/test";

test.describe("Command Palette (Ctrl+K / Cmd+K)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("skrót Ctrl+K otwiera Command Palette", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(page.getByPlaceholder(/Szukaj gościa|pokoju|akcję/i)).toBeVisible();
  });

  test("skrót Cmd+K otwiera Command Palette (Mac)", async ({ page, browserName }) => {
    await page.keyboard.press("Meta+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });
  });

  test("Command Palette zawiera szybkie akcje – Grafik (Tape Chart)", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("option", { name: /Grafik|Tape Chart/i })).toBeVisible();
  });

  test("wybór Grafik (Tape Chart) przekierowuje na /front-office", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/front-office/, { timeout: 5000 });
  });
});
