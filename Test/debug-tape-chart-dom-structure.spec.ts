/**
 * Pełna diagnostyka DOM tapeczartu — 100% i 150% zoom.
 * Uruchom: npx playwright test Test/debug-tape-chart-dom-structure.spec.ts --project=chromium
 * Wymaga: npm run dev, auth (global setup)
 */
import { test } from "@playwright/test";

function runFullDiagnostic(): Record<string, unknown> {
  const zoom = Math.round(window.devicePixelRatio * 100);
  const zoomLabel = zoom + "%";
  const lines: string[] = [];

  const scrollArea = document.querySelector(".tape-chart-scroll-area") as HTMLElement | null;
  if (!scrollArea) return { error: "BRAK .tape-chart-scroll-area", zoom: zoomLabel };

  const bars = document.querySelectorAll("[data-reservation-id]");
  let targetBar: Element | null = null;
  for (const b of bars) {
    const t = (b.textContent || "").trim();
    if (t.includes("AMBROZIAK") && (t.includes("002") || t.includes("750"))) {
      targetBar = b;
      break;
    }
  }
  if (!targetBar) return { error: "BRAK PASKU AMBROZIAK 002", zoom: zoomLabel };

  const roomRow = targetBar.closest("[data-room-row]");
  const gridWrapper = scrollArea.querySelector("[data-grid-draggable]");
  const rowsCont = gridWrapper?.querySelector(".relative.w-full");
  const overlays = scrollArea.querySelectorAll(".absolute.inset-0");

  const dataAttrs = (el: Element | null) =>
    el ? Array.from(el.attributes || []).filter((a) => a.name.startsWith("data-")).map((a) => a.name + '="' + a.value + '"') : [];

  const rect = (el: Element | null) =>
    el ? el.getBoundingClientRect() : null;

  const rr = rect(roomRow as Element);
  const br = rect(targetBar);
  const or = overlays[0] ? rect(overlays[0]) : null;
  const diff = roomRow && rr ? br!.top - rr.top : null;

  const rows = rowsCont?.querySelectorAll("[data-room-row]") || [];
  const treeLines: string[] = [];
  treeLines.push("div.tape-chart-scroll-area (overflow: " + getComputedStyle(scrollArea).overflow + ")");
  if (gridWrapper) {
    const gwStyle = (gridWrapper as HTMLElement).getAttribute("style") || "";
    treeLines.push("└─ div[data-grid-draggable] (position: relative; height: " + (gwStyle.match(/height:\s*([^;]+)/)?.[1] || "?") + "px)");
    rows.forEach((r) => {
      const idx = r.getAttribute("data-index");
      const st = r.getAttribute("style") || "";
      const top = st.match(/top:\s*([^;]+)/)?.[1] || "?";
      const h = st.match(/height:\s*([^;]+)/)?.[1] || "?";
      const num = r.querySelector(".font-semibold.tabular-nums")?.textContent?.trim() || "?";
      const marker = r === roomRow ? " ← wiersz 002 (z paskiem AMBROZIAK)" : "";
      treeLines.push('   ├─ div (position: absolute; top: ' + top + '; height: ' + h + 'px) [data-index="' + idx + '" data-room-row]' + marker);
    });
    overlays.forEach((o) => {
      const os = (o as HTMLElement).getAttribute("style") || "";
      treeLines.push("   └─ div.overlay (absolute inset-0; " + os.substring(0, 60) + (os.length > 60 ? "..." : "") + ")");
    });
  }

  const ovParent = overlays[0]?.parentElement;
  const rowsParent = rowsCont?.parentElement;
  const isSibling = ovParent && rowsParent && ovParent === rowsParent;

  const overlayZ50 = scrollArea.querySelector("[style*='z-index: 50']") || scrollArea.querySelector("[style*='zIndex: 50']");
  const allOverlays = scrollArea.querySelectorAll("[class*='absolute'][class*='inset-0']");
  const overlayDetails = Array.from(allOverlays).map((o) => ({
    className: o.className,
    style: (o as HTMLElement).getAttribute("style"),
    childCount: o.children.length,
    childTags: Array.from(o.children).map((c) => c.tagName),
    hasDataReservationId: Array.from(o.querySelectorAll("[data-reservation-id]")).length,
  }));

  const row002 = rowsCont?.querySelector('[data-index="1"]');
  const row002Children = row002 ? Array.from(row002.children).map((c) => ({
    tag: c.tagName,
    className: c.className,
    style: (c as HTMLElement).getAttribute("style"),
    dataReservationId: c.getAttribute?.("data-reservation-id"),
    dataTestid: c.getAttribute?.("data-testid"),
  })) : [];

  return {
    zoom: zoomLabel,
    tree: treeLines,
    overlayWithZ50: !!overlayZ50,
    overlayDetails,
    row002DirectChildren: row002Children,
    dataAttrs: {
      roomRow: roomRow ? dataAttrs(roomRow as Element).join(" ") : "NIE ZNALEZIONY",
      bar: dataAttrs(targetBar).join(" "),
      overlay: overlays[0] ? dataAttrs(overlays[0]).join(" ") || "brak data-*" : "NIE ZNALEZIONY",
    },
    overlaySibling: !!overlays[0] ? isSibling : null,
    barInsideRow: !!roomRow,
    rects: {
      row002: rr ? { top: rr.top, height: rr.height } : null,
      overlay: or ? { top: or.top, height: or.height } : null,
      bar: { top: br!.top, height: br!.height },
    },
    diffTop: diff,
  };
}

