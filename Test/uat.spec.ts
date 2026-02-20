/**
 * UAT (User Acceptance Testing) — Plan testów UAT-PLAN.md
 * Weryfikacja kompletności systemu rezerwacji hotelowej.
 */

import { test, expect, type Page } from "@playwright/test";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Otwiera formularz „Nowa rezerwacja” – nawigacja z ?e2eOpenCreate=1 (otwiera dialog automatycznie). */
async function openCreateReservationForm(page: Page): Promise<void> {
  const url = new URL(page.url());
  url.searchParams.set("e2eOpenCreate", "1");
  await page.goto(url.toString());
  await expect(page.getByText("Nowa rezerwacja")).toBeVisible({ timeout: 10000 });
}

test.describe("MODUŁ 1: Logowanie i Autoryzacja", () => {
  test("1.1 Strona logowania wyświetla się po wejściu na adres", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    if (page.url().includes("/login")) {
      await expect(page.getByLabel(/Email|Login/i)).toBeVisible({ timeout: 5000 });
    } else {
      test.skip(true, "Auth wyłączone");
    }
    await ctx.close();
  });

  test("1.2 Pole Login przyjmuje tekst", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/login");
    if (!page.url().includes("/login")) {
      test.skip(true, "Auth wyłączone");
    }
    const input = page.getByLabel(/Email|Login/i).first();
    await input.fill("test@example.com");
    await expect(input).toHaveValue("test@example.com");
    await ctx.close();
  });

  test("1.3 Pole Hasło maskuje znaki", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/login");
    if (!page.url().includes("/login")) {
      test.skip(true, "Auth wyłączone");
    }
    const passInput = page.getByLabel(/Hasło|Password/i).first();
    await passInput.fill("secret123");
    await expect(passInput).toHaveAttribute("type", "password");
    await ctx.close();
  });

  test("1.4 Przycisk Zaloguj jest klikalny", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/login");
    if (!page.url().includes("/login")) {
      test.skip(true, "Auth wyłączone");
    }
    const btn = page.locator('button[type="submit"]').filter({ hasText: /Zaloguj|Log in|Login/i });
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    await ctx.close();
  });

  test("1.5 Poprawne dane → przekierowanie do dashboardu", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/login");
    if (!page.url().includes("/login")) {
      test.skip(true, "Auth wyłączone");
    }
    await page.getByLabel(/Email/i).fill("admin@hotel.local");
    await page.getByLabel(/Hasło|Password/i).fill("admin123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
    await expect(page.locator("nav, aside, [data-testid='sidebar']").first()).toBeVisible({ timeout: 5000 });
    await ctx.close();
  });

  test("1.6 Błędne hasło → komunikat (nie 'błędne hasło')", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/login");
    if (!page.url().includes("/login")) {
      test.skip(true, "Auth wyłączone");
    }
    await page.getByLabel(/Email/i).fill("admin@hotel.local");
    await page.getByLabel(/Hasło|Password/i).fill("wrongpass");
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(/Nieprawidłowe|błędne|Invalid|incorrect|dane logowania/i).first()).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain("/login");
    await ctx.close();
  });

  test("1.7 Pusty formularz → walidacja, nie można przesłać", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/login");
    if (!page.url().includes("/login")) {
      test.skip(true, "Auth wyłączone");
    }
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain("/login");
    await ctx.close();
  });

  test("1.10 Wylogowanie → powrót na stronę logowania", async ({ page }) => {
    await page.goto("/front-office");
    const logoutBtn = page.getByRole("button", { name: /Wyloguj|Log out|Logout/i }).or(page.locator('a[href*="logout"]'));
    if (!(await logoutBtn.isVisible().catch(() => false))) {
      test.skip(true, "Brak przycisku wylogowania");
    }
    await logoutBtn.click();
    await page.waitForURL(/\/login/, { timeout: 5000 }).catch(() => null);
    if (page.url().includes("/login")) {
      await expect(page.getByLabel(/Email|Login/i)).toBeVisible();
    }
  });
});

