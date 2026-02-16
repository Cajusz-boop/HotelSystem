import { test, expect } from "@playwright/test";

/**
 * Testy dropdownów w dialogach (Radix Select wewnątrz Dialog)
 *
 * Pokrywa błędy:
 * - Nakładanie się warstw (z-index) – dropdown zasłaniany przez dialog
 * - Opcje w dropdown muszą być widoczne i klikalne
 * - Po wyborze opcji wartość jest ustawiona poprawnie
 */
test.describe("Dropdowny w dialogach", () => {
  test.describe("Dialog: Dodaj użytkownika", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/ustawienia/uzytkownicy");
      await expect(
        page.getByRole("heading", { name: /Użytkownicy/i })
      ).toBeVisible({ timeout: 10000 });
    });

    test("DLG-01: select „Rola" w dialogu otwiera się i wyświetla opcje nad formularzem", async ({
      page,
    }) => {
      await page.getByRole("button", { name: /Dodaj użytkownika/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

      const trigger = page.getByRole("dialog").getByRole("combobox");
      await expect(trigger).toBeVisible();
      await trigger.click();

      await expect(
        page.getByRole("option", { name: "Recepcja" })
      ).toBeVisible({ timeout: 3000 });
      await expect(
        page.getByRole("option", { name: "Manager" })
      ).toBeVisible();
      await expect(
        page.getByRole("option", { name: "Housekeeping" })
      ).toBeVisible();
      await expect(
        page.getByRole("option", { name: "Właściciel" })
      ).toBeVisible();
    });

    test("DLG-02: można wybrać każdą rolę z listy", async ({ page }) => {
      await page.getByRole("button", { name: /Dodaj użytkownika/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

      const roles = ["Recepcja", "Manager", "Housekeeping", "Właściciel"];

      for (const role of roles) {
        const trigger = page.getByRole("dialog").getByRole("combobox");
        await trigger.click();

        const option = page.getByRole("option", { name: role });
        await expect(option).toBeVisible({ timeout: 3000 });
        await option.click();

        await expect(trigger).toContainText(role);
      }
    });

    test("DLG-03: po wyborze roli przycisk „Utwórz" jest widoczny i dostępny", async ({
      page,
    }) => {
      await page.getByRole("button", { name: /Dodaj użytkownika/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

      const trigger = page.getByRole("dialog").getByRole("combobox");
      await trigger.click();
      await page.getByRole("option", { name: "Manager" }).click();

      const createBtn = page.getByRole("dialog").getByRole("button", { name: /Utwórz/i });
      await expect(createBtn).toBeVisible();
      await expect(createBtn).toBeEnabled();
    });

    test("DLG-04: dropdown roli nie zasłania pola „Hasło"", async ({
      page,
    }) => {
      await page.getByRole("button", { name: /Dodaj użytkownika/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

      const trigger = page.getByRole("dialog").getByRole("combobox");
      await trigger.click();

      await expect(
        page.getByRole("option", { name: "Recepcja" })
      ).toBeVisible({ timeout: 3000 });

      const lastOption = page.getByRole("option", { name: "Właściciel" });
      await expect(lastOption).toBeVisible();

      await lastOption.click();
      await expect(trigger).toContainText("Właściciel");

      const passwordInput = page.getByRole("dialog").locator("#add-password");
      await expect(passwordInput).toBeVisible();
      await passwordInput.click();
      await expect(passwordInput).toBeFocused();
    });
  });
});
