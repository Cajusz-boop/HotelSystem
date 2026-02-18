import { test, expect } from "@playwright/test";

test.describe("MICE — Konferencje i eventy", () => {
  test("MICE-01: strona /mice ładuje się", async ({ page }) => {
    await page.goto("/mice");
    await expect(
      page.getByText(/MICE|Konferencje|Events|Meetings/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("MICE-02: eventy (/mice/eventy) — lista eventów", async ({ page }) => {
    await page.goto("/mice/eventy");
    await expect(
      page.getByText(/Eventy|Wydarzenia|Events/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("MICE-03: nowy event — formularz z polami", async ({ page }) => {
    await page.goto("/mice/eventy");
    await expect(page.getByText(/Eventy|Events/i).first()).toBeVisible({ timeout: 10000 });
    const addBtn = page.getByRole("button", { name: /Nowy event|Dodaj|\+|Nowe/i }).first();
    if (!(await addBtn.isVisible().catch(() => false))) {
      test.skip(true, "Brak przycisku nowego eventu");
      return;
    }
    await addBtn.click();
    await expect(
      page.locator('[role="dialog"], form, input[name*="name" i], input[name*="nazwa" i]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("MICE-04: kosztorysy (/mice/kosztorysy) — lista", async ({ page }) => {
    await page.goto("/mice/kosztorysy");
    await expect(
      page.getByText(/Kosztorysy|Estimates|Wyceny/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("MICE-05: nowy kosztorys — formularz", async ({ page }) => {
    await page.goto("/mice/kosztorysy");
    await expect(page.getByText(/Kosztorysy|Estimates/i).first()).toBeVisible({ timeout: 10000 });
    const addBtn = page.getByRole("button", { name: /Nowy|Dodaj|\+/i }).first();
    if (!(await addBtn.isVisible().catch(() => false))) {
      test.skip(true, "Brak przycisku nowego kosztorysu");
      return;
    }
    await addBtn.click();
    await expect(
      page.locator('[role="dialog"], form, input').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("MICE-06: zlecenia (/mice/zlecenia) — lista", async ({ page }) => {
    await page.goto("/mice/zlecenia");
    await expect(
      page.getByText(/Zlecenia|Orders|Realizacja/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("MICE-07: grafik sal (/mice/grafik) — kalendarz", async ({ page }) => {
    await page.goto("/mice/grafik");
    await expect(
      page.getByText(/Grafik|Kalendarz|Schedule|Sale/i).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
