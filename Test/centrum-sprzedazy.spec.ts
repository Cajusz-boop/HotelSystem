import { test, expect } from "@playwright/test";

// FAZA 4 — scenariusze z checklisty wdrożeniowej (4.1–4.11)

test.describe("Centrum Sprzedaży — testy funkcjonalne", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/centrum-sprzedazy");
    await expect(page.getByText(/Centrum Sprzedaży/i)).toBeVisible({ timeout: 10000 });
  });

  test("F01: strona się ładuje, lista imprez widoczna", async ({ page }) => {
    await expect(page.locator("[style*='border-left']").first()).toBeVisible({ timeout: 10000 });
  });

  test("F02: filtr typu WESELE → tylko wesela", async ({ page }) => {
    await page.getByRole("button", { name: /Wesele/i }).click();
    const cards = page.locator("[style*='border-left']");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(count, 5); i++) {
      await expect(cards.nth(i).getByText("Wesele")).toBeVisible();
    }
  });

  test("F04: wyszukiwarka — pole działa", async ({ page }) => {
    const search = page.getByPlaceholder(/Szukaj/i);
    await search.fill("Kowalski");
    await page.waitForTimeout(500);
    const cards = page.locator("[style*='border-left']");
    await expect(cards.first()).toBeVisible({ timeout: 5000 });
  });

  test("F05: klik na imprezę → modal szczegółów", async ({ page }) => {
    const card = page.locator("[style*='border-left']").first();
    await card.click();
    await expect(page.getByText(/SZCZEGÓŁY|ZADATEK|STATUS/i).first()).toBeVisible({ timeout: 3000 });
  });

  test("F10: zakładka Gantt → widok miesiąca", async ({ page }) => {
    await page.getByRole("button", { name: /Gantt/i }).click();
    await expect(page.getByText(/SALA|Sala Złota/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("F13: przycisk +Nowa impreza → nawigacja", async ({ page }) => {
    await page.getByRole("button", { name: /Nowa impreza/i }).click();
    await expect(page).toHaveURL(/\/events\/new/, { timeout: 5000 });
  });

  test("F14: zakładka Kosztorysy → ładuje się", async ({ page }) => {
    await page.getByRole("button", { name: /Kosztorysy/i }).click();
    await expect(page.getByText(/Kosztorysy|Brak kosztorysów/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Centrum Sprzedaży — błędy i wyjątki", () => {
  test("E01 / 4.6: zadatek z polskim przecinkiem 1500,50", async ({ page }) => {
    await page.goto("/centrum-sprzedazy");
    await expect(page.getByText(/Centrum Sprzedaży/i)).toBeVisible({ timeout: 10000 });
    const card = page.locator("[style*='border-left']").first();
    await card.click();
    await expect(page.getByText(/ZADATEK/i)).toBeVisible({ timeout: 3000 });
    const addBtn = page.getByText(/Dodaj|Zmień/i).first();
    await addBtn.click();
    const input = page.locator('input[type="number"]').first();
    await input.fill("1500,50");
    await page.getByRole("button", { name: /Zapisz/i }).first().click();
    await page.waitForTimeout(1500);
    // Po zapisie widzimy kwotę (np. 1500,50 zł lub 1 500,50)
    await expect(page.getByText(/1500/)).toBeVisible({ timeout: 3000 });
  });

  test("4.10: XSS w notatce — script zapisany jako tekst", async ({ page }) => {
    await page.goto("/centrum-sprzedazy");
    await expect(page.getByText(/Centrum Sprzedaży/i)).toBeVisible({ timeout: 10000 });
    const card = page.locator("[style*='border-left']").first();
    await card.click();
    await expect(page.getByText(/NOTATKA/i)).toBeVisible({ timeout: 3000 });
    const editNote = page.getByText(/Edytuj|Brak notatki/i).first();
    await editNote.click();
    const textarea = page.locator("textarea").first();
    const xssPayload = '<script>alert("XSS")</script>';
    await textarea.fill(xssPayload);
    await page.getByRole("button", { name: /Zapisz/i }).first().click();
    await page.waitForTimeout(1000);
    // Zamknij modal (Esc lub Zamknij)
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await card.click();
    // Notatka powinna być widoczna jako tekst, nie wykonać script (brak alert)
    await expect(page.getByText("script")).toBeVisible({ timeout: 2000 });
  });
});

test.describe("FAZA 4: Zmiana statusu i rollback", () => {
  test("4.1: zmiana statusu na DONE", async ({ page }) => {
    await page.goto("/centrum-sprzedazy");
    await expect(page.getByText(/Centrum Sprzedaży/i)).toBeVisible({ timeout: 10000 });
    const confirmedCard = page.locator("[style*='border-left']").filter({
      has: page.getByText(/Potwierdzone|CONFIRMED/i),
    }).first();
    const hasConfirmed = await confirmedCard.count() > 0;
    if (!hasConfirmed) {
      test.skip(true, "Brak imprezy CONFIRMED do testu");
      return;
    }
    await confirmedCard.click();
    await expect(page.getByText(/STATUS/i)).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: /Zakończone|DONE/i }).click();
    await expect(page.getByText(/Status: Zakończone/i)).toBeVisible({ timeout: 5000 });
  });

  test("4.7: PATCH fail — rollback (offline)", async ({ page }) => {
    await page.goto("/centrum-sprzedazy");
    await expect(page.getByText(/Centrum Sprzedaży/i)).toBeVisible({ timeout: 10000 });
    const card = page.locator("[style*='border-left']").first();
    await card.click();
    await expect(page.getByText(/ZADATEK/i)).toBeVisible({ timeout: 3000 });
    const paidState = await page.getByText(/Opłacony|Nieopłacony/i).first().textContent();
    await page.context().setOffline(true);
    const toggleBtn = page.getByRole("button", { name: /Oznacz opłacony|Cofnij/i }).first();
    await toggleBtn.click();
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Błąd zapisu|zmiany cofnięte/i)).toBeVisible({ timeout: 5000 });
    await page.context().setOffline(false);
  });
});
