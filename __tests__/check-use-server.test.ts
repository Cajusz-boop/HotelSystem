/**
 * Test: skrypt check-use-server nie zgłasza błędów.
 * Pliki "use server" mogą eksportować tylko async funkcje i typy.
 * Uruchom: npm test (lub npm run check:use-server).
 */
import { describe, it } from "vitest";
import { execSync } from "child_process";
import path from "path";

describe("check-use-server", () => {
  it("w plikach app/actions nie ma niedozwolonych eksportów w 'use server'", () => {
    const cwd = path.resolve(__dirname, "..");
    try {
      execSync("npx tsx scripts/check-use-server-exports.ts", {
        cwd,
        stdio: "pipe",
        encoding: "utf-8",
      });
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; message?: string };
      const out = [err.stdout, err.stderr, err.message].filter(Boolean).join("\n");
      throw new Error(`check-use-server failed. Run 'npm run check:use-server' for details.\n${out}`);
    }
  });
});
