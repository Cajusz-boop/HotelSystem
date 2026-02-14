import { expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

export const addDaysFromToday = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export async function openCheckInPage(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto("/check-in", { waitUntil: "domcontentloaded" });
    const heading = page.getByRole("heading", { name: /Meldunek gościa/i });
    try {
      await heading.waitFor({ state: "visible", timeout: 7000 });
      await page.waitForTimeout(200);
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(800);
    }
  }
}

export async function prepareAvailableRoom(page: Page, startOffsetDays: number): Promise<void> {
  const checkInDate = addDaysFromToday(startOffsetDays);
  const checkOutDate = addDaysFromToday(startOffsetDays + 2);
  const result = await page.evaluate(
    ({ checkIn, checkOut }) => {
      const checkInInput = document.querySelector<HTMLInputElement>("#checkIn");
      const checkOutInput = document.querySelector<HTMLInputElement>("#checkOut");
      if (checkInInput) {
        checkInInput.value = checkIn;
        checkInInput.dispatchEvent(new Event("input", { bubbles: true }));
        checkInInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (checkOutInput) {
        checkOutInput.value = checkOut;
        checkOutInput.dispatchEvent(new Event("input", { bubbles: true }));
        checkOutInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return {
        afterIn: checkInInput?.value ?? null,
        afterOut: checkOutInput?.value ?? null,
      };
    },
    { checkIn: checkInDate, checkOut: checkOutDate }
  );

  await expect
    .poll(async () => {
      const options = await page.locator("#room option").allTextContents();
      return options.filter((text) => !/Brak wolnych pokoi/i.test(text)).length;
    }, { timeout: 45000 })
    .toBeGreaterThan(0);

  const firstOption = page.locator("#room option").first();
  const firstValue = await firstOption.getAttribute("value");

  if (!firstValue) {
    throw new Error("Nie znaleziono wolnego pokoju do wyboru.");
  }

  await page.selectOption("#room", firstValue);
}

export const computeStayOffset = (testInfo: TestInfo): number => {
  const projectName = testInfo.project.name.toLowerCase();
  const projectOffset = projectName.includes("firefox")
    ? 10
    : projectName.includes("webkit")
      ? 20
      : 0;
  return 7 + projectOffset + testInfo.workerIndex * 3;
};
