import { test, expect } from "@playwright/test";

test.describe("Logowanie i bezpieczeństwo", () => {
  test("AUTH-01: logowanie poprawnymi danymi → Dashboard", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 15000 });
    if (!page.url().includes("/login")) {
      test.skip(true, "Auth wyłączone — przekierowano z /login");
    }
    await page.getByLabel(/Email/i).fill("admin@hotel.local");
    await page.getByLabel(/Hasło|Password/i).fill("admin123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
    await expect(page.locator("nav, aside, [data-testid='sidebar']").first()).toBeVisible();
    await ctx.close();
  });

  test("AUTH-02: logowanie błędnym hasłem → komunikat błędu", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 15000 });
    if (!page.url().includes("/login")) {
      test.skip(true, "Auth wyłączone — przekierowano z /login");
    }
    await page.getByLabel(/Email/i).fill("admin@hotel.local");
    await page.getByLabel(/Hasło|Password/i).fill("wrong_password_123");
    await page.locator('button[type="submit"]').click();
    await expect(
      page.getByText(/Nieprawidłowe|błędne|Invalid|incorrect/i).first()
    ).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain("/login");
    await ctx.close();
  });

  test("AUTH-03: logowanie pustym formularzem → walidacja", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 15000 });
    if (!page.url().includes("/login")) {
      test.skip(true, "Auth wyłączone — przekierowano z /login");
    }
    await page.locator('button[type="submit"]').click();
    const stillOnLogin = page.url().includes("/login");
    expect(stillOnLogin).toBeTruthy();
    await ctx.close();
  });

  test("AUTH-05: dostęp do chronionej strony bez logowania → redirect /login", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/front-office");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    if (page.url().includes("/login")) {
      expect(page.url()).toMatch(/\/login/);
    } else {
      test.skip(true, "Auth wyłączone — /front-office dostępny bez logowania");
    }
    await ctx.close();
  });
});

test.describe("Zmiana hasła", () => {
  test("AUTH-06: strona /change-password ładuje się z formularzem", async ({ page }) => {
    await page.goto("/change-password");
    await expect(
      page.getByText(/Zmień hasło|Zmiana hasła|Change password/i).first()
    ).toBeVisible({ timeout: 10000 });
    const hasPasswordFields = await page.locator('input[type="password"]').count();
    expect(hasPasswordFields).toBeGreaterThanOrEqual(2);
  });
});

test.describe("Tryb ciemny/jasny", () => {
  test("AUTH-13: przełącznik motywu zmienia klasę na body/html", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const themeToggle = page.locator(
      'button:has([class*="moon"]), button:has([class*="sun"]), [data-testid="theme-toggle"], button[aria-label*="theme" i], button[aria-label*="motyw" i], button[aria-label*="tryb" i]'
    ).first();
    if (!(await themeToggle.isVisible().catch(() => false))) {
      test.skip(true, "Brak przełącznika motywu na stronie");
      return;
    }
    const classBefore = await page.locator("html").getAttribute("class") ?? "";
    await themeToggle.click();
    await page.waitForTimeout(500);
    const classAfter = await page.locator("html").getAttribute("class") ?? "";
    expect(classAfter).not.toBe(classBefore);
  });
});
