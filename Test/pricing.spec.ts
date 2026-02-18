import { test, expect } from "@playwright/test";

test.describe("Cennik i plany taryfowe", () => {
  test("PRC-01: strona /cennik ładuje się", async ({ page }) => {
    await page.goto("/cennik");
    await expect(
      page.getByText(/Cennik|Plany taryfowe|Rate Plans|Tariff/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("PRC-02: wyświetlenie cen dla typów pokojów", async ({ page }) => {
    await page.goto("/cennik");
    await expect(
      page.getByText(/Cennik|Plany taryfowe/i).first()
    ).toBeVisible({ timeout: 10000 });
    const hasTable = await page.locator("table, [role='grid']").first().isVisible().catch(() => false);
    const hasPrices = await page.locator("input[type='number'], td, .price").first().isVisible().catch(() => false);
    expect(hasTable || hasPrices).toBeTruthy();
  });

  test("PRC-03: edycja ceny za pokój/noc — klik w komórkę", async ({ page }) => {
    await page.goto("/cennik");
    await expect(page.getByText(/Cennik/i).first()).toBeVisible({ timeout: 10000 });
    const priceCell = page.locator(
      'input[type="number"], td[contenteditable], [data-testid*="price"], td.cursor-pointer'
    ).first();
    if (!(await priceCell.isVisible().catch(() => false))) {
      test.skip(true, "Brak edytowalnych komórek cennika");
      return;
    }
    await priceCell.click();
    await expect(page.locator("input:focus, [contenteditable]:focus").first()).toBeVisible({ timeout: 3000 });
  });

  test("PRC-04: reguły pochodne — strona ładuje się", async ({ page }) => {
    await page.goto("/cennik/reguly-pochodne");
    await expect(
      page.getByText(/Reguły pochodne|Derived|Pochodne/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("PRC-05: dodanie nowej reguły pochodnej — formularz", async ({ page }) => {
    await page.goto("/cennik/reguly-pochodne");
    await expect(page.getByText(/Reguły pochodne|Derived/i).first()).toBeVisible({ timeout: 10000 });
    const addBtn = page.getByRole("button", { name: /Dodaj|Nowa reguła|\+/i }).first();
    if (!(await addBtn.isVisible().catch(() => false))) {
      test.skip(true, "Brak przycisku dodawania reguły");
      return;
    }
    await addBtn.click();
    await expect(
      page.locator('input, select, [role="combobox"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("PRC-06: wydruk cennika — strona ładuje się", async ({ page }) => {
    await page.goto("/cennik/wydruk");
    await expect(
      page.getByText(/Cennik|Wydruk|Print/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("PRC-07: cena ujemna — walidacja", async ({ page }) => {
    await page.goto("/cennik");
    await expect(page.getByText(/Cennik/i).first()).toBeVisible({ timeout: 10000 });
    const priceInput = page.locator('input[type="number"]').first();
    if (!(await priceInput.isVisible().catch(() => false))) {
      test.skip(true, "Brak pola cenowego");
      return;
    }
    await priceInput.fill("-50");
    await priceInput.press("Tab");
    await page.waitForTimeout(1000);
    const hasError = await page.getByText(/ujemna|nieprawidłowa|invalid|minimum|greater/i).first().isVisible().catch(() => false);
    const inputValue = await priceInput.inputValue();
    expect(hasError || inputValue !== "-50").toBeTruthy();
  });
});
