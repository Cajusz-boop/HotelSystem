#!/usr/bin/env npx tsx
/**
 * Kompletny zestaw screenshotów do materiałów szkoleniowych systemu hotelowego.
 *
 * 1. Uruchamia serwer (jeśli nie działa)
 * 2. Przygotowuje dane demo (POST /api/training/setup-demo)
 * 3. Loguje się i wykonuje screenshoty realistycznych scenariuszy recepcji
 * 4. Zapisuje do /training-screens
 *
 * Użycie: npm run training:screens
 */

import { chromium } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3011";
const SCREENSHOTS_DIR = join(process.cwd(), "training-screens");
const PORT = 3011;

let devProcess: ChildProcess | null = null;

async function isServerReady(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/users`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok || res.status === 401;
  } catch {
    return false;
  }
}

async function waitForServer(maxAttempts = 60): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isServerReady()) {
      console.log("  Serwer gotowy.");
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
    process.stdout.write(".");
  }
  throw new Error("Timeout: serwer nie odpowiedział. Uruchom: npm run dev");
}

function startDevServer(): void {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  devProcess = spawn(npmCmd, ["run", "dev"], {
    cwd: process.cwd(),
    stdio: "pipe",
    env: { ...process.env, PORT: String(PORT) },
  });
  devProcess.stdout?.on("data", (d) => process.stdout.write(d.toString()));
  devProcess.stderr?.on("data", (d) => process.stderr.write(d.toString()));
}

function stopDevServer(): void {
  if (devProcess?.pid) {
    process.kill(devProcess.pid, "SIGTERM");
    devProcess = null;
  }
}

async function setupDemoData(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/training/setup-demo`, { method: "POST" });
  const json = (await res.json()) as { success?: boolean; created?: { guests: number; reservations: number } };
  if (json.success && json.created) {
    console.log(`  Dane demo: ${json.created.guests} gości, ${json.created.reservations} rezerwacji`);
  } else {
    console.warn("  Dane demo mogły już istnieć lub błąd:", (json as { error?: string }).error);
  }
}

async function ensureUiReady(page: import("@playwright/test").Page, extraMs = 800): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => null);
  await page.waitForTimeout(extraMs);
}

function scrollTapeChart(page: import("@playwright/test").Page, steps = 5): Promise<void> {
  const scrollEl = page.locator(".tape-chart-scroll-area").first();
  return scrollEl.evaluate(
    (el: HTMLElement, s: number) => {
      for (let i = 0; i < s; i++) el.scrollLeft += 200;
    },
    steps
  ).catch(() => null);
}

