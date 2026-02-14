import { spawnSync } from "node:child_process";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

const defaultSpecs = ["Test/check-in-flow.spec.ts", "Test/ci-gap.spec.ts"];
const specs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaultSpecs;

const projectList =
  process.env.PLAYWRIGHT_PROJECTS?.split(",").map((entry) => entry.trim()).filter(Boolean) ??
  ["chromium", "firefox", "webkit"];

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3011";

function runOrThrow(command: string, args: string[], label: string, env?: NodeJS.ProcessEnv) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: env ?? process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Polecenie zakończyło się niepowodzeniem: ${command} ${args.join(" ")}`);
  }
}

(async () => {
  try {
    for (const spec of specs) {
      for (const project of projectList) {
        runOrThrow(npmCmd, ["run", "db:seed:kwhotel"], `Seed bazy przed ${spec} (${project})`);
        runOrThrow(
          npxCmd,
          ["playwright", "test", spec, "--project", project],
          `Playwright: ${spec} (${project})`,
          { ...process.env, PLAYWRIGHT_BASE_URL: baseUrl }
        );
      }
    }
    console.log("\n✅ Wszystkie scenariusze Playwright zakończone sukcesem.");
  } catch (error) {
    console.error("\n❌ Przerwano wykonywanie skryptu.", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
})();
