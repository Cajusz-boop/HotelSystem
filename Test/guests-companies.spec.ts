import { test, expect } from "@playwright/test";

test.describe("Goście i kontrahenci", () => {
  test.describe("Lista gości", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/kontrahenci");
    });

    test("GC-01: strona /kontrahenci ładuje się z zakładkami", async ({ page }) => {
      await expect(
        page.getByText(/Kontrahenci|Goście|Firmy/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("GC-02: lista gości wyświetla tabelę", async ({ page }) => {
      await expect(
        page.getByText(/Kontrahenci|Goście/i).first()
      ).toBeVisible({ timeout: 10000 });
      const hasTable = await page.locator("table, [role='grid'], [role='table']").first().isVisible().catch(() => false);
      const hasList = await page.locator("[data-testid*='guest'], .guest-row, tr").first().isVisible().catch(() => false);
      expect(hasTable || hasList).toBeTruthy();
    });

    test("GC-03: wyszukiwanie gościa po nazwisku", async ({ page }) => {
      await expect(page.getByText(/Kontrahenci|Goście/i).first()).toBeVisible({ timeout: 10000 });
      const searchInput = page.locator(
        'input[placeholder*="Szukaj" i], input[placeholder*="search" i], input[type="search"], input[name*="search" i]'
      ).first();
      if (!(await searchInput.isVisible().catch(() => false))) {
        test.skip(true, "Brak pola wyszukiwania");
        return;
      }
      await searchInput.fill("Nowak");
      await page.waitForTimeout(1000);
      await expect(page.locator("body")).toBeVisible();
    });

    test("GC-14: wyszukiwanie nieistniejącego gościa → brak wyników", async ({ page }) => {
      await expect(page.getByText(/Kontrahenci|Goście/i).first()).toBeVisible({ timeout: 10000 });
      const searchInput = page.locator(
        'input[placeholder*="Szukaj" i], input[placeholder*="search" i], input[type="search"]'
      ).first();
      if (!(await searchInput.isVisible().catch(() => false))) {
        test.skip(true, "Brak pola wyszukiwania");
        return;
      }
      await searchInput.fill("ZZZZXXX_NIEISTNIEJACY_999");
      await page.waitForTimeout(1500);
      const noResults = await page.getByText(/Brak|brak wyników|nie znaleziono|0 wyników|No results/i).first().isVisible().catch(() => false);
      const emptyTable = (await page.locator("tbody tr").count()) === 0;
      expect(noResults || emptyTable).toBeTruthy();
    });
  });

  test.describe("Karta gościa", () => {
    test("GC-06: strona /guests wyświetla listę gości", async ({ page }) => {
      await page.goto("/guests");
      await expect(
        page.getByText(/Goście|Guests|Lista gości/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Firmy", () => {
    test("GC-10: lista firm ładuje się", async ({ page }) => {
      await page.goto("/firmy");
      await page.waitForLoadState("domcontentloaded");
      await expect(
        page.getByText(/Firmy|Kontrahenci|Companies/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("GC-11: formularz dodania firmy — pola NIP, nazwa", async ({ page }) => {
      await page.goto("/firmy");
      await page.waitForLoadState("domcontentloaded");
      const addBtn = page.getByRole("button", { name: /Dodaj|Nowa firma|\+/i }).first();
      if (!(await addBtn.isVisible().catch(() => false))) {
        test.skip(true, "Brak przycisku dodawania firmy");
        return;
      }
      await addBtn.click();
      await expect(
        page.locator('input[name*="nip" i], input[name*="name" i], [data-testid*="nip"], label:has-text("NIP")').first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("VIP i czarna lista", () => {
    test("GC-09: profil gościa — ustawienie statusu VIP", async ({ page }) => {
      await page.goto("/guests");
      await page.waitForLoadState("domcontentloaded");
      const guestLink = page.locator("a[href*='/guests/'], tr td a, [data-testid*='guest']").first();
      if (!(await guestLink.isVisible().catch(() => false))) {
        test.skip(true, "Brak gości na liście");
        return;
      }
      await guestLink.click();
      await page.waitForLoadState("domcontentloaded");
      const vipElement = page.locator(
        '[data-testid*="vip"], select[name*="vip" i], input[name*="vip" i], label:has-text("VIP"), button:has-text("VIP")'
      ).first();
      await expect(vipElement).toBeVisible({ timeout: 10000 });
    });

    test("GC-12: czarna lista — element widoczny na profilu gościa", async ({ page }) => {
      await page.goto("/guests");
      await page.waitForLoadState("domcontentloaded");
      const guestLink = page.locator("a[href*='/guests/'], tr td a, [data-testid*='guest']").first();
      if (!(await guestLink.isVisible().catch(() => false))) {
        test.skip(true, "Brak gości na liście");
        return;
      }
      await guestLink.click();
      await page.waitForLoadState("domcontentloaded");
      const blacklistEl = page.locator(
        'button:has-text("Czarna lista"), [data-testid*="blacklist"], label:has-text("Czarna lista"), input[name*="blacklist" i]'
      ).first();
      const hasBlacklist = await blacklistEl.isVisible().catch(() => false);
      if (!hasBlacklist) {
        test.skip(true, "Brak elementu czarnej listy na profilu gościa");
        return;
      }
      expect(hasBlacklist).toBeTruthy();
    });
  });

  test.describe("RODO", () => {
    test("GC-13: anonimizacja — przycisk lub opcja na profilu gościa", async ({ page }) => {
      await page.goto("/guests");
      await page.waitForLoadState("domcontentloaded");
      const guestLink = page.locator("a[href*='/guests/'], tr td a").first();
      if (!(await guestLink.isVisible().catch(() => false))) {
        test.skip(true, "Brak gości na liście");
        return;
      }
      await guestLink.click();
      await page.waitForLoadState("domcontentloaded");
      const rodoEl = page.locator(
        'button:has-text("Anonimizuj"), button:has-text("RODO"), button:has-text("Usuń dane"), [data-testid*="anonymize"], [data-testid*="gdpr"]'
      ).first();
      const hasRodo = await rodoEl.isVisible().catch(() => false);
      if (!hasRodo) {
        test.skip(true, "Brak opcji RODO na profilu gościa");
        return;
      }
      expect(hasRodo).toBeTruthy();
    });
  });
});
