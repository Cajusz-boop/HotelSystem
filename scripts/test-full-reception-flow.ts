#!/usr/bin/env npx tsx
/**
 * Test pełnego flow recepcyjnego na bazie produkcyjnej.
 * Uruchom: npx tsx scripts/test-full-reception-flow.ts
 *
 * Wymaga: serwer dev na http://localhost:3011 (npm run dev)
 *         baza produkcyjna lub demo z pokojami i konfiguracją
 */
const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3011";

async function main() {
  console.log("\n========== TEST PEŁNEGO FLOW RECEPCYJNEGO ==========\n");
  console.log(`Wywołuję: ${BASE_URL}/api/test/full-reception-flow\n`);

  try {
    const res = await fetch(`${BASE_URL}/api/test/full-reception-flow`);
    const json = (await res.json()) as { results?: Array<{ step: string; ok: boolean; message?: string; data?: unknown }> };
    const results = json.results ?? [];

    if (!res.ok) {
      console.error(`HTTP ${res.status}: ${res.statusText}`);
      process.exit(1);
    }

    for (const r of results) {
      const mark = r.ok ? "PASS" : "FAIL";
      const msg = r.message ?? (r.data && Object.keys(r.data as object).length ? JSON.stringify(r.data) : "");
      console.log(`[${mark}] ${r.step}${msg ? ": " + msg : ""}`);
    }

    const allOk = results.length > 0 && results.every((r) => r.ok);
    const passCount = results.filter((r: { ok: boolean }) => r.ok).length;
    const total = results.length;

    console.log("\n========== PODSUMOWANIE ==========");
    console.log(`${passCount}/${total} kroków: ${allOk ? "PASS" : "FAIL"}\n`);
    process.exit(allOk ? 0 : 1);
  } catch (e) {
    console.error("\n[BŁĄD]", e);
    console.error("Upewnij się, że serwer dev działa: npm run dev");
    process.exit(1);
  }
}

main();

export {};
