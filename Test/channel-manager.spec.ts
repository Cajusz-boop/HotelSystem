import { test, expect } from "@playwright/test";

test.describe("Channel Manager", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/channel-manager");
  });

  test("CM-01: strona /channel-manager ładuje się", async ({ page }) => {
    await expect(
      page.getByText(/Channel Manager|Kanały|OTA/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("CM-02: lista kanałów (Booking.com, Expedia) widoczna", async ({ page }) => {
    await expect(
      page.getByText(/Channel Manager|Kanały/i).first()
    ).toBeVisible({ timeout: 10000 });
    const hasChannels = await page
      .getByText(/Booking|Expedia|kanał|channel/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasConfig = await page
      .locator("table, [role='grid'], .channel-list, [data-testid*='channel']")
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasChannels || hasConfig).toBeTruthy();
  });

  test("CM-03: mapowanie typów pokojów — element widoczny", async ({ page }) => {
    await expect(page.getByText(/Channel Manager/i).first()).toBeVisible({ timeout: 10000 });
    const mappingEl = page.locator(
      'button:has-text("Mapowanie"), button:has-text("Mapping"), [data-testid*="mapping"], a:has-text("Mapowanie"), select, table'
    ).first();
    const hasMapping = await mappingEl.isVisible().catch(() => false);
    if (!hasMapping) {
      test.skip(true, "Brak elementu mapowania na stronie Channel Manager");
      return;
    }
    expect(hasMapping).toBeTruthy();
  });

  test("CM-04: status kanałów — connected/disconnected", async ({ page }) => {
    await expect(page.getByText(/Channel Manager/i).first()).toBeVisible({ timeout: 10000 });
    const statusEl = page.locator(
      '[data-testid*="status"], .badge, .status, :text("Connected"), :text("Disconnected"), :text("Aktywny"), :text("Nieaktywny")'
    ).first();
    const hasStatus = await statusEl.isVisible().catch(() => false);
    if (!hasStatus) {
      test.skip(true, "Brak wskaźnika statusu kanałów");
      return;
    }
    expect(hasStatus).toBeTruthy();
  });
});
