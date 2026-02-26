import { chromium, type FullConfig } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const AUTH_FILE = ".auth/user.json";

async function globalSetup(config: FullConfig) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? config.projects[0]?.use?.baseURL ?? "http://localhost:3011";
  await mkdir(dirname(AUTH_FILE), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.addInitScript(() => {
    localStorage.setItem("pms-onboarding-seen", "1");
  });

  try {
    await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForLoadState("networkidle").catch(() => null);

    if (!page.url().includes("/login")) {
      // authDisabled=true — przekierowano na /, nie trzeba się logować
      await page.goto(`${baseURL}/front-office`, { waitUntil: "domcontentloaded", timeout: 15000 });
    } else {
      // Formularz logowania widoczny — zaloguj się
      await page.getByLabel(/Email/i).waitFor({ state: "visible", timeout: 10000 });
      await page.getByLabel(/Email/i).fill("admin@hotel.local");
      await page.getByRole("textbox", { name: /Hasło|Password/i }).fill("admin123");
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState("networkidle").catch(() => null);
      await Promise.race([
        page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }),
        page.locator('a[href="/front-office"]').first().waitFor({ state: "visible", timeout: 30000 }),
      ]);
      await page.goto(`${baseURL}/front-office`, { waitUntil: "domcontentloaded", timeout: 15000 });
    }

    await page.waitForSelector('[data-testid="room-row-101"]', { timeout: 15000 }).catch(() => null);
    await page.context().storageState({ path: AUTH_FILE });
    console.log("Auth state saved to", AUTH_FILE);
  } catch (e) {
    console.error("Global setup (auth) failed:", e);
    throw e;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
