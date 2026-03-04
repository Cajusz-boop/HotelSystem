import { test, expect } from "@playwright/test";

/**
 * Testy interakcji z tapechart (siatką rezerwacji)
 * Sprawdzają:
 * - kliknięcie pustej komórki -> modal nowej rezerwacji
 * - DOUBLE-click paska rezerwacji -> modal edycji (single click bubbluje do komórki!)
 * - prawy klik na pasek -> menu kontekstowe
 * - kliknięcie obok paska (w tej samej komórce) -> modal nowej rezerwacji
 */

test.describe("Tapechart - interakcje z komórkami i rezerwacjami", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("pms-onboarding-seen", "1");
    });
    await page.goto("/front-office", { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid^="room-row-"]', { timeout: 15000 });
    await page.waitForTimeout(1000);
  });

  test("TEST 1: Kliknięcie pustej komórki otwiera modal nowej rezerwacji", async ({ page }) => {
    // Znajdź pustą komórkę używając data-testid cell-{room}-{date}
    const emptyCell = page.locator('[data-testid^="cell-"]:not(:has([data-testid="reservation-bar"]))').first();
    
    await expect(emptyCell).toBeVisible({ timeout: 5000 });
    await emptyCell.click();

    // Sprawdź czy pojawił się dialog (użyj getByRole dla precyzji)
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    
    // Sprawdź tytuł - powinien być "Nowa rezerwacja"
    const title = dialog.locator("h2, [class*='DialogTitle']").first();
    await expect(title).toContainText(/nowa rezerwacja/i, { timeout: 3000 });
    
    await page.screenshot({ path: "test-results/test1-empty-cell-modal.png", fullPage: false });
    
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  test("TEST 2: DOUBLE-click na pasek rezerwacji otwiera modal edycji", async ({ page }) => {
    // Znajdź pasek rezerwacji po data-testid
    const reservationBar = page.locator('[data-testid="reservation-bar"]').first();
    
    await expect(reservationBar).toBeVisible({ timeout: 10000 });
    
    // Double-click otwiera edycję (single click przechodzi do komórki!)
    await reservationBar.dblclick();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    
    // Modal edycji powinien zawierać dane rezerwacji
    const title = dialog.locator("h2, [class*='DialogTitle']").first();
    const titleText = await title.textContent();
    console.log("TEST 2 - Dialog title:", titleText);
    
    await page.screenshot({ path: "test-results/test2-reservation-edit-modal.png", fullPage: false });
    
    await page.keyboard.press("Escape");
  });

  test("TEST 3: Prawy klik na pasek rezerwacji pokazuje menu kontekstowe", async ({ page }) => {
    const reservationBar = page.locator('[data-testid="reservation-bar"]').first();
    
    await expect(reservationBar).toBeVisible({ timeout: 10000 });
    await reservationBar.click({ button: "right" });

    // Radix ContextMenu renderuje się z data-radix-menu-content lub role="menu"
    // Czekaj trochę dłużej - menu może się animować
    await page.waitForTimeout(300);
    
    const contextMenu = page.locator('[data-radix-menu-content], [role="menu"]').first();
    await expect(contextMenu).toBeVisible({ timeout: 5000 });
    
    // Sprawdź czy menu zawiera opcję "Edytuj rezerwację"
    await expect(contextMenu.getByText(/edytuj rezerwację/i)).toBeVisible();
    
    await page.screenshot({ path: "test-results/test3-context-menu.png", fullPage: false });
    
    await page.keyboard.press("Escape");
  });

  test("TEST 4: Single-click na pasek rezerwacji (zachowanie propagacji)", async ({ page }) => {
    // Ten test sprawdza obecne zachowanie - czy single click na pasek
    // bubbluje do komórki i otwiera "Nową rezerwację"
    
    const reservationBar = page.locator('[data-testid="reservation-bar"]').first();
    await expect(reservationBar).toBeVisible({ timeout: 10000 });
    
    // Single click
    await reservationBar.click();
    
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    
    const title = dialog.locator("h2, [class*='DialogTitle']").first();
    const titleText = await title.textContent();
    console.log("TEST 4 - Single click result:", titleText);
    
    // Dokumentujemy obecne zachowanie - może to być bug lub feature
    // Jeśli tytuł to "Nowa rezerwacja", click przeszedł do komórki
    await page.screenshot({ path: "test-results/test4-single-click-bar.png", fullPage: false });
    
    await page.keyboard.press("Escape");
  });

  test("TEST 5: Kliknięcie OBOK paska rezerwacji otwiera modal NOWEJ rezerwacji", async ({ page }) => {
    // Znajdź komórkę która ma rezerwację (cell z reservation-bar w środku)
    const cellWithReservation = page.locator('[data-testid^="cell-"]:has([data-testid="reservation-bar"])').first();
    
    if (await cellWithReservation.count() === 0) {
      console.log("Nie znaleziono komórki z rezerwacją");
      test.skip();
      return;
    }

    const cellBox = await cellWithReservation.boundingBox();
    const reservationBar = cellWithReservation.locator('[data-testid="reservation-bar"]').first();
    const barBox = await reservationBar.boundingBox();

    if (!cellBox || !barBox) {
      console.log("Nie można pobrać boundingBox");
      test.skip();
      return;
    }

    console.log("Cell box:", cellBox);
    console.log("Bar box:", barBox);

    // Kliknij w górną część komórki, ponad paskiem (jeśli jest miejsce)
    // lub w dolną część pod paskiem
    const spaceAbove = barBox.y - cellBox.y;
    const spaceBelow = (cellBox.y + cellBox.height) - (barBox.y + barBox.height);
    
    let clickX = cellBox.x + cellBox.width / 2;
    let clickY: number;
    
    if (spaceAbove > 5) {
      clickY = cellBox.y + 2; // klik w górnej części
    } else if (spaceBelow > 5) {
      clickY = barBox.y + barBox.height + 2; // klik pod paskiem
    } else {
      // Pasek zajmuje całą wysokość - kliknij w prawą krawędź komórki
      clickX = cellBox.x + cellBox.width - 2;
      clickY = cellBox.y + cellBox.height / 2;
    }

    console.log(`Klikam na: (${clickX}, ${clickY})`);
    await page.mouse.click(clickX, clickY);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    
    const title = dialog.locator("h2, [class*='DialogTitle']").first();
    const titleText = await title.textContent();
    console.log("TEST 5 - Dialog title:", titleText);
    
    // Powinien otworzyć się modal NOWEJ rezerwacji
    await expect(title).toContainText(/nowa rezerwacja/i, { timeout: 3000 });
    
    await page.screenshot({ path: "test-results/test5-click-beside-bar.png", fullPage: false });
    
    await page.keyboard.press("Escape");
  });
});