async function main() {
  const shouldStartServer = !(await isServerReady());
  if (shouldStartServer) {
    console.log("Uruchamiam serwer deweloperski...");
    startDevServer();
    await waitForServer();
  } else {
    console.log("Serwer już działa na", BASE_URL);
  }

  console.log("Przygotowuję dane demo...");
  await setupDemoData();
  await new Promise((r) => setTimeout(r, 1500));

  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  const TARGET_FILES = [
    "01-login-empty.png", "02-login-error.png", "03-dashboard.png", "04-tapechart-free.png",
    "05-tapechart-conflict.png", "06-new-reservation-form.png", "07-reservation-saved.png",
    "08-checkin-before.png", "09-checkin-after.png", "10-room-change.png", "11-checkout-bill.png",
    "12-payment-method.png", "13-payment-success.png", "14-system-error.png",
  ];

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
    });
    await context.addInitScript(() => {
      localStorage.setItem("pms-onboarding-seen", "1");
    });
    const page = await context.newPage();

    const shot = async (name: string, extraWait = 500) => {
      await ensureUiReady(page, extraWait);
      await page.screenshot({ path: join(SCREENSHOTS_DIR, name), fullPage: true });
      console.log(`  ${name}`);
    };

    // --- 01: Login pusty ---
    console.log("\n01-login-empty.png");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await shot("01-login-empty.png");

    // --- 02: Błąd logowania ---
    console.log("02-login-error.png");
    const userBtn = page.locator("button").filter({ hasText: /Administrator|Aneta|admin/i }).first();
    if (await userBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await userBtn.click();
      await page.waitForTimeout(400);
      const dialog = page.getByRole("dialog");
      // Błędny PIN: 9999
      for (const digit of ["9", "9", "9", "9"]) {
        await dialog.getByRole("button", { name: digit }).click({ timeout: 2000 }).catch(() => null);
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(1200);
      await shot("02-login-error.png");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    } else {
      await shot("02-login-error.png");
    }

    // --- Login poprawny ---
    if (await userBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await userBtn.click();
      await page.waitForTimeout(400);
      const dialog = page.getByRole("dialog");
      for (const digit of ["1", "2", "3", "4"]) {
        await dialog.getByRole("button", { name: digit }).click({ timeout: 2000 });
        await page.waitForTimeout(100);
      }
      await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }).catch(() => null);
    }
    await page.goto(`${BASE_URL}/front-office`, { waitUntil: "domcontentloaded", timeout: 25000 });
    await ensureUiReady(page, 2000);

    // --- 03: Dashboard ---
    console.log("03-dashboard.png");
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await shot("03-dashboard.png");

    // --- 04: Tape chart — wolne pokoje ---
    console.log("04-tapechart-free.png");
    await page.goto(`${BASE_URL}/front-office`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("[data-testid^='room-row-']", { timeout: 15000 }).catch(() => null);
    await shot("04-tapechart-free.png");

    // --- 05: Tape chart — konflikt ---
    console.log("05-tapechart-conflict.png");
    const conflictLabel = page.locator('label').filter({ hasText: /Konflikty/i });
    if (await conflictLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await conflictLabel.click();
      await page.waitForTimeout(600);
    }
    await shot("05-tapechart-conflict.png", 800);

    // --- 06: Nowa rezerwacja — formularz ---
    console.log("06-new-reservation-form.png");
    await page.getByTestId("create-reservation-open-btn").click({ timeout: 8000 });
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
    await page.waitForTimeout(500);
    const today = new Date();
    const checkIn = new Date(today);
    checkIn.setDate(checkIn.getDate() + 7);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 2);
    const checkInStr = checkIn.toISOString().slice(0, 10);
    const checkOutStr = checkOut.toISOString().slice(0, 10);
    const roomSelect = page.getByTestId("create-reservation-room").first();
    if (await roomSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await roomSelect.selectOption({ index: 1 }).catch(() => null);
    }
    await page.getByTestId("create-reservation-checkIn").first().fill(checkInStr).catch(() => null);
    await page.getByTestId("create-reservation-checkOut").first().fill(checkOutStr).catch(() => null);
    await page.getByTestId("create-reservation-guest").first().fill("Jan Kowalski-Szkolenie").catch(() => null);
    await page.waitForTimeout(400);
    await shot("06-new-reservation-form.png");

    // --- 07: Zapisana rezerwacja ---
    console.log("07-reservation-saved.png");
    const saveBtn = page.getByTestId("create-reservation-save");
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(3500);
      await page.keyboard.press("Escape").catch(() => null);
      await page.waitForTimeout(500);
    }
    await shot("07-reservation-saved.png");

    // --- 08: Check-in przed meldunkiem ---
    console.log("08-checkin-before.png");
    const barConfirmed = page.locator('[data-testid="reservation-bar"]').filter({ hasText: /CONFIRMED|Potwierdz|Szkolenie|Kowal|Nowak|Wiśniewska/i }).first();
    const barAny = page.locator('[data-testid="reservation-bar"]').first();
    const bar = (await barConfirmed.isVisible({ timeout: 3000 }).catch(() => false)) ? barConfirmed : barAny;
    if (await bar.isVisible({ timeout: 5000 }).catch(() => false)) {
      await bar.dblclick({ force: true });
      await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
      const meldTab = page.getByRole("tab", { name: /Meld\.|Meldunek/i });
      if (await meldTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await meldTab.click();
        await page.waitForTimeout(800);
      }
      await shot("08-checkin-before.png");
    } else {
      await shot("08-checkin-before.png");
    }

    // --- 09: Check-in po meldunku ---
    console.log("09-checkin-after.png");
    const meldujBtn = page.getByRole("button", { name: /Melduj gościa|Zamelduj/i }).first();
    if (await meldujBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await meldujBtn.click();
      await page.waitForTimeout(2500);
    }
    await shot("09-checkin-after.png");
    await page.keyboard.press("Escape").catch(() => null);
    await page.waitForTimeout(500);

    // --- 10: Zmiana pokoju ---
    console.log("10-room-change.png");
    const barCheckedIn = page.locator('[data-testid="reservation-bar"]').filter({ hasText: /CHECKED_IN|Zameld|Szkolenie|Nowak|Maria/i }).first();
    const bar2 = (await barCheckedIn.isVisible({ timeout: 3000 }).catch(() => false)) ? barCheckedIn : page.locator('[data-testid="reservation-bar"]').first();
    if (await bar2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bar2.dblclick({ force: true });
      await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
      const roomSelect = page.locator("#uni-room, [data-testid='create-reservation-room']").first();
      if (await roomSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await roomSelect.click();
        await page.waitForTimeout(400);
      }
      await shot("10-room-change.png");
    } else {
      await shot("10-room-change.png");
    }
    await page.keyboard.press("Escape").catch(() => null);
    await page.waitForTimeout(500);

    // --- 11: Checkout — rachunek ---
    console.log("11-checkout-bill.png");
    await scrollTapeChart(page, 3);
    // Otwórz rezerwację z saldem (PARTIAL/UNPAID) — te z demo mają obciążenia
    const barWithBalance = page.locator('[data-testid="reservation-bar"]').filter({ hasText: /Wójcik|Dąbrowska|Szkolenie|Maria|Piotr|Anna/i }).first();
    const bar3 = (await barWithBalance.isVisible({ timeout: 2000 }).catch(() => false)) ? barWithBalance : page.locator('[data-testid="reservation-bar"]').first();
    if (await bar3.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bar3.dblclick({ force: true });
      await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
      const rozliczTab = page.getByRole("tab", { name: /Rozlicz/i });
      if (await rozliczTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await rozliczTab.click();
        await page.waitForTimeout(1200);
      }
      await shot("11-checkout-bill.png");
    } else {
      await shot("11-checkout-bill.png");
    }

    // --- 12: Metoda płatności ---
    console.log("12-payment-method.png");
    const paymentSelect = page.locator('select').filter({ has: page.locator('option[value="CASH"]') }).first();
    if (await paymentSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await paymentSelect.click();
      await page.waitForTimeout(300);
    }
    const zapłaconoBtn = page.getByRole("button", { name: /Zapłacono/i }).first();
    const amtInput = zapłaconoBtn.locator("xpath=preceding-sibling::input[1]").or(page.locator('input[type="number"]').first());
    if (await amtInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await amtInput.fill("50");
      await page.waitForTimeout(300);
    }
    await shot("12-payment-method.png");

    // --- 13: Potwierdzona płatność ---
    console.log("13-payment-success.png");
    const zapiszWplateBtn = page.getByRole("button", { name: /Zapisz wpłatę/i }).first();
    const isEnabled = await zapiszWplateBtn.isVisible({ timeout: 2000 }).catch(() => false) &&
      !(await zapiszWplateBtn.isDisabled().catch(() => true));
    if (isEnabled) {
      await zapiszWplateBtn.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
    }
    await shot("13-payment-success.png");
    await page.keyboard.press("Escape").catch(() => null);
    await page.waitForTimeout(500);

    // --- 14: Błąd systemowy ---
    console.log("14-system-error.png");
    await page.goto(`${BASE_URL}/nieistniejaca-strona-bledna-404`, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(1200);
    await shot("14-system-error.png");

    const files = await readdir(SCREENSHOTS_DIR);
    const created = files.filter((f) => TARGET_FILES.includes(f)).sort();

    console.log("\n--- Wykonane screenshoty ---");
    TARGET_FILES.forEach((f) => console.log(`  ${f}`));
    console.log(`\nRazem: ${created.length} plików w ${SCREENSHOTS_DIR}`);
  } finally {
    await browser.close();
    if (shouldStartServer) {
      stopDevServer();
      console.log("\nSerwer zatrzymany.");
    }
  }
}

main().catch((err) => {
  console.error(err);
  stopDevServer();
  process.exit(1);
});
