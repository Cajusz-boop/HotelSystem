/**
 * Automatyczny eksport konfiguracji do config-snapshot.json po zapisie ustawień.
 * Działa tylko w trybie deweloperskim (NODE_ENV !== "production").
 * Debounce 3s — wiele zapisów w krótkim czasie powodują jeden eksport.
 */

const g = globalThis as unknown as { __configExportTimer?: ReturnType<typeof setTimeout> };

export function autoExportConfigSnapshot(): void {
  if (process.env.NODE_ENV === "production") return;

  if (g.__configExportTimer) clearTimeout(g.__configExportTimer);

  g.__configExportTimer = setTimeout(async () => {
    try {
      const { exec } = await import("child_process");
      exec("npx tsx prisma/config-export.ts", { cwd: process.cwd(), timeout: 20_000 }, (err) => {
        if (err) console.warn("[auto-export] Nie udało się wyeksportować konfiguracji:", err.message);
        else console.log("[auto-export] config-snapshot.json zaktualizowany");
      });
    } catch {
      // Nie blokuj zapisu ustawień
    }
  }, 3_000);
}
