/**
 * Sprawdza, że pliki z "use server" eksportują tylko async funkcje (i ewentualnie typy).
 * Next.js wymaga: w pliku "use server" można eksportować wyłącznie async funkcje.
 * Uruchom: npx tsx scripts/check-use-server-exports.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

const ACTIONS_DIR = path.join(process.cwd(), "app", "actions");
const MAX_HEAD_LINES = 5;

function hasUseServer(content: string): boolean {
  const head = content.split("\n").slice(0, MAX_HEAD_LINES).join("\n");
  return /["']use server["']\s*;?\s*/.test(head);
}

function* findTsFiles(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) yield* findTsFiles(full);
    else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) yield full;
  }
}

interface ExportIssue {
  file: string;
  line: number;
  lineText: string;
  message: string;
}

function checkFile(filePath: string): ExportIssue[] {
  const content = fs.readFileSync(filePath, "utf-8");
  if (!hasUseServer(content)) return [];

  const issues: ExportIssue[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Eksport dopuszczalny: export async function / export type / export interface
    if (/^\s*export\s+async\s+function\s+\w+/.test(line)) continue;
    if (/^\s*export\s+type\s+/.test(line)) continue;
    if (/^\s*export\s+interface\s+/.test(line)) continue;
    if (/^\s*export\s+type\s*\{/.test(line)) continue;

    // Eksporty niedopuszczalne w "use server"
    if (/^\s*export\s+const\s+/.test(line)) {
      issues.push({
        file: filePath,
        line: i + 1,
        lineText: trimmed.slice(0, 80),
        message: "Plik 'use server' nie może eksportować const – tylko async funkcje.",
      });
    }
    if (/^\s*export\s+let\s+/.test(line)) {
      issues.push({
        file: filePath,
        line: i + 1,
        lineText: trimmed.slice(0, 80),
        message: "Plik 'use server' nie może eksportować let – tylko async funkcje.",
      });
    }
    if (/^\s*export\s+\{\s*/.test(line)) {
      issues.push({
        file: filePath,
        line: i + 1,
        lineText: trimmed.slice(0, 80),
        message: "Plik 'use server' nie może eksportować obiektów (export { … }) – przenieś do osobnego pliku.",
      });
    }
    if (/^\s*export\s+function\s+\w+/.test(line) && !/^\s*export\s+async\s+function\s+/.test(line)) {
      issues.push({
        file: filePath,
        line: i + 1,
        lineText: trimmed.slice(0, 80),
        message: "W pliku 'use server' eksportowane funkcje muszą być async.",
      });
    }
  }

  return issues;
}

function main(): void {
  const allIssues: ExportIssue[] = [];
  for (const filePath of findTsFiles(ACTIONS_DIR)) {
    allIssues.push(...checkFile(filePath));
  }

  if (allIssues.length === 0) {
    console.log("OK: Wszystkie pliki 'use server' eksportują tylko dozwolone elementy.");
    return;
  }

  console.error("Błędy w plikach 'use server' (Next.js dopuszcza tylko export async function):\n");
  for (const issue of allIssues) {
    console.error(`  ${path.relative(process.cwd(), issue.file)}:${issue.line}`);
    console.error(`    ${issue.lineText}`);
    console.error(`    ${issue.message}\n`);
  }
  process.exit(1);
}

main();
