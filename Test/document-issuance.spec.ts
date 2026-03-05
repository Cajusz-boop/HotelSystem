import { test, expect } from "@playwright/test";

/**
 * Testy okna „Wystawić dokument?” – wszystkie możliwości:
 * - Kwota noclegu na paragonie/fakturze (override)
 * - Podział na fakturę i paragon (Kwota na fakturę, Kwota na paragon)
 * - Przycisk „Wystaw oba” (gdy suma = kwota do zapłaty)
 * - Faktura VAT (PDF)
 * - Paragon (kasa fiskalna POSNET)
 * - Bez dokumentu
 */
test.describe("Wystawić dokument – wszystkie możliwości", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test("DOC-01: przycisk Wystaw dokument otwiera menu", async ({ page }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible().catch(() => false))) {
      test.skip(true, "Brak rezerwacji na grafiku");
      return;
    }
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 3000 });

    const wystawBtn = page.getByRole("button", { name: /Wystaw dokument/i });
    await expect(wystawBtn).toBeVisible({ timeout: 3000 });
    await wystawBtn.click();

    await expect(page.getByText(/Faktura VAT|Paragon|Proforma/i)).toBeVisible({ timeout: 3000 });
  });

  test("DOC-02: wybór Faktura VAT otwiera dialog Wystawić dokument?", async ({ page }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible().catch(() => false))) {
      test.skip(true, "Brak rezerwacji na grafiku");
      return;
    }
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 3000 });

    const wystawBtn = page.getByRole("button", { name: /Wystaw dokument/i });
    await wystawBtn.click();
    const fakturaItem = page.getByRole("button", { name: /Faktura VAT/i }).first();
    await fakturaItem.click();

    await expect(page.getByText("Wystawić dokument?")).toBeVisible({ timeout: 3000 });
    await expect(
      page.getByLabel(/Kwota noclegu na paragonie\/fakturze/i)
    ).toBeVisible({ timeout: 2000 });
    await expect(page.getByText(/Kwota na fakturę|Podział na fakturę/i)).toBeVisible({
      timeout: 2000,
    });
  });

  test("DOC-03: dialog zawiera pola Podział – Kwota na fakturę i Kwota na paragon", async ({
    page,
  }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible().catch(() => false))) {
      test.skip(true, "Brak rezerwacji na grafiku");
      return;
    }
    await bar.click();
    const wystawBtn = page.getByRole("button", { name: /Wystaw dokument/i });
    await wystawBtn.click();
    await page.getByRole("button", { name: /Faktura VAT/i }).first().click();

    await expect(page.getByText("Wystawić dokument?")).toBeVisible({ timeout: 3000 });
    await expect(
      page.locator('input[placeholder="0"]').or(page.getByLabel(/Kwota na fakturę/i))
    ).toBeVisible({ timeout: 2000 });
    await expect(
      page.getByText(/Kwota na paragon|paragon \[PLN\]/i)
    ).toBeVisible({ timeout: 2000 });
  });

  test("DOC-04: dialog zawiera przyciski Faktura VAT, Paragon, Bez dokumentu", async ({
    page,
  }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible().catch(() => false))) {
      test.skip(true, "Brak rezerwacji na grafiku");
      return;
    }
    await bar.click();
    const wystawBtn = page.getByRole("button", { name: /Wystaw dokument/i });
    await wystawBtn.click();
    await page.getByRole("button", { name: /Faktura VAT/i }).first().click();

    await expect(page.getByText("Wystawić dokument?")).toBeVisible({ timeout: 3000 });
    await expect(
      page.getByRole("button", { name: /Faktura VAT \(PDF\).*drukuj/i })
    ).toBeVisible({ timeout: 2000 });
    await expect(
      page.getByRole("button", { name: /Paragon \(kasa fiskalna POSNET\)/i })
    ).toBeVisible({ timeout: 2000 });
    await expect(
      page.getByRole("button", { name: /Bez dokumentu/i })
    ).toBeVisible({ timeout: 2000 });
  });

  test("DOC-05: Bez dokumentu zamyka dialog", async ({ page }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible().catch(() => false))) {
      test.skip(true, "Brak rezerwacji na grafiku");
      return;
    }
    await bar.click();
    const wystawBtn = page.getByRole("button", { name: /Wystaw dokument/i });
    await wystawBtn.click();
    await page.getByRole("button", { name: /Faktura VAT/i }).first().click();
    await expect(page.getByText("Wystawić dokument?")).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: /Bez dokumentu/i }).click();
    await expect(page.getByText("Wystawić dokument?")).not.toBeVisible({ timeout: 3000 });
  });

  test("DOC-06: pole Uwagi na fakturze jest widoczne", async ({ page }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible().catch(() => false))) {
      test.skip(true, "Brak rezerwacji na grafiku");
      return;
    }
    await bar.click();
    const wystawBtn = page.getByRole("button", { name: /Wystaw dokument/i });
    await wystawBtn.click();
    await page.getByRole("button", { name: /Faktura VAT/i }).first().click();

    await expect(page.getByText(/Uwagi na fakturze|Wpisz uwagi/i)).toBeVisible({
      timeout: 3000,
    });
  });

  test("DOC-07: wybór Paragon z menu otwiera ten sam dialog", async ({ page }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible().catch(() => false))) {
      test.skip(true, "Brak rezerwacji na grafiku");
      return;
    }
    await bar.click();
    const wystawBtn = page.getByRole("button", { name: /Wystaw dokument/i });
    await wystawBtn.click();
    const paragonItem = page.getByRole("button", { name: /^Paragon$/i }).first();
    await paragonItem.click();

    await expect(page.getByText("Wystawić dokument?")).toBeVisible({ timeout: 3000 });
    await expect(
      page.getByRole("button", { name: /Paragon \(kasa fiskalna POSNET\)/i })
    ).toBeVisible({ timeout: 2000 });
  });

  test("DOC-08: sekcja Podział zawiera Kwota do zapłaty", async ({ page }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible().catch(() => false))) {
      test.skip(true, "Brak rezerwacji na grafiku");
      return;
    }
    await bar.click();
    const wystawBtn = page.getByRole("button", { name: /Wystaw dokument/i });
    await wystawBtn.click();
    await page.getByRole("button", { name: /Faktura VAT/i }).first().click();

    await expect(page.getByText(/Kwota do zapłaty|PLN/)).toBeVisible({ timeout: 3000 });
  });
});
