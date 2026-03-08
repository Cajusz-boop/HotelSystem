/**
 * Diagnostyka zoom tapeczartu — 100% vs 150%
 * Uruchom: npx playwright test Test/debug-tape-chart-zoom.spec.ts --headed
 * Wymaga: npm run dev, zalogowanie (auth)
 */
import { test } from "@playwright/test";

function runDiagnostic() {
  const bars = document.querySelectorAll("[data-reservation-id]");
  let targetBar: Element | null = null;
  bars.forEach((bar) => {
    const text = bar.textContent || "";
    if (text.includes("AMBROZIAK") && text.includes("750")) targetBar = bar;
  });
  if (!targetBar)
    return { error: "BRAK PASKU AMBROZIAK 750", devicePixelRatio: window.devicePixelRatio };

  const row = targetBar.closest("[data-room-row]");
  const barRect = targetBar.getBoundingClientRect();
  const rowRect = row ? row.getBoundingClientRect() : null;
  const scrollEl = document.querySelector(".tape-chart-scroll-area") || document.querySelector(".overflow-auto");

  return {
    devicePixelRatio: window.devicePixelRatio,
    bar: { getBoundingClientRect: { top: barRect.top, left: barRect.left, height: barRect.height, width: barRect.width } },
    row: row
      ? {
          style: row.getAttribute("style") || "",
          getBoundingClientRect: rowRect ? { top: rowRect.top, left: rowRect.left, height: rowRect.height, width: rowRect.width } : null,
        }
      : null,
    diffTop: row && rowRect ? barRect.top - rowRect.top : null,
    scroll: scrollEl
      ? { scrollTop: scrollEl.scrollTop, scrollHeight: scrollEl.scrollHeight, rect: scrollEl.getBoundingClientRect() }
      : null,
  };
}

test("debug tape chart zoom 100% vs 150%", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("http://localhost:3011/front-office", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000); // czekaj na tapeczart + ewentualną rezerwację AMBROZIAK

  const out100 = await page.evaluate(runDiagnostic);
  console.log("\n\n=== ZOOM 100% ===");
  console.log(JSON.stringify(out100, null, 2));

  await page.evaluate(() => (document.body.style.zoom = "1.5"));
  await page.waitForTimeout(600);

  const out150 = await page.evaluate(runDiagnostic);
  console.log("\n\n=== ZOOM 150% ===");
  console.log(JSON.stringify(out150, null, 2));

  await page.evaluate(() => (document.body.style.zoom = "1"));

  // Porównanie
  if (out100.error || out150.error) {
    console.log("\n--- UWAGA: brak paska AMBROZIAK 750 w jednym z pomiarów ---");
    return;
  }
  const d100 = out100.diffTop as number;
  const d150 = out150.diffTop as number;
  const shift = d150 - d100;
  console.log("\n--- PORÓWNANIE ---");
  console.log("diffTop przy 100%:", d100);
  console.log("diffTop przy 150%:", d150);
  console.log("Przesunięcie (różnica):", shift, "px");
});
