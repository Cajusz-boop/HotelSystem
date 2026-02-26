/**
 * Test Booking Engine — wywołuje /api/test/booking-engine
 * Uruchom: npx tsx scripts/test-booking-engine.ts
 * Wymaga: serwer dev na localhost:3011
 */
const BASE_URL = "http://localhost:3011";

async function main() {
  console.log("\nTest Booking Engine\n");

  try {
    const res = await fetch(`${BASE_URL}/api/test/booking-engine`);
    const json = (await res.json()) as { results?: Array<{ step: string; ok: boolean; message?: string; data?: unknown }> };
    const results = json.results ?? [];

    results.forEach((r) => {
      const icon = r.ok ? "✅" : "❌";
      const msg = r.message ? ` — ${r.message}` : "";
      console.log(`${icon} ${r.step}${msg}`);
    });

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.filter((r) => !r.ok).length;

    console.log("\n" + "─".repeat(50));
    console.log(`OK: ${okCount} | Błędy: ${failCount}`);
    if (failCount > 0) {
      results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.step}: ${r.message ?? "?"}`));
    }
    console.log("");
  } catch (e) {
    console.error("Błąd:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main();
