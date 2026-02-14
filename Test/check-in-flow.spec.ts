import { test, expect } from "@playwright/test";
import {
  computeStayOffset,
  openCheckInPage,
  prepareAvailableRoom,
} from "./utils/check-in-helpers";

test.describe("Pełny flow meldunku", () => {
  let stayOffsetDays = 7;

  test.beforeEach(async ({ page }, testInfo) => {
    stayOffsetDays = computeStayOffset(testInfo);
    await openCheckInPage(page);
    await prepareAvailableRoom(page, stayOffsetDays);
  });

  test("minimalny meldunek: tylko imię i nazwisko → submit → toast + formularz wyczyszczony", async ({
    page,
  }) => {
    await page.getByLabel("Imię i nazwisko").fill("Nowak, Anna");
    const submitBtn = page.getByRole("button", { name: "Zapisz gościa / Utwórz rezerwację" });
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await submitBtn.click();

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
    const submitBtn = page.getByRole("button", { name: "Zapisz gościa / Utwórz rezerwację" });
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await submitBtn.click();

    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 8000 });
  });

  test("wpisanie MRZ i blur uzupełnia imię i nazwisko (z MRZ) → submit → toast", async ({
    page,
  }) => {
    await page.locator("#mrz").fill("IDPOLKOWALSKI<<JAN<<<<<<<<<<<<<<<<<<<<<<<");
    await page.locator("#mrz").blur();

    const nameInput = page.locator("#name");
    await expect(nameInput).toHaveValue("IDPOLKOWALSKI, JAN");

    const submitBtn = page.getByRole("button", { name: "Zapisz gościa / Utwórz rezerwację" });
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await submitBtn.click();
    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 8000 });
  });

  test("po udanym meldunku formularz jest pusty (Parse & Forget – dane nie zostają)", async ({
    page,
  }) => {
    await page.getByLabel("Imię i nazwisko").fill("Jednorazowy, Gość");
    const submitBtn = page.getByRole("button", { name: "Zapisz gościa / Utwórz rezerwację" });
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await submitBtn.click();

    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 8000 });

    await expect(page.locator("#name")).toHaveValue("");
    await expect(page.locator("#email")).toHaveValue("");
    await expect(page.locator("#phone")).toHaveValue("");
    await expect(page.locator("#mrz")).toHaveValue("");
  });

  test("wpisanie NIP (10 cyfr) → auto-uzupełnienie danych firmy bez klikania Pobierz dane", async ({
    page,
  }) => {
    // Firma 5711640854 jest w seedzie – lookup trafi do DB, bez API WL
    await page.locator("#nip").fill("5711640854");
    await page.waitForTimeout(1200);
    await expect(page.getByText("Dane firmy wczytane", { exact: false })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator("#companyName")).toBeVisible();
    await expect(page.locator("#companyName")).toHaveValue(/KARCZMA|ŁABĘDŹ|WOJENKOWSKI/i);
  });

  test("puste imię i nazwisko – submit nie tworzy rezerwacji (walidacja HTML)", async ({
    page,
  }) => {
    const submitBtn = page.getByRole("button", { name: "Zapisz gościa / Utwórz rezerwację" });
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await submitBtn.click();

    await expect(page.getByText("Rezerwacja utworzona.")).not.toBeVisible({ timeout: 2000 });
    await expect(page).toHaveURL(/\/check-in/);
  });

  test("po meldunku przejście na Grafik – Tape Chart ładuje się z nową rezerwacją", async ({
    page,
  }) => {
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Grafik/i })).toBeVisible({ timeout: 5000 });
    const barsBefore = await page.getByTestId("reservation-bar").count();

    await openCheckInPage(page);
    await prepareAvailableRoom(page, stayOffsetDays);
    await page.getByLabel("Imię i nazwisko").fill(`E2E Meldunek ${Date.now()}`);
    const submitBtn = page.getByRole("button", { name: "Zapisz gościa / Utwórz rezerwację" });
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await submitBtn.click();
    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 8000 });

    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Grafik/i })).toBeVisible({ timeout: 5000 });
    const barsAfter = await page.getByTestId("reservation-bar").count();
    expect(barsAfter).toBeGreaterThan(barsBefore);
  });
});
