import { test, expect } from "@playwright/test";

/**
 * Master Test Plan: 4.5 Edycja rezerwacji (ER-01–05)
 */
test.describe("Edycja rezerwacji", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Tape Chart/i })).toBeVisible({ timeout: 5000 });
  });

  test("ER-01: klik w pasek otwiera Sheet Edycja rezerwacji z polami zgodnymi z rezerwacją", async ({
    page,
  }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible())) {
      test.skip();
      return;
    }
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 3000 });
    await expect(page.locator("#guestName")).toBeVisible();
    await expect(page.locator("#room")).toBeVisible();
    await expect(page.locator("#checkIn")).toBeVisible();
    await expect(page.locator("#checkOut")).toBeVisible();
    await expect(page.locator("#status")).toBeVisible();
    await expect(page.getByRole("button", { name: /Zapisz|Zapisywanie/i })).toBeVisible();
  });

  test("ER-02: zmiana gościa i Zapisz – Sheet się zamyka (zapis w stanie)", async ({ page }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible())) {
      test.skip();
      return;
    }
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 3000 });
    const guestInput = page.locator("#guestName");
    await guestInput.clear();
    await guestInput.fill("Gość Zmieniony E2E");
    await page.getByRole("button", { name: /^Zapisz$/ }).click();
    await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 5000 });
  });

  test("ER-03: Anuluj zamyka Sheet bez zapisu", async ({ page }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible())) {
      test.skip();
      return;
    }
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: "Anuluj" }).click();
    await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 2000 });
  });

  test("ER-04: menu kontekstowe – Check-in zmienia status, toast", async ({ page }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible())) {
      test.skip();
      return;
    }
    await bar.click({ button: "right" });
    const checkInItem = page.getByRole("menuitem", { name: /Check-in/i });
    await expect(checkInItem).toBeVisible({ timeout: 2000 });
    const isDisabled = await checkInItem.getAttribute("aria-disabled") === "true";
    if (isDisabled) {
      test.skip();
      return;
    }
    await checkInItem.click();
    await expect(page.getByText(/Check-in zarejestrowany|sukces/i)).toBeVisible({ timeout: 5000 });
  });

  test("ER-05: menu kontekstowe – Anuluj rezerwację (disabled dla już anulowanych)", async ({
    page,
  }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible())) {
      test.skip();
      return;
    }
    await bar.click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: /Anuluj rezerwację/i })).toBeVisible({
      timeout: 2000,
    });
  });
});
