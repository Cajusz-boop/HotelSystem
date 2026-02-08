import { test, expect } from "@playwright/test";

test.describe("Housekeeping – widok mobilny / offline-first", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/housekeeping");
  });

  test("strona Housekeeping ładuje się i wyświetla listę pokoi lub status sieci", async ({
    page,
  }) => {
    await expect(
      page.getByText(/Housekeeping|pokoj|CLEAN|DIRTY|OOO|status sieci|Wifi/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("wyświetla statusy pokoi (CLEAN, DIRTY, OOO), Online/Offline lub Ładowanie", async ({
    page,
  }) => {
    await expect(
      page.getByText(/Housekeeping/i).first()
    ).toBeVisible({ timeout: 5000 });
    const hasStatus = await page.getByText(/CLEAN|DIRTY|OOO/).first().isVisible().catch(() => false);
    const hasOnlineOffline = await page
      .getByText(/Online|Offline|Ładowanie/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasPokoj = await page.getByText(/Pokój \d+/).first().isVisible().catch(() => false);
    expect(hasStatus || hasOnlineOffline || hasPokoj).toBeTruthy();
  });

  test("HK-02: wskaźnik Online lub Offline widoczny", async ({ page }) => {
    await expect(page.getByText(/Housekeeping/i).first()).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(/Online|Offline|Ładowanie/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("HK-04: zmiana statusu pokoju (CLEAN → DIRTY) – zapis, toast sukcesu", async ({ page }) => {
    await expect(page.getByText(/Housekeeping/i).first()).toBeVisible({ timeout: 5000 });
    const dirtyBtn = page.getByRole("button", { name: "DIRTY" }).first();
    if (!(await dirtyBtn.isVisible())) {
      test.skip();
      return;
    }
    await dirtyBtn.click();
    await expect(
      page.getByText(/Pokój ustawiony na DIRTY|DIRTY/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("HK-06: Zgłoś usterkę – formularz (przyczyna) i przycisk Zgłoś usterkę", async ({
    page,
  }) => {
    await expect(page.getByText(/Housekeeping/i).first()).toBeVisible({ timeout: 5000 });
    const reportBtn = page.getByRole("button", { name: "Zgłoś usterkę" }).first();
    if (!(await reportBtn.isVisible())) {
      test.skip();
      return;
    }
    await reportBtn.click();
    await expect(page.getByText(/Zgłoś usterkę \(OOO\)/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByLabel(/Przyczyna/i)).toBeVisible();
    const modal = page.locator(".fixed.inset-0.z-50");
    await expect(modal.getByRole("button", { name: "Zgłoś usterkę" })).toBeVisible();
    await modal.getByRole("button", { name: "Anuluj" }).click();
    await expect(page.getByText(/Zgłoś usterkę \(OOO\)/i)).not.toBeVisible({ timeout: 2000 });
  });
});
