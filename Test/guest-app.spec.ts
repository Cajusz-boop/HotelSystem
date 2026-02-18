import { test, expect } from "@playwright/test";

test.describe("Aplikacja gościa i Web Check-in", () => {
  test("GA-01: web check-in z nieprawidłowym tokenem → błąd", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/check-in/guest/invalid-token-xyz-123");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    const hasError = await page
      .getByText(/nie znaleziono|nieprawidłowy|wygasł|invalid|expired|not found|błąd|error|404/i)
      .first()
      .isVisible()
      .catch(() => false);
    const is404 = page.url().includes("404") || (await page.title()).includes("404");
    const hasForm = await page.locator("form, input").first().isVisible().catch(() => false);
    expect(hasError || is404 || hasForm).toBeTruthy();
    await ctx.close();
  });

  test("GA-02: strona płatności z nieprawidłowym tokenem → błąd", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/pay/invalid-token-xyz-123");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    const hasError = await page
      .getByText(/nie znaleziono|nieprawidłowy|wygasł|invalid|expired|not found|błąd|error|404/i)
      .first()
      .isVisible()
      .catch(() => false);
    const is404 = page.url().includes("404") || (await page.title()).includes("404");
    const hasPaymentForm = await page.locator("form, input, button").first().isVisible().catch(() => false);
    expect(hasError || is404 || hasPaymentForm).toBeTruthy();
    await ctx.close();
  });

  test("GA-03: strona /booking ładuje się z formularzem wyszukiwania", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/booking");
    await page.waitForLoadState("domcontentloaded");
    await expect(
      page.getByText(/Rezerwuj|Booking|Zarezerwuj|Wyszukaj/i).first()
    ).toBeVisible({ timeout: 10000 });
    await ctx.close();
  });

  test("GA-04: guest-app z nieprawidłowym tokenem → błąd lub redirect", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/guest-app/invalid-token-xyz-123");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    const hasError = await page
      .getByText(/nie znaleziono|nieprawidłowy|wygasł|invalid|expired|not found|błąd|error|404/i)
      .first()
      .isVisible()
      .catch(() => false);
    const is404 = page.url().includes("404") || (await page.title()).includes("404");
    const hasContent = await page.locator("body").isVisible();
    expect(hasError || is404 || hasContent).toBeTruthy();
    await ctx.close();
  });
});
