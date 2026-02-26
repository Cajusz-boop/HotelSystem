/**
 * Test modułów dodatkowych — wywołuje /api/test/modules
 * Uruchom: npx tsx scripts/test-modules.ts
 */
const BASE_URL = "http://localhost:3011";

async function main() {
  console.log("\nTest modułów dodatkowych (GET /api/test/modules)\n");

  try {
    const res = await fetch(`${BASE_URL}/api/test/modules`);
    const json = (await res.json()) as { results?: Array<{ step: string; ok: boolean; message?: string }> };
    const results = json.results ?? [];

    results.forEach((r) => {
      const icon = r.ok ? "✅" : "❌";
      const msg = r.message ? ` — ${r.message}` : "";
      console.log(`${icon} ${r.step}${msg}`);
    });

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.filter((r) => !r.ok).length;
    console.log("\n" + "─".repeat(50));
    console.log(`OK: ${okCount} | Błędy: ${failCount}\n`);
  } catch (e) {
    console.error("Błąd:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main();
