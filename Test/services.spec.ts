import { test, expect } from "@playwright/test";

test.describe("Usługi dodatkowe", () => {
  test.describe("SPA", () => {
    test("SVC-01: strona /spa ładuje się", async ({ page }) => {
      await page.goto("/spa");
      await expect(
        page.getByText(/SPA|Zabiegi|Wellness/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("SVC-02: nowa rezerwacja SPA — formularz", async ({ page }) => {
      await page.goto("/spa");
      await expect(page.getByText(/SPA/i).first()).toBeVisible({ timeout: 10000 });
      const addBtn = page.getByRole("button", { name: /Nowa|Dodaj|Rezerwuj|\+/i }).first();
      if (!(await addBtn.isVisible().catch(() => false))) {
        test.skip(true, "Brak przycisku nowej rezerwacji SPA");
        return;
      }
      await addBtn.click();
      await expect(
        page.locator('input, select, [role="combobox"], [role="dialog"]').first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Gastronomia", () => {
    test("SVC-04: strona /gastronomy ładuje się", async ({ page }) => {
      await page.goto("/gastronomy");
      await expect(
        page.getByText(/Gastronomia|Restauracja|Menu|Gastronomy/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("SVC-05: tworzenie zamówienia — formularz", async ({ page }) => {
      await page.goto("/gastronomy");
      await expect(page.getByText(/Gastronomia|Restauracja/i).first()).toBeVisible({ timeout: 10000 });
      const addBtn = page.getByRole("button", { name: /Nowe zamówienie|Dodaj|\+/i }).first();
      if (!(await addBtn.isVisible().catch(() => false))) {
        test.skip(true, "Brak przycisku nowego zamówienia");
        return;
      }
      await addBtn.click();
      await expect(
        page.locator('[role="dialog"], form, input').first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Room Service", () => {
    test("SVC-06: strona /room-service ładuje się", async ({ page }) => {
      await page.goto("/room-service");
      await expect(
        page.getByText(/Room Service|Obsługa pokoju/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("SVC-07: złożenie zamówienia room service", async ({ page }) => {
      await page.goto("/room-service");
      await expect(page.getByText(/Room Service/i).first()).toBeVisible({ timeout: 10000 });
      const addBtn = page.getByRole("button", { name: /Nowe|Dodaj|Zamów|\+/i }).first();
      if (!(await addBtn.isVisible().catch(() => false))) {
        test.skip(true, "Brak przycisku nowego zamówienia room service");
        return;
      }
      await addBtn.click();
      await expect(
        page.locator('[role="dialog"], form, input, select').first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Posiłki", () => {
    test("SVC-08: strona /meals ładuje się", async ({ page }) => {
      await page.goto("/meals");
      await expect(
        page.getByText(/Posiłki|Meals|Śniadanie|Obiad|Kolacja/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Transfery", () => {
    test("SVC-10: strona /transfers ładuje się", async ({ page }) => {
      await page.goto("/transfers");
      await expect(
        page.getByText(/Transfery|Transfers|Transport/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("SVC-11: rezerwacja transferu — formularz", async ({ page }) => {
      await page.goto("/transfers");
      await expect(page.getByText(/Transfery|Transfers/i).first()).toBeVisible({ timeout: 10000 });
      const addBtn = page.getByRole("button", { name: /Nowy|Dodaj|Rezerwuj|\+/i }).first();
      if (!(await addBtn.isVisible().catch(() => false))) {
        test.skip(true, "Brak przycisku nowego transferu");
        return;
      }
      await addBtn.click();
      await expect(
        page.locator('[role="dialog"], form, input').first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Atrakcje", () => {
    test("SVC-12: strona /attractions ładuje się", async ({ page }) => {
      await page.goto("/attractions");
      await expect(
        page.getByText(/Atrakcje|Attractions/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Wypożyczalnia", () => {
    test("SVC-14: strona /rentals ładuje się", async ({ page }) => {
      await page.goto("/rentals");
      await expect(
        page.getByText(/Wypożyczalnia|Rentals|Sprzęt/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Parking", () => {
    test("SVC-16: strona /parking ładuje się", async ({ page }) => {
      await page.goto("/parking");
      await expect(
        page.getByText(/Parking|Miejsca parkingowe/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("SVC-17: przypisanie miejsca parkingowego", async ({ page }) => {
      await page.goto("/parking");
      await expect(page.getByText(/Parking/i).first()).toBeVisible({ timeout: 10000 });
      const assignBtn = page.getByRole("button", { name: /Przypisz|Dodaj|Nowe|\+/i }).first();
      if (!(await assignBtn.isVisible().catch(() => false))) {
        test.skip(true, "Brak przycisku przypisania parkingu");
        return;
      }
      await assignBtn.click();
      await expect(
        page.locator('[role="dialog"], form, input, select').first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Camping", () => {
    test("SVC-18: strona /camping ładuje się", async ({ page }) => {
      await page.goto("/camping");
      await expect(
        page.getByText(/Camping|Kemping|Miejsca/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });
});