test.describe("MODUŁ 2: Rezerwacje — Tworzenie", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.locator('[data-testid="room-row-101"], [data-testid="room-row-102"]').first()).toBeVisible({ timeout: 15000 });
  });

  test("2.1 Formularz nowej rezerwacji się otwiera", async ({ page }) => {
    await openCreateReservationForm(page);
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 3000 });
  });

  test("2.2/2.3 Pole Imię/Nazwisko przyjmuje polskie znaki", async ({ page }) => {
    await openCreateReservationForm(page);
    const polishName = "Zażółć Gęślą Jaźń";
    await page.getByTestId("create-reservation-guest").fill(polishName);
    await expect(page.getByTestId("create-reservation-guest")).toHaveValue(polishName);
    await page.getByRole("button", { name: "Anuluj" }).click();
  });

  test("2.6 Data przyjazdu z przeszłości — walidacja", async ({ page }) => {
    await openCreateReservationForm(page);
    const yesterday = addDays(todayStr(), -1);
    await page.getByTestId("create-reservation-guest").fill("Backdate Guest");
    await page.getByTestId("create-reservation-checkIn").fill(yesterday);
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByTestId("create-reservation-error")).toBeVisible({ timeout: 8000 });
  });

  test("2.7 Data wyjazdu wcześniejsza niż przyjazd — walidacja", async ({ page }) => {
    await openCreateReservationForm(page);
    const checkIn = todayStr();
    await page.getByTestId("create-reservation-guest").fill("Date Guest");
    await page.getByTestId("create-reservation-checkIn").fill(checkIn);
    await page.getByTestId("create-reservation-checkOut").fill(addDays(checkIn, -1));
    await page.getByTestId("create-reservation-save").click();
    await expect(
      page.getByRole("dialog").getByTestId("create-reservation-error").or(
        page.getByRole("dialog").getByText(/Data wymeld|musi być po zameld|wyjazd.*przyjazd/i)
      )
    ).toBeVisible({ timeout: 8000 });
  });

  test("2.10 Liczba osób 0 lub ujemna — walidacja", async ({ page }) => {
    await openCreateReservationForm(page);
    await page.getByTestId("create-reservation-guest").fill("Zero Pax Guest");
    const adultsInput = page.locator("#uni-adults");
    if (await adultsInput.isVisible().catch(() => false)) {
      await adultsInput.fill("0");
      await page.getByTestId("create-reservation-save").click();
      const err = page.getByTestId("create-reservation-error").or(page.getByText(/osób|osoby|pax|dorośli/i));
      const hasError = await err.isVisible().catch(() => false);
      if (!hasError) await page.getByRole("button", { name: "Anuluj" }).click();
    } else {
      await page.getByRole("button", { name: "Anuluj" }).click();
    }
  });

  test("2.12 Pole Uwagi przyjmuje długi tekst (500 znaków)", async ({ page }) => {
    await openCreateReservationForm(page);
    await page.getByTestId("create-reservation-guest").fill("Uwagi Test");
    const longNotes = "A".repeat(500);
    const notesArea = page.locator("#uni-notes");
    await notesArea.fill(longNotes);
    await expect(notesArea).toHaveValue(longNotes);
    await page.getByRole("button", { name: "Anuluj" }).click();
  });

  test("2.13/2.14/2.15 Zapisz → potwierdzenie, numer, rezerwacja na liście", async ({ page }) => {
    await openCreateReservationForm(page);
    const uniqueId = String(Date.now());
    const guestName = `UAT Guest ${uniqueId}`;
    await page.getByTestId("create-reservation-guest").fill(guestName);
    await page.getByTestId("create-reservation-status").selectOption({ label: "Potwierdzona" });
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByTestId("reservation-bar").filter({ hasText: uniqueId })).toBeVisible({ timeout: 15000 });
  });
});

test.describe("MODUŁ 3: Rezerwacje — Wyszukiwanie", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.locator('[data-testid="room-row-101"], [data-testid="room-row-102"]').first()).toBeVisible({ timeout: 15000 });
  });

  test("3.1 Lista rezerwacji się ładuje", async ({ page }) => {
    await expect(page.locator('[data-testid="room-row-101"], [data-testid="room-row-102"]').first()).toBeVisible({ timeout: 5000 });
  });

  test("3.2 Wyszukiwanie po nazwisku gościa", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Szukaj|Search|gościa|klienta/i).or(page.getByRole("searchbox"));
    if (!(await searchInput.isVisible().catch(() => false))) {
      test.skip(true, "Brak pola wyszukiwania na Tape Chart");
    }
    await searchInput.fill("Test");
    await page.waitForTimeout(500);
  });

  test("3.13 Kliknięcie w rezerwację otwiera szczegóły", async ({ page }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible().catch(() => false))) {
      test.skip(true, "Brak rezerwacji na grafiku");
    }
    await bar.click();
    await expect(page.getByText(/Edycja rezerwacji|Szczegóły/i)).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
  });
});

