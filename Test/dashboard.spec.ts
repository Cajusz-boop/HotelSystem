import { test, expect } from "@playwright/test";

/**
 * Master Test Plan: 4.2 Dashboard (DASH-01–06), NAV-09
 */
test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("DASH-01: nagłówek Dashboard i przycisk Otwórz grafik widoczne", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Centrum Dowodzenia|Dashboard/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Otwórz grafik|Tape Chart/i })
    ).toBeVisible();
  });

  test("DASH-02: sekcja VIP Arrival widoczna; jeśli brak danych – komunikat", async ({ page }) => {
    await expect(page.getByText(/VIP Arrival|dzisiaj|jutro/i)).toBeVisible();
    const hasList = await page.getByRole("listitem").filter({ hasText: /Pokój|·/ }).count() > 0;
    const hasEmpty = await page.getByText("Brak przyjazdów.").isVisible().catch(() => false);
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test("DASH-03: sekcja Pokoje do sprzątania widoczna; jeśli brak danych – komunikat", async ({ page }) => {
    await expect(page.getByText(/Pokoje do sprzątania|Dirty Rooms/i).first()).toBeVisible();
    const hasList = await page.getByText(/Pokój \d+/).first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText("Brak pokoi do sprzątania.").isVisible().catch(() => false);
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test("DASH-04: sekcja OOO widoczna; jeśli brak danych – komunikat", async ({ page }) => {
    await expect(page.getByText(/zgłoszenia OOO|Out of Order|OOO/i).first()).toBeVisible();
    const hasList = await page.getByText(/Pokój \d+/).first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText("Brak pokoi OOO.").isVisible().catch(() => false);
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test("DASH-06: klik Otwórz grafik prowadzi do /front-office", async ({ page }) => {
    await page.getByRole("link", { name: /Otwórz grafik/i }).click();
    await expect(page).toHaveURL(/\/front-office/);
    await expect(page.locator('[data-testid="room-row-101"], [data-testid*="room"], .tape-chart').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("NAV-09: Strona główna ładuje się", () => {
  test("Dashboard ładuje się bez błędu; widoczne sekcje VIP, Pokoje do sprzątania, OOO", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Centrum Dowodzenia|Dashboard/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/VIP|Przyjazdy VIP/i).first()).toBeVisible();
    await expect(page.getByText(/Pokoje do sprzątania|Dirty Rooms|sprzątania/i).first()).toBeVisible();
    await expect(page.getByText(/zgłoszenia OOO|OOO/i).first()).toBeVisible();
  });
});
