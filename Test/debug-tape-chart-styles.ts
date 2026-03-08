/**
 * Uruchom: npx playwright test Test/debug-tape-chart-styles.ts --headed
 * Wymaga: npm run dev na localhost:3011, zalogowanie
 * Zrzuca computed styles paska AMBROZIAK i jego rodzica przy 100% i 125% zoom
 */
import { test } from "@playwright/test";

async function dumpBarStyles(page: import("@playwright/test").Page, zoomLabel: string) {
  const bar = page.locator('[data-reservation-id]').filter({ hasText: /AMBROZIAK/i }).first();
  await bar.waitFor({ state: "visible", timeout: 10000 }).catch(() => null);
  const count = await bar.count();
  if (count === 0) {
    console.log(`[${zoomLabel}] Brak paska AMBROZIAK`);
    return;
  }

  const barEl = bar.first();

  const { barData, parentData } = await barEl.evaluate((el) => {
    const cs = getComputedStyle(el);
    let gridParent: Element | null = el.parentElement;
    while (gridParent && getComputedStyle(gridParent).display !== "grid") {
      gridParent = gridParent.parentElement;
    }
    const parentCs = gridParent ? getComputedStyle(gridParent) : null;
    return {
      barData: {
        tagName: el.tagName,
        dataReservationId: el.getAttribute("data-reservation-id"),
        computed: {
          position: cs.position,
          top: cs.top,
          left: cs.left,
          width: cs.width,
          height: cs.height,
          gridRow: cs.gridRow,
          gridColumn: cs.gridColumn,
        },
      },
      parentData: parentCs
        ? {
            tagName: gridParent!.tagName,
            display: parentCs.display,
            gridTemplateRows: parentCs.gridTemplateRows,
            gridTemplateColumns: parentCs.gridTemplateColumns?.slice(0, 200),
          }
        : null,
    };
  });

  console.log(`\n=== ${zoomLabel} ===`);
  console.log("BAR:", JSON.stringify(barData, null, 2));
  console.log("GRID PARENT:", JSON.stringify(parentData, null, 2));
}

test("debug tape chart styles", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("http://localhost:3011/front-office", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  await dumpBarStyles(page, "100% zoom");

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(() => (document.body.style.zoom = "1.25"));
  await page.waitForTimeout(500);

  await dumpBarStyles(page, "125% zoom");

  await page.evaluate(() => (document.body.style.zoom = "1"));
});
