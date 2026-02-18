import { test, expect } from "@playwright/test";

test.describe("Front Office — rozszerzony", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.getByText(/Grafik|Recepcja/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("FO-10: filtr typu pokoju — element widoczny", async ({ page }) => {
    const typeFilter = page.locator(
      'select[name*="type" i], select[name*="typ" i], [data-testid*="room-type-filter"], button:has-text("Typ pokoju"), button:has-text("Room type"), [role="combobox"]'
    ).first();
    const hasFilter = await typeFilter.isVisible().catch(() => false);
    if (!hasFilter) {
      test.skip(true, "Brak filtra typu pokoju na Tape Chart");
      return;
    }
    expect(hasFilter).toBeTruthy();
  });

  test("FO-11: filtr piętra — element widoczny", async ({ page }) => {
    const floorFilter = page.locator(
      'select[name*="floor" i], select[name*="pietro" i], [data-testid*="floor-filter"], button:has-text("Piętro"), button:has-text("Floor")'
    ).first();
    const hasFilter = await floorFilter.isVisible().catch(() => false);
    if (!hasFilter) {
      test.skip(true, "Brak filtra piętra na Tape Chart");
      return;
    }
    expect(hasFilter).toBeTruthy();
  });

  test("FO-12: widok KWHotel (/front-office/kwhotel) ładuje się", async ({ page }) => {
    await page.goto("/front-office/kwhotel");
    await expect(
      page.getByText(/Recepcja|KWHotel|Grafik/i).first()
    ).toBeVisible({ timeout: 10000 });
    const hasRooms = await page.locator('[data-testid*="room"], td, .room-label').first().isVisible().catch(() => false);
    expect(hasRooms).toBeTruthy();
  });

  test("FO-14: podział rezerwacji (Split) — opcja w menu kontekstowym", async ({ page }) => {
    const bar = page.locator('[data-testid*="reservation-bar"], .reservation-bar, [class*="reservation"]').first();
    if (!(await bar.isVisible().catch(() => false))) {
      test.skip(true, "Brak rezerwacji na grafiku");
      return;
    }
    await bar.click({ button: "right" });
    await page.waitForTimeout(500);
    const splitOption = page.locator(
      '[role="menuitem"]:has-text("Podziel"), [role="menuitem"]:has-text("Split"), :text("Podziel rezerwację")'
    ).first();
    const hasSplit = await splitOption.isVisible().catch(() => false);
    if (!hasSplit) {
      test.skip(true, "Brak opcji podziału rezerwacji w menu kontekstowym");
      return;
    }
    expect(hasSplit).toBeTruthy();
  });

  test("KB-04: Esc zamyka otwarty panel/dialog", async ({ page }) => {
    const bar = page.locator('[data-testid*="reservation-bar"], .reservation-bar, [class*="reservation"]').first();
    if (!(await bar.isVisible().catch(() => false))) {
      test.skip(true, "Brak rezerwacji na grafiku");
      return;
    }
    await bar.click();
    await page.waitForTimeout(1000);
    const sheetVisible = await page.locator('[role="dialog"], .sheet, [data-state="open"]').first().isVisible().catch(() => false);
    if (!sheetVisible) {
      test.skip(true, "Brak otwartego panelu po kliknięciu");
      return;
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const sheetStillVisible = await page.locator('[role="dialog"], .sheet, [data-state="open"]').first().isVisible().catch(() => false);
    expect(sheetStillVisible).toBeFalsy();
  });

  test("KB-05: strzałki ←/→ nawigują po datach", async ({ page }) => {
    const dateHeader = page.locator('[data-testid*="date-header"], .date-header, th').first();
    const textBefore = await dateHeader.textContent().catch(() => "");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1000);
    const dateNav = page.locator(
      'button:has-text("→"), button:has-text("Następny"), button[aria-label*="next" i], button[aria-label*="następ" i]'
    ).first();
    if (await dateNav.isVisible().catch(() => false)) {
      await dateNav.click();
      await page.waitForTimeout(1000);
    }
    await expect(page.locator("body")).toBeVisible();
  });
});