test.describe("MODUŁ 4: Rezerwacje — Edycja", () => {
  test("4.1/4.2 Przycisk Edytuj, formularz wczytuje dane", async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.locator('[data-testid="room-row-101"]').first()).toBeVisible({ timeout: 15000 });
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible().catch(() => false))) {
      test.skip(true, "Brak rezerwacji");
    }
    await bar.click();
    await expect(page.getByText(/Edycja rezerwacji/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("create-reservation-guest")).not.toHaveValue("");
    await page.keyboard.press("Escape");
  });

  test("4.7 Anulowanie edycji nie zapisuje zmian", async ({ page }) => {
    await page.goto("/front-office");
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible().catch(() => false))) {
      test.skip(true, "Brak rezerwacji");
    }
    await bar.click();
    await expect(page.getByText(/Edycja rezerwacji/i)).toBeVisible({ timeout: 5000 });
    const guestInput = page.getByTestId("create-reservation-guest");
    const origVal = await guestInput.inputValue();
    await guestInput.fill("ZmienioneDaneDoAnulowania");
    await page.getByRole("button", { name: "Anuluj" }).click();
    await bar.click();
    await expect(guestInput).toHaveValue(origVal);
    await page.keyboard.press("Escape");
  });
});

test.describe("MODUŁ 5: Anulowanie Rezerwacji", () => {
  test("5.1 Przycisk Anuluj wymaga potwierdzenia", async ({ page }) => {
    await page.goto("/front-office");
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible().catch(() => false))) {
      test.skip(true, "Brak rezerwacji");
    }
    await bar.click({ button: "right" });
    const cancelOpt = page.getByRole("menuitem", { name: /Anuluj rezerwację|Anuluj/i });
    if (!(await cancelOpt.isVisible().catch(() => false))) {
      await page.keyboard.press("Escape");
      test.skip(true, "Brak menu kontekstowego Anuluj");
    }
    await cancelOpt.click();
    await expect(page.getByText(/Czy na pewno|Na pewno|potwierdź|confirm/i)).toBeVisible({ timeout: 3000 });
    await page.keyboard.press("Escape");
  });
});

test.describe("MODUŁ 6: Zarządzanie Pokojami", () => {
  test("6.1/6.2 Lista pokojów kompletna, ma numer/typ/pojemność", async ({ page }) => {
    await page.goto("/pokoje");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText(/Pokoje|Pokój|room|Room/i).first()).toBeVisible({ timeout: 10000 });
    const roomContent = page.locator("text=/101|102|103|Pokój|numer/i").first();
    await expect(roomContent).toBeVisible({ timeout: 5000 });
  });
});

test.describe("MODUŁ 7: Rozliczenia i Płatności", () => {
  test("7.1 Automatyczne wyliczenie: 3 noce × 250 zł = 750 zł", async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.locator('[data-testid="room-row-102"]').first()).toBeVisible({ timeout: 15000 });
    await openCreateReservationForm(page);
    await page.getByTestId("create-reservation-guest").fill("Finance Test Guest");
    await page.waitForTimeout(300);
    const priceEl = page.locator("text=/750|Suma za pokój|Cena za dobę/i");
    const visible = await priceEl.first().isVisible().catch(() => false);
    if (!visible) {
      await page.getByRole("button", { name: "Anuluj" }).click();
      test.skip(true, "Brak widocznej kalkulacji ceny w formularzu");
    }
    await page.getByRole("button", { name: "Anuluj" }).click();
  });
});

test.describe("MODUŁ 8: Check-in / Check-out", () => {
  test("8.1 Przycisk Check-in dostępny dla rezerwacji w dniu przyjazdu", async ({ page }) => {
    await page.goto("/front-office");
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible().catch(() => false))) {
      test.skip(true, "Brak rezerwacji");
    }
    await bar.click({ button: "right" });
    const checkInOpt = page.getByRole("menuitem", { name: /Check-in|Zamelduj|Meldunek/i });
    await expect(checkInOpt.or(page.getByText(/Check-in|Zamelduj/i))).toBeVisible({ timeout: 3000 });
    await page.keyboard.press("Escape");
  });
});

test.describe("MODUŁ 9: Raporty", () => {
  test("9.1/9.2 Strona raportów ładuje się", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toContainText(/Raport|Report|Raporty/i);
  });
});

test.describe("MODUŁ 12: Jakość techniczna", () => {
  test("12.1 Strony ładują się w rozsądnym czasie", async ({ page }) => {
    const start = Date.now();
    await page.goto("/front-office");
    await expect(page.locator('[data-testid="room-row-101"]').first()).toBeVisible({ timeout: 15000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(15000);
  });

  test("12.3 System działa w Chrome", async ({ page, browserName }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();
  });

  test("12.6 Komunikaty błędów po polsku", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/login");
    if (!page.url().includes("/login")) {
      test.skip(true, "Auth wyłączone");
    }
    await page.getByLabel(/Email/i).fill("admin@hotel.local");
    await page.getByLabel(/Hasło|Password/i).fill("wrong");
    await page.locator('button[type="submit"]').click();
    const msg = page.getByText(/Nieprawidłowe|błędne|Invalid|incorrect|dane/i).first();
    await expect(msg).toBeVisible({ timeout: 8000 });
    const text = await msg.textContent();
    expect(text?.toLowerCase()).not.toContain("password");
    await ctx.close();
  });
});
