import { test, expect, type Page } from "@playwright/test";

/**
 * Ogólne testy sortowania danych w tabelach.
 *
 * Pokrywa błędy:
 * - Sortowanie numeryczne vs. alfabetyczne (1, 2, 3… zamiast 1, 10, 11…)
 * - Zachowanie kolejności po dodaniu/edycji rekordu
 */

async function getNumericColumnValues(
  page: Page,
  selector: string
): Promise<number[]> {
  const texts = await page.locator(selector).allInnerTexts();
  return texts
    .map((t) => parseInt(t.trim(), 10))
    .filter((n) => !isNaN(n));
}

function isSortedAscending(values: number[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[i - 1]) return false;
  }
  return true;
}

test.describe("Sortowanie danych w tabelach", () => {
  test.describe("Pokoje – /pokoje", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/pokoje");
      await expect(
        page.getByRole("heading", { name: /Pokoje/i })
      ).toBeVisible({ timeout: 10000 });
      await expect(page.locator("table tbody tr").first()).toBeVisible({
        timeout: 10000,
      });
    });

    test("SORT-01: numery pokoi są posortowane rosnąco numerycznie", async ({
      page,
    }) => {
      const numbers = await getNumericColumnValues(
        page,
        "table tbody tr td:first-child span"
      );

      expect(numbers.length).toBeGreaterThan(1);
      expect(
        isSortedAscending(numbers),
        `Kolejność pokoi powinna być numerycznie rosnąca, otrzymano: [${numbers.join(", ")}]`
      ).toBe(true);
    });

    test("SORT-02: po dodaniu pokoju kolejność numeryczna jest zachowana", async ({
      page,
    }) => {
      const numbersBefore = await getNumericColumnValues(
        page,
        "table tbody tr td:first-child span"
      );

      const testRoomNumber = "9999";

      const numberInput = page.locator("form").getByPlaceholder(/np\. 101/i);
      await expect(numberInput).toBeVisible({ timeout: 5000 });
      await numberInput.fill(testRoomNumber);

      const typeSelect = page.locator("form select").first();
      if (await typeSelect.isVisible()) {
        const firstOption = await typeSelect.locator("option").nth(1).getAttribute("value");
        if (firstOption) {
          await typeSelect.selectOption(firstOption);
        }
      }

      await page.getByRole("button", { name: /Dodaj pokój/i }).click();

      await page.waitForTimeout(2000);

      const numbersAfter = await getNumericColumnValues(
        page,
        "table tbody tr td:first-child span"
      );

      expect(numbersAfter.length).toBeGreaterThanOrEqual(numbersBefore.length);
      expect(
        isSortedAscending(numbersAfter),
        `Po dodaniu pokoju ${testRoomNumber} kolejność powinna być numeryczna: [${numbersAfter.join(", ")}]`
      ).toBe(true);
    });
  });
});
