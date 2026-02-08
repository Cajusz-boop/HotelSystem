import { test, expect } from "@playwright/test";

test.describe("Pełny flow meldunku", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/check-in");
    await expect(page.getByRole("heading", { name: /Meldunek gościa/i })).toBeVisible();
  });

  test("minimalny meldunek: tylko imię i nazwisko → submit → toast + formularz wyczyszczony", async ({
    page,
  }) => {
    await page.getByLabel("Imię i nazwisko").fill("Nowak, Anna");
    await page.getByRole("button", { name: "Zapisz gościa / Utwórz rezerwację" }).click();

    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 8000 });

    const nameInput = page.locator("#name");
    await expect(nameInput).toHaveValue("");
  });

  test("meldunek z pełnymi danymi (imię, email, telefon) → submit → toast", async ({
    page,
  }) => {
    await page.getByLabel("Imię i nazwisko").fill("Testowy, Gość");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Telefon").fill("+48 123 456 789");
    await page.getByRole("button", { name: "Zapisz gościa / Utwórz rezerwację" }).click();

    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 8000 });
  });

  test("wpisanie MRZ i blur uzupełnia imię i nazwisko (z MRZ) → submit → toast", async ({
    page,
  }) => {
    await page.locator("#mrz").fill("IDPOLKOWALSKI<<JAN<<<<<<<<<<<<<<<<<<<<<<<");
    await page.locator("#mrz").blur();

    const nameInput = page.locator("#name");
    await expect(nameInput).toHaveValue("IDPOLKOWALSKI, JAN");

    await page.getByRole("button", { name: "Zapisz gościa / Utwórz rezerwację" }).click();
    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 8000 });
  });

  test("po udanym meldunku formularz jest pusty (Parse & Forget – dane nie zostają)", async ({
    page,
  }) => {
    await page.getByLabel("Imię i nazwisko").fill("Jednorazowy, Gość");
    await page.getByRole("button", { name: "Zapisz gościa / Utwórz rezerwację" }).click();

    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 8000 });

    await expect(page.locator("#name")).toHaveValue("");
    await expect(page.locator("#email")).toHaveValue("");
    await expect(page.locator("#phone")).toHaveValue("");
    await expect(page.locator("#mrz")).toHaveValue("");
  });

  test("puste imię i nazwisko – submit nie tworzy rezerwacji (walidacja HTML)", async ({
    page,
  }) => {
    const submitBtn = page.getByRole("button", { name: "Zapisz gościa / Utwórz rezerwację" });
    await submitBtn.click();

    await expect(page.getByText("Rezerwacja utworzona.")).not.toBeVisible({ timeout: 2000 });
    await expect(page).toHaveURL(/\/check-in/);
  });

  test("po meldunku przejście na Grafik – Tape Chart ładuje się z nową rezerwacją", async ({
    page,
  }) => {
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Tape Chart/i })).toBeVisible({ timeout: 5000 });
    const barsBefore = await page.getByTestId("reservation-bar").count();

    await page.goto("/check-in");
    await page.getByLabel("Imię i nazwisko").fill(`E2E Meldunek ${Date.now()}`);
    await page.getByRole("button", { name: "Zapisz gościa / Utwórz rezerwację" }).click();
    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 8000 });

    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Tape Chart/i })).toBeVisible({ timeout: 5000 });
    const barsAfter = await page.getByTestId("reservation-bar").count();
    expect(barsAfter).toBeGreaterThan(barsBefore);
  });
});
