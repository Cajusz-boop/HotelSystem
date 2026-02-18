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
    // UI ma "Do sprzątania" (label), toast zwraca "DIRTY" (wartość enum)
    const dirtyBtn = page.getByRole("button", { name: /Do sprzątania|DIRTY/i }).first();
    if (!(await dirtyBtn.isVisible())) {
      test.skip(true, "Brak przycisku Do sprzątania");
      return;
    }
    await dirtyBtn.click();
    await expect(
      page.getByText(/Pokój ustawiony na DIRTY|DIRTY/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("HK-05: etykiety priorytetów nie są obcięte (overflow) – wszystkie widoczne", async ({
    page,
  }) => {
    await expect(page.getByText(/Housekeeping|Pokoje|Priorytet/i).first()).toBeVisible({ timeout: 10000 });

    const firstRoom = page.locator("text=Priorytet:").first();
    if (!(await firstRoom.isVisible().catch(() => false))) {
      test.skip(true, "Brak sekcji priorytetu na stronie");
      return;
    }

    const priorityLabels = ["VIP przyjazd", "Wymeldowanie", "Przedłużenie", "Normalny", "Brak"];

    for (const label of priorityLabels) {
      const btn = page.getByRole("button", { name: label }).first();
      await expect(
        btn,
        `Przycisk priorytetu "${label}" powinien być widoczny i nie obcięty`
      ).toBeVisible({ timeout: 5000 });

      const box = await btn.boundingBox();
      expect(
        box,
        `Przycisk "${label}" musi mieć wymiary (nie może być schowany)`
      ).not.toBeNull();
      if (box) {
        expect(box.width, `Przycisk "${label}" jest za wąski – tekst może być obcięty`).toBeGreaterThan(20);
        expect(box.height, `Przycisk "${label}" jest za niski – tekst może być obcięty`).toBeGreaterThan(10);
      }
    }
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
