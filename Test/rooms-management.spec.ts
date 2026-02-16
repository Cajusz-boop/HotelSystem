import { test, expect } from "@playwright/test";

/**
 * Testy zarządzania pokojami – /pokoje
 *
 * Pokrywa błędy:
 * - Sortowanie numeryczne (1, 2, 3… zamiast 1, 10, 11…)
 * - Pole „Piętro" musi być <select>, nie <input>
 * - Dropdown pięter musi mieć opcje (nie może być pusty)
 * - Pole „Widok" musi być <select>
 * - Pole „Budynek" jest <input> (brak konfiguracji budynków)
 */
test.describe("Pokoje – zarządzanie", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pokoje");
    await expect(
      page.getByRole("heading", { name: /Pokoje/i })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10000 });
  });

  test("ROOM-01: pokoje są posortowane numerycznie (1, 2, 3… nie 1, 10, 11…)", async ({
    page,
  }) => {
    const cells = page.locator("table tbody tr td:first-child span");
    const texts = await cells.allInnerTexts();
    const numbers = texts
      .map((t) => parseInt(t.trim(), 10))
      .filter((n) => !isNaN(n));

    expect(numbers.length).toBeGreaterThan(1);

    for (let i = 1; i < numbers.length; i++) {
      expect(
        numbers[i],
        `Pokój ${numbers[i]} powinien być po ${numbers[i - 1]}`
      ).toBeGreaterThanOrEqual(numbers[i - 1]);
    }
  });

  test("ROOM-02: kolumna „Piętro" otwiera <select>, a nie <input>", async ({
    page,
  }) => {
    const firstRow = page.locator("table tbody tr").first();
    const floorCell = firstRow.locator("td").nth(5);

    await floorCell.locator("span").click();

    await expect(floorCell.locator("select")).toBeVisible({ timeout: 3000 });
    await expect(floorCell.locator("input")).not.toBeVisible();
  });

  test("ROOM-03: select „Piętro" zawiera opcje (nie jest pusty)", async ({
    page,
  }) => {
    const firstRow = page.locator("table tbody tr").first();
    const floorCell = firstRow.locator("td").nth(5);

    await floorCell.locator("span").click();

    const floorSelect = floorCell.locator("select");
    await expect(floorSelect).toBeVisible({ timeout: 3000 });

    const options = floorSelect.locator("option");
    const count = await options.count();

    expect(
      count,
      "Select „Piętro" powinien mieć co najmniej 2 opcje (— brak — + piętra)"
    ).toBeGreaterThan(1);
  });

  test("ROOM-04: wybranie piętra z listy zapisuje wartość", async ({
    page,
  }) => {
    const firstRow = page.locator("table tbody tr").first();
    const floorCell = firstRow.locator("td").nth(5);

    await floorCell.locator("span").click();

    const floorSelect = floorCell.locator("select");
    await expect(floorSelect).toBeVisible({ timeout: 3000 });

    const options = floorSelect.locator("option");
    const count = await options.count();
    if (count <= 1) {
      test.skip(true, "Brak skonfigurowanych pięter – nie można przetestować zapisu");
      return;
    }

    const secondOptionValue = await options.nth(1).getAttribute("value");
    const secondOptionText = (await options.nth(1).innerText()).trim();
    if (!secondOptionValue) {
      test.skip(true, "Druga opcja nie ma wartości");
      return;
    }

    await floorSelect.selectOption(secondOptionValue);
    await floorSelect.blur();

    await expect(floorCell.locator("span")).toBeVisible({ timeout: 5000 });
    await expect(floorCell.locator("span")).toHaveText(secondOptionText);
  });

  test("ROOM-05: kolumna „Budynek" otwiera <input> (tekst swobodny)", async ({
    page,
  }) => {
    const firstRow = page.locator("table tbody tr").first();
    const buildingCell = firstRow.locator("td").nth(6);

    await buildingCell.locator("span").click();

    await expect(buildingCell.locator("input")).toBeVisible({ timeout: 3000 });
    await expect(buildingCell.locator("select")).not.toBeVisible();
  });

  test("ROOM-06: kolumna „Widok" otwiera <select> z opcjami", async ({
    page,
  }) => {
    const firstRow = page.locator("table tbody tr").first();
    const viewCell = firstRow.locator("td").nth(7);

    await viewCell.locator("span").click();

    const viewSelect = viewCell.locator("select");
    await expect(viewSelect).toBeVisible({ timeout: 3000 });
    await expect(viewCell.locator("input")).not.toBeVisible();

    const options = viewSelect.locator("option");
    const count = await options.count();
    expect(
      count,
      "Select „Widok" powinien mieć opcje (— brak — + widoki)"
    ).toBeGreaterThan(1);
  });
});
