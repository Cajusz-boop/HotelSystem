/**
 * Test: build się kompiluje bez błędów.
 * Łapie m.in.: "the name X is defined multiple times", błędy TypeScript, błędy Next.js.
 * Uruchom: npm test (albo npm run check dla pełnego lint + typecheck + build).
 * Czyścimy .next przed buildem, żeby drugi build (np. po npm run check) nie czytał ze standalone.
 */
import { describe, it } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

describe("build", () => {
  it("next build kończy się sukcesem (brak błędów kompilacji)", () => {
    const cwd = path.resolve(__dirname, "..");
    const nextDir = path.join(cwd, ".next");
    try {
      if (fs.existsSync(nextDir)) {
        fs.rmSync(nextDir, { recursive: true });
      }
      execSync("npx next build", {
        cwd,
        stdio: "pipe",
        encoding: "utf-8",
        env: { ...process.env, CI: "1" },
      });
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; message?: string };
      const out = [err.stdout, err.stderr, err.message].filter(Boolean).join("\n");
      throw new Error(`Build failed. Run 'npm run build' locally for details.\n${out}`);
    }
  });
});
