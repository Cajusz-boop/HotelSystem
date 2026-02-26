/**
 * PLAN TESTÓW v3 — Moduły: Księga meldunkowa, Pokoje, Cennik, Meldunek, Kontrahenci, Ustawienia
 *
 * Uruchom: npx playwright test tests/plan-v3-modules.spec.ts --reporter=list --project=chromium
 * Serwer: http://localhost:3011
 */
import { test, expect } from "@playwright/test";

test.describe("Moduły: Księga meldunkowa, Pokoje, Cennik", () => {
  test("Księga meldunkowa — strona się otwiera", async ({ page }) => {
    await page.goto("/ksiega-meldunkowa", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/ksiega-meldunkowa/, { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/login/);
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toMatch(/Księga|Meldunkowa|Wszystkie|Przyjazdy|Wyjazdy|Data|Eksport|Ładowanie/i);
  });

  test("Pokoje — strona się otwiera", async ({ page }) => {
    await page.goto("/pokoje", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/pokoje/, { timeout: 10000 });
    const hasContent = await page
      .getByText(/Pokoje|zarządzanie|Czysty|Do sprzątania|Dodaj|Eksport/i)
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test("Cennik — strona się otwiera", async ({ page }) => {
    await page.goto("/cennik", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/cennik/, { timeout: 10000 });
    const hasContent = await page
      .getByText(/Cennik|stawki|Typ|pokoi|Plan|pakiet|Tabela/i)
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});

test.describe("Moduły: Meldunek, Kontrahenci, Ustawienia", () => {
  test("Meldunek (/check-in) — strona się otwiera", async ({ page }) => {
    await page.goto("/check-in", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/check-in/, { timeout: 10000 });
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toMatch(/Meldunek|gościa|MRZ|rezerwacj|Zapisz/i);
  });

  test("Kontrahenci — strona się otwiera", async ({ page }) => {
    await page.goto("/kontrahenci", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/kontrahenci/, { timeout: 10000 });
    const hasContent = await page
      .getByText(/Kontrahenci|Goście|Firmy|Szukaj/i)
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test("Kontrahenci — zakładka Firmy", async ({ page }) => {
    await page.goto("/kontrahenci?tab=firmy", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/kontrahenci\?tab=firmy/, { timeout: 10000 });
    const firmyTab = page.getByRole("button", { name: /Firmy/i });
    await expect(firmyTab).toBeVisible({ timeout: 5000 });
  });

  test("Ustawienia — strona główna", async ({ page }) => {
    await page.goto("/ustawienia", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/ustawienia/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: /Ustawienia/i })).toBeVisible({ timeout: 5000 });
    const hasLink = await page.getByText(/Dane hotelu|Użytkownicy|Numeracja/i).first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasLink).toBeTruthy();
  });

  test("Ustawienia — Dane hotelu", async ({ page }) => {
    await page.goto("/ustawienia/dane-hotelu", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/ustawienia\/dane-hotelu/, { timeout: 10000 });
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toMatch(/Dane hotelu|Nazwa|adres|NIP|Ładowanie/i);
  });
});
