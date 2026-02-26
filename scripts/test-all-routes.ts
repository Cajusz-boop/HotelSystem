/**
 * Skrypt testowy - sprawdza czy wszystkie strony aplikacji się otwierają.
 * Uruchom: npx tsx scripts/test-all-routes.ts
 * Wymaga działającego dev servera na localhost:3011
 */

import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3011";

type Result = {
  route: string;
  status: number;
  ok: boolean;
  errorMessage?: string;
};

function findPageRoutes(dir: string, baseDir: string): string[] {
  const routes: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      // Pomijamy foldery specjalne Next.js
      if (entry.name.startsWith("_") || entry.name === "api") continue;
      routes.push(...findPageRoutes(fullPath, baseDir));
    } else if (entry.name === "page.tsx" || entry.name === "page.js") {
      const dirPath = path.dirname(relativePath);
      let route = dirPath === "." ? "/" : "/" + dirPath.replace(/\\/g, "/");
      // Zamiana segmentów dynamicznych na placeholdery
      route = route
        .replace(/\[id\]/g, "1")
        .replace(/\[token\]/g, "test-token")
        .replace(/\[\w+\]/g, "1");
      routes.push(route);
    }
  }

  return routes;
}

function routeToUrl(route: string): string {
  return `${BASE_URL}${route}`;
}

function isOkStatus(status: number): boolean {
  return status === 200 || status === 302 || status === 307;
}

function statusDescription(status: number, errorMessage?: string): string {
  const messages: Record<number, string> = {
    200: "OK",
    302: "Redirect",
    307: "Temporary Redirect",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    500: "Internal Server Error",
  };
  const desc = messages[status] ?? `HTTP ${status}`;
  return errorMessage ? `${desc} — ${errorMessage}` : desc;
}

const FETCH_TIMEOUT_MS = 15000;

async function fetchRoute(route: string): Promise<Result> {
  const url = routeToUrl(route);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "test-all-routes/1.0" },
    });
    clearTimeout(timeout);
    return {
      route,
      status: res.status,
      ok: isOkStatus(res.status),
      errorMessage: isOkStatus(res.status) ? undefined : statusDescription(res.status),
    };
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      route,
      status: 0,
      ok: false,
      errorMessage: msg,
    };
  }
}

function formatResult(r: Result): string {
  const icon = r.ok ? "✅" : "❌";
  const statusStr = r.status > 0 ? r.status : "ERR";
  const extra = r.errorMessage ? ` — ${r.errorMessage}` : "";
  return `${icon} ${statusStr} ${r.route}${extra}`;
}

async function main() {
  const appDir = path.join(process.cwd(), "app");
  if (!fs.existsSync(appDir)) {
    console.error("Katalog app/ nie istnieje.");
    process.exit(1);
  }

  const routes = findPageRoutes(appDir, appDir);
  const unique = [...new Set(routes)].sort();

  console.log(`\nTestowanie ${unique.length} route'ów na ${BASE_URL}\n`);

  // Równoległe fetchy (batch 15, żeby nie przeciążyć dev servera)
  const BATCH_SIZE = 15;
  const results: Result[] = [];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((route) => fetchRoute(route)));
    results.push(...batchResults);
  }
  results.sort((a, b) => a.route.localeCompare(b.route));
  results.forEach((r) => console.log(formatResult(r)));

  const okCount = results.filter((r) => r.ok).length;
  const errorCount = results.filter((r) => !r.ok).length;
  const errorRoutes = results.filter((r) => !r.ok).map((r) => r.route);

  console.log("\n" + "─".repeat(50));
  console.log("PODSUMOWANIE");
  console.log("─".repeat(50));
  console.log(`✅ Strony OK:     ${okCount}`);
  console.log(`❌ Strony z błędem: ${errorCount}`);
  if (errorRoutes.length > 0) {
    console.log("\nLista stron z błędami:");
    errorRoutes.forEach((r) => console.log(`  - ${r}`));
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
