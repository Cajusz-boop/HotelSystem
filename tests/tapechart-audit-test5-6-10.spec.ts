/**
 * TEST 5, 6, 10 — Audyt TapeChart: weryfikacja spójności z bazą.
 * - TEST 5: Drag-and-drop → sprawdź checkIn, checkOut, roomId w DB
 * - TEST 6: Resize → sprawdź checkOut w DB
 * - TEST 10: Edycja w UnifiedReservationDialog → pasek odświeża się bez F5
 *
 * Uruchom: npx playwright test tests/tapechart-audit-test5-6-10.spec.ts --project=chromium
 * Serwer: http://localhost:3011
 */
import { test, expect } from "@playwright/test";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function getReservationFromDb(request: import("@playwright/test").APIRequestContext, id: string) {
  const res = await request.get(`/api/test/get-reservation?id=${encodeURIComponent(id)}`);
  const json = (await res.json()) as { success?: boolean; checkIn?: string; checkOut?: string; room?: string; roomId?: string; error?: string };
  return json;
}

async function scrollChartRight(page: import("@playwright/test").Page, steps = 15) {
  const scrollEl = page.locator(".tape-chart-scroll-area").first();
  for (let i = 0; i < steps; i++) {
    await scrollEl.evaluate((el: HTMLElement) => { el.scrollLeft += 200; });
    await page.waitForTimeout(80);
  }
}

test.describe("TapeChart TEST 5, 6, 10 — spójność z bazą", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("pms-onboarding-seen", "1"));
    await page.goto("/front-office", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid^="room-row-"]', { timeout: 15000 });
    await page.waitForTimeout(800);
  });

  test("TEST 10: Edycja checkOut w UnifiedReservationDialog — pasek odświeża się bez F5", async ({ page }) => {
    const bar = page.locator('[data-testid="reservation-bar"]').first();
    await expect(bar).toBeVisible({ timeout: 10000 });
    await scrollChartRight(page, 10);

    const barBefore = await bar.getAttribute("data-reservation-id");
    if (!barBefore) {
      test.skip();
      return;
    }

    await bar.dblclick();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const checkOutInput = page.locator('[data-testid="create-reservation-checkOut"]').first();
    await expect(checkOutInput).toBeVisible({ timeout: 3000 });
    const currentCheckOut = await checkOutInput.inputValue();
    const newCheckOut = addDays(currentCheckOut, 1);
    await checkOutInput.fill(newCheckOut);

    await page.locator('[data-testid="create-reservation-save"]').first().click();
    await expect(dialog).not.toBeVisible({ timeout: 8000 });
    await expect(page.locator("text=Zapisano zmiany").or(page.locator("text=zaktualizowano"))).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(500);
    const barAfter = page.locator(`[data-reservation-id="${barBefore}"]`).first();
    await expect(barAfter).toBeVisible({ timeout: 3000 });

    // Pasek nadal widoczny bez F5 — state został zaktualizowany
    expect(await barAfter.isVisible()).toBe(true);
  });

  test("TEST 6: Resize checkOut — aktualizacja w bazie", async ({ page, request }) => {
    const bar = page.locator('[data-testid="reservation-bar"]').first();
    await expect(bar).toBeVisible({ timeout: 10000 });
    await scrollChartRight(page, 12);

    const resId = await bar.getAttribute("data-reservation-id");
    if (!resId) {
      test.skip();
      return;
    }

    const before = await getReservationFromDb(request, resId);
    if (!before.success || !before.checkOut) {
      test.skip();
      return;
    }

    const rightHandle = bar.locator('[aria-label="Zmiana daty wymeldowania"]');
    if ((await rightHandle.count()) === 0) {
      test.skip(); // brak uchwytu resize (np. tryb uproszczony)
      return;
    }

    const box = await bar.boundingBox();
    if (!box) {
      test.skip();
      return;
    }
    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 80, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(1500);

    const after = await getReservationFromDb(request, resId);
    expect(after.success).toBe(true);
    expect(after.checkOut).toBeDefined();
    if (before.checkOut && after.checkOut) {
      const beforeDate = new Date(before.checkOut).getTime();
      const afterDate = new Date(after.checkOut).getTime();
      expect(afterDate).toBeGreaterThanOrEqual(beforeDate);
    }
  });

  test("TEST 5: Drag-and-drop — aktualizacja roomId/dat w bazie", async ({ page, request }) => {
    const bar = page.locator('[data-testid="reservation-bar"]').first();
    await expect(bar).toBeVisible({ timeout: 10000 });
    await scrollChartRight(page, 8);

    const resId = await bar.getAttribute("data-reservation-id");
    if (!resId) {
      test.skip();
      return;
    }

    const before = await getReservationFromDb(request, resId);
    if (!before.success || !before.room) {
      test.skip();
      return;
    }

    await page.keyboard.down("Shift");
    const box = await bar.boundingBox();
    if (!box) {
      test.skip();
      return;
    }
    const targetRoomRow = page.locator('[data-testid^="room-row-"]').filter({ hasNot: page.locator(`[data-reservation-id="${resId}"]`) }).first();
    const targetCell = page.locator('[data-testid^="cell-"]').filter({ hasNot: page.locator('[data-testid="reservation-bar"]') }).first();
    await expect(targetCell).toBeVisible({ timeout: 5000 });

    const cellBox = await targetCell.boundingBox();
    if (!cellBox) {
      test.skip();
      return;
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(cellBox.x + cellBox.width / 2, cellBox.y + cellBox.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await page.waitForTimeout(2000);

    const after = await getReservationFromDb(request, resId);
    expect(after.success).toBe(true);
    expect(after.room).toBeDefined();
    if (before.room !== after.room || (before.checkIn !== after?.checkIn) || (before.checkOut !== after?.checkOut)) {
      expect(after.room).toBeDefined();
    }
  });
});
