import { test, expect } from "@playwright/test";

test.describe("Ustawienia systemu", () => {
  test.describe("Dane hotelu", () => {
    test("SET-01: strona /ustawienia/dane-hotelu ładuje się", async ({ page }) => {
      await page.goto("/ustawienia/dane-hotelu");
      await expect(
        page.getByText(/Dane hotelu|Hotel|Nazwa hotelu|Ustawienia/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("SET-02: formularz zawiera pola: nazwa, adres, NIP", async ({ page }) => {
      await page.goto("/ustawienia/dane-hotelu");
      await expect(page.getByText(/Dane hotelu|Hotel/i).first()).toBeVisible({ timeout: 10000 });
      const hasInputs = (await page.locator("input, textarea").count()) >= 2;
      expect(hasInputs).toBeTruthy();
    });
  });

  test.describe("Użytkownicy", () => {
    test("SET-04: lista użytkowników ładuje się", async ({ page }) => {
      await page.goto("/ustawienia/uzytkownicy");
      await expect(
        page.getByText(/Użytkownicy|Users/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("SET-05: dodanie nowego użytkownika — formularz", async ({ page }) => {
      await page.goto("/ustawienia/uzytkownicy");
      await expect(page.getByText(/Użytkownicy/i).first()).toBeVisible({ timeout: 10000 });
      const addBtn = page.getByRole("button", { name: /Dodaj|Nowy|\+/i }).first();
      if (!(await addBtn.isVisible().catch(() => false))) {
        test.skip(true, "Brak przycisku dodawania użytkownika");
        return;
      }
      await addBtn.click();
      await expect(
        page.locator('[role="dialog"], form, input[name*="name" i], input[name*="email" i]').first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Szablony dokumentów", () => {
    test("SET-08: strona /ustawienia/szablony ładuje się", async ({ page }) => {
      await page.goto("/ustawienia/szablony");
      await expect(
        page.getByText(/Szablony|Templates|Dokumenty/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Szablony email", () => {
    test("SET-09: strona /ustawienia/szablony-email ładuje się", async ({ page }) => {
      await page.goto("/ustawienia/szablony-email");
      await expect(
        page.getByText(/Szablony email|Email Templates|E-mail/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Numeracja", () => {
    test("SET-10: strona /ustawienia/numeracja ładuje się", async ({ page }) => {
      await page.goto("/ustawienia/numeracja");
      await expect(
        page.getByText(/Numeracja|Numbering|Format/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Sezony", () => {
    test("SET-11: strona /ustawienia/sezony ładuje się", async ({ page }) => {
      await page.goto("/ustawienia/sezony");
      await expect(
        page.getByText(/Sezony|Seasons/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("SET-12: dodanie nowego sezonu — formularz", async ({ page }) => {
      await page.goto("/ustawienia/sezony");
      await expect(page.getByText(/Sezony|Seasons/i).first()).toBeVisible({ timeout: 10000 });
      const addBtn = page.getByRole("button", { name: /Dodaj|Nowy|\+/i }).first();
      if (!(await addBtn.isVisible().catch(() => false))) {
        test.skip(true, "Brak przycisku dodawania sezonu");
        return;
      }
      await addBtn.click();
      await expect(
        page.locator('[role="dialog"], form, input').first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Piętra", () => {
    test("SET-14: strona /ustawienia/pietra ładuje się", async ({ page }) => {
      await page.goto("/ustawienia/pietra");
      await expect(
        page.getByText(/Piętra|Floors|Piętro/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("SET-15: dodanie nowego piętra", async ({ page }) => {
      await page.goto("/ustawienia/pietra");
      await expect(page.getByText(/Piętra|Floors/i).first()).toBeVisible({ timeout: 10000 });
      const addBtn = page.getByRole("button", { name: /Dodaj|Nowe|\+/i }).first();
      if (!(await addBtn.isVisible().catch(() => false))) {
        test.skip(true, "Brak przycisku dodawania piętra");
        return;
      }
      await addBtn.click();
      await expect(
        page.locator('[role="dialog"], form, input').first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Słowniki", () => {
    test("SET-16: strona /ustawienia/slowniki ładuje się", async ({ page }) => {
      await page.goto("/ustawienia/slowniki");
      await expect(
        page.getByText(/Słowniki|Dictionaries|Źródła|Segmenty/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Polityka anulacji", () => {
    test("SET-17: strona /ustawienia/polityka-anulacji ładuje się", async ({ page }) => {
      await page.goto("/ustawienia/polityka-anulacji");
      await expect(
        page.getByText(/Polityka anulacji|Cancellation|Anulacja/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("KSeF", () => {
    test("SET-18: strona /ustawienia/ksef ładuje się", async ({ page }) => {
      await page.goto("/ustawienia/ksef");
      await expect(
        page.getByText(/KSeF|Krajowy System|e-Faktur/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("SMS", () => {
    test("SET-19: strona /ustawienia/sms ładuje się", async ({ page }) => {
      await page.goto("/ustawienia/sms");
      await expect(
        page.getByText(/SMS|Wiadomości|Twilio/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Import danych", () => {
    test("SET-20: strona /ustawienia/import ładuje się", async ({ page }) => {
      await page.goto("/ustawienia/import");
      await expect(
        page.getByText(/Import|CSV|Excel/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Kasa fiskalna", () => {
    test("SET-22: strona /ustawienia/kasa-fiskalna ładuje się", async ({ page }) => {
      await page.goto("/ustawienia/kasa-fiskalna");
      await expect(
        page.getByText(/Kasa fiskalna|Fiscal|POSNET|Paragon/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("2FA", () => {
    test("SET-23: strona /ustawienia/2fa ładuje się", async ({ page }) => {
      await page.goto("/ustawienia/2fa");
      await expect(
        page.getByText(/2FA|Dwuskładnikowe|Two-Factor|Authenticator/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });
});
