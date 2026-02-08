import { test, expect } from "@playwright/test";

/**
 * Master Test Plan: 4.2 Dashboard (DASH-01–06), NAV-09
 */
test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("DASH-01: nagłówek Dashboard i przycisk Otwórz Grafik widoczne", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Otwórz Grafik.*Tape Chart/i })
    ).toBeVisible();
  });

  test("DASH-02: sekcja VIP Arrival widoczna; jeśli brak danych – komunikat", async ({ page }) => {
    await expect(page.getByText(/VIP Arrival|dzisiaj|jutro/i)).toBeVisible();
    const hasList = await page.getByRole("listitem").filter({ hasText: /Pokój|·/ }).count() > 0;
    const hasEmpty = await page.getByText("Brak przyjazdów.").isVisible().catch(() => false);
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test("DASH-03: sekcja Dirty Rooms widoczna; jeśli brak danych – komunikat", async ({ page }) => {
    await expect(page.getByText(/Dirty Rooms/i)).toBeVisible();
    const hasList = await page.getByText(/Pokój \d+/).first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText("Brak pokoi do sprzątania.").isVisible().catch(() => false);
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test("DASH-04: sekcja OOO widoczna; jeśli brak danych – komunikat", async ({ page }) => {
    await expect(page.getByText(/Out of Order|OOO/i)).toBeVisible();
    const hasList = await page.getByText(/Pokój \d+/).first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText("Brak pokoi OOO.").isVisible().catch(() => false);
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test("DASH-06: klik Otwórz Grafik prowadzi do /front-office", async ({ page }) => {
    await page.getByRole("link", { name: /Otwórz Grafik/i }).click();
    await expect(page).toHaveURL(/\/front-office/);
    await expect(page.getByRole("heading", { name: /Tape Chart/i })).toBeVisible({ timeout: 5000 });
  });
});

test.describe("NAV-09: Strona główna ładuje się", () => {
  test("Dashboard ładuje się bez błędu; widoczne sekcje VIP Arrival, Dirty Rooms, OOO", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/VIP Arrival/i)).toBeVisible();
    await expect(page.getByText(/Dirty Rooms/i)).toBeVisible();
    await expect(page.getByText(/Out of Order|OOO/i)).toBeVisible();
  });
});
