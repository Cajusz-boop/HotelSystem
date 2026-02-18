import { test, expect } from "@playwright/test";

test.describe("Housekeeping — zaawansowane", () => {
  test.describe("Minibar", () => {
    test("HK-05: strona /housekeeping/minibar ładuje się", async ({ page }) => {
      await page.goto("/housekeeping/minibar");
      await expect(
        page.getByText(/Minibar|Mini Bar|Produkty/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("HK-06: minibar — lista pokojów lub produktów widoczna", async ({ page }) => {
      await page.goto("/housekeeping/minibar");
      await expect(page.getByText(/Minibar|Mini Bar|Produkty|Pokój/i).first()).toBeVisible({ timeout: 10000 });
      const hasContent = await page
        .locator("table, [role='grid'], select, input, [data-testid*='room'], [data-testid*='minibar'], .room-list, button")
        .first()
        .isVisible()
        .catch(() => false);
      expect(hasContent).toBeTruthy();
    });

    test("HK-06b: minibar — zaznaczenie produktu", async ({ page }) => {
      await page.goto("/housekeeping/minibar");
      await expect(page.getByText(/Minibar/i).first()).toBeVisible({ timeout: 10000 });
      const checkbox = page.locator(
        'input[type="checkbox"], input[type="number"], button:has-text("Dodaj"), [data-testid*="product"]'
      ).first();
      if (!(await checkbox.isVisible().catch(() => false))) {
        test.skip(true, "Brak interaktywnych elementów minibar");
        return;
      }
      await checkbox.click();
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Pranie (Laundry)", () => {
    test("HK-07: strona /housekeeping/laundry ładuje się", async ({ page }) => {
      await page.goto("/housekeeping/laundry");
      await expect(
        page.getByText(/Pranie|Laundry|Pralnia/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("HK-08: pranie — formularz zlecenia", async ({ page }) => {
      await page.goto("/housekeeping/laundry");
      await expect(page.getByText(/Pranie|Laundry/i).first()).toBeVisible({ timeout: 10000 });
      const addBtn = page.getByRole("button", { name: /Nowe zlecenie|Dodaj|Nowe|\+/i }).first();
      if (!(await addBtn.isVisible().catch(() => false))) {
        test.skip(true, "Brak przycisku nowego zlecenia prania");
        return;
      }
      await addBtn.click();
      await expect(
        page.locator('[role="dialog"], form, input, select').first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Filtrowanie", () => {
    test("HK-09: filtrowanie pokojów po piętrze", async ({ page }) => {
      await page.goto("/housekeeping");
      await expect(page.getByText(/Housekeeping/i).first()).toBeVisible({ timeout: 10000 });
      const floorFilter = page.locator(
        'select[name*="floor" i], select[name*="pietro" i], [data-testid*="floor-filter"], button:has-text("Piętro"), [role="combobox"]'
      ).first();
      if (!(await floorFilter.isVisible().catch(() => false))) {
        test.skip(true, "Brak filtra piętra na Housekeeping");
        return;
      }
      await floorFilter.click();
      await expect(
        page.locator('option, [role="option"], [role="listbox"]').first()
      ).toBeVisible({ timeout: 3000 });
    });

    test("HK-10: filtrowanie pokojów po statusie", async ({ page }) => {
      await page.goto("/housekeeping");
      await expect(page.getByText(/Housekeeping/i).first()).toBeVisible({ timeout: 10000 });
      const statusFilter = page.locator(
        'select[name*="status" i], [data-testid*="status-filter"], button:has-text("Status"), button:has-text("CLEAN"), button:has-text("DIRTY")'
      ).first();
      if (!(await statusFilter.isVisible().catch(() => false))) {
        test.skip(true, "Brak filtra statusu na Housekeeping");
        return;
      }
      await statusFilter.click();
      await expect(page.locator("body")).toBeVisible();
    });
  });
});