test("debug tape chart DOM structure 100% i 150%", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("http://localhost:3011/front-office", { waitUntil: "networkidle" });
  await page.waitForSelector(".tape-chart-scroll-area", { timeout: 15000 });
  await page.waitForTimeout(3000);

  const out100 = await page.evaluate(runFullDiagnostic);
  if ("error" in out100) {
    console.log("\n=== BRAK DANYCH (100%):", out100.error);
    return;
  }

  console.log("\n\n" + "=".repeat(60));
  console.log("ZOOM 100% (devicePixelRatio)");
  console.log("=".repeat(60));
  console.log("\n--- 1. DRZEWO DOM ---\n" + (out100.tree as string[]).join("\n"));
  console.log("\n--- 2. ATRYBUTY data-* ---");
  const da = out100.dataAttrs as Record<string, string>;
  console.log("Wiersz pokoju 002:", da.roomRow);
  console.log("Pasek:", da.bar);
  console.log("Overlay:", da.overlay);
  console.log("\n--- 3. OVERLAY vs WIERSZE ---");
  console.log("Overlay rodzeństwem wierszy?", out100.overlaySibling);
  console.log("Pasek wewnątrz wiersza?", out100.barInsideRow);
  console.log("\n--- 4/5. getBoundingClientRect ---");
  const rects = out100.rects as Record<string, { top: number; height: number } | null>;
  if (rects.row002) console.log("Wiersz 002: top=" + rects.row002.top + ", height=" + rects.row002.height);
  if (rects.overlay) console.log("Overlay: top=" + rects.overlay.top + ", height=" + rects.overlay.height);
  console.log("Pasek: top=" + rects.bar.top + ", height=" + rects.bar.height);
  console.log("\n--- 6. RÓŻNICA (pasek.top - wiersz002.top) ---");
  console.log("Wartość:", out100.diffTop, "px");
  console.log("\n--- OVERLAY (absolute inset-0) ---");
  console.log("Overlay z z-index:50?", out100.overlayWithZ50);
  (out100.overlayDetails as Array<{ className: string; childCount: number; childTags: string[]; hasDataReservationId: number }>).forEach((o, i) => {
    console.log("Overlay", i + 1, ":", o.childCount, "dzieci, tagi:", o.childTags.slice(0, 5).join(",") + (o.childTags.length > 5 ? "..." : ""), ", data-reservation-id wewnątrz:", o.hasDataReservationId);
  });
  console.log("\n--- WIERSZ 002 (data-index=1) - bezpośrednie dzieci ---");
  (out100.row002DirectChildren as Array<{ tag: string; className: string; style: string; dataReservationId: string; dataTestid: string }>).forEach((c, i) => {
    console.log(i + 1, c.tag, "class:", c.className?.substring(0, 60), "style:", c.style?.substring(0, 80), c.dataReservationId ? "data-reservation-id=" + c.dataReservationId : "", c.dataTestid ? "data-testid=" + c.dataTestid : "");
  });

  await page.evaluate(() => {
    (document.body as HTMLElement).style.zoom = "1.5";
  });
  await page.waitForTimeout(600);

  const out150 = await page.evaluate(runFullDiagnostic);
  await page.evaluate(() => {
    (document.body as HTMLElement).style.zoom = "1";
  });

  if ("error" in out150) {
    console.log("\n=== BRAK DANYCH (150%):", out150.error);
    return;
  }

  console.log("\n\n" + "=".repeat(60));
  console.log("ZOOM 150% (document.body.style.zoom=1.5 — symulacja Ctrl+Plus)");
  console.log("=".repeat(60));
  console.log("\n--- 4/5. getBoundingClientRect ---");
  const r150 = out150.rects as Record<string, { top: number; height: number } | null>;
  if (r150.row002) console.log("Wiersz 002: top=" + r150.row002.top + ", height=" + r150.row002.height);
  if (r150.overlay) console.log("Overlay: top=" + r150.overlay.top + ", height=" + r150.overlay.height);
  console.log("Pasek: top=" + r150.bar.top + ", height=" + r150.bar.height);
  console.log("\n--- 6. RÓŻNICA ---");
  console.log("Wartość:", out150.diffTop, "px");

  console.log("\n--- PORÓWNANIE ---");
  const d100 = out100.diffTop as number;
  const d150 = out150.diffTop as number;
  console.log("diffTop 100%:", d100);
  console.log("diffTop 150%:", d150);
  console.log("Przesunięcie:", d150 - d100, "px");
});
