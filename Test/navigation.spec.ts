import { test, expect } from "@playwright/test";

test.describe("Nawigacja – Sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("sidebar zawiera linki: Dashboard, Front Office, Meldunek, Housekeeping, Finance, Reports", async ({
    page,
  }) => {
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Front Office" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Meldunek" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Housekeeping" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Finance" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reports" })).toBeVisible();
  });

  test("klik Front Office prowadzi do /front-office", async ({ page }) => {
    await page.getByRole("link", { name: "Front Office" }).click();
    await expect(page).toHaveURL(/\/front-office/);
    await expect(page.getByRole("heading", { name: /Tape Chart/i })).toBeVisible();
  });

  test("klik Meldunek prowadzi do /check-in", async ({ page }) => {
    await page.getByRole("link", { name: "Meldunek" }).click();
    await expect(page).toHaveURL(/\/check-in/);
    await expect(page.getByRole("heading", { name: /Meldunek gościa/i })).toBeVisible();
  });

  test("klik Finance prowadzi do /finance", async ({ page }) => {
    await page.getByRole("link", { name: "Finance" }).click();
    await expect(page).toHaveURL(/\/finance/);
    await expect(page.getByText("Finance", { exact: false }).first()).toBeVisible();
  });

  test("klik Housekeeping prowadzi do /housekeeping", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Housekeeping" })).toBeVisible();
    await page.getByRole("link", { name: "Housekeeping" }).click();
    await expect(page).toHaveURL(/\/housekeeping/);
  });

  test("NAV-02: klik Reports prowadzi do /reports", async ({ page }) => {
    await page.getByRole("link", { name: "Reports" }).click();
    await expect(page).toHaveURL(/\/reports/);
    await expect(page.getByRole("heading", { name: "Raporty" })).toBeVisible({ timeout: 5000 });
  });

  test("NAV-03: aktywny link w sidebarze ma wyróżniony styl (active state)", async ({ page }) => {
    await page.goto("/");
    const dashboardLink = page.getByRole("link", { name: "Dashboard" });
    await expect(dashboardLink).toHaveClass(/bg-primary|text-primary-foreground/);
    await page.getByRole("link", { name: "Front Office" }).click();
    await expect(page).toHaveURL(/\/front-office/);
    const frontOfficeLink = page.getByRole("link", { name: "Front Office" });
    await expect(frontOfficeLink).toHaveClass(/bg-primary|text-primary-foreground/);
  });
});
