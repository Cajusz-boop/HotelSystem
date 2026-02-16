/**
 * Statyczna analiza kontrolek formularzy.
 *
 * Sprawdza typowe błędy w plikach stron:
 * 1. Pola konfiguracyjne (floor, view, status) renderowane jako <Input> zamiast <select>
 * 2. SelectContent z z-index niższym niż DialogContent
 * 3. Pola konfiguracyjne (floors) nieładowane z getHotelConfig
 *
 * Uruchom: npx tsx scripts/check-form-controls.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

interface Issue {
  file: string;
  line: number;
  lineText: string;
  rule: string;
  message: string;
}

const PAGES_DIR = path.join(process.cwd(), "app");
const COMPONENTS_DIR = path.join(process.cwd(), "components");

function* findTsxFiles(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      yield* findTsxFiles(full);
    } else if (name.endsWith(".tsx") || name.endsWith(".ts")) {
      yield full;
    }
  }
}

// Fields that should always be <select>, never free-text <Input>
const SELECT_REQUIRED_FIELDS: Record<string, string> = {
  floor: "Pietro (floor) powinno byc <select> z opcjami z konfiguracji, nie wolnym <Input>.",
  view: "Widok (view) powinno byc <select> z predefiniowanymi opcjami, nie wolnym <Input>.",
  status: "Status powinien byc <select> z predefiniowanymi opcjami, nie wolnym <Input>.",
};

function checkSelectRequiredFields(
  filePath: string,
  lines: string[]
): Issue[] {
  const issues: Issue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const [field, message] of Object.entries(SELECT_REQUIRED_FIELDS)) {
      // Pattern: inline editing – case "field": followed by Input without select
      // Look for patterns like: isEditing(xxx, "floor") followed by <Input
      const editPattern = new RegExp(
        `isEditing\\([^)]*,\\s*["']${field}["']\\)`,
        "i"
      );
      if (editPattern.test(line)) {
        // Scan next 10 lines for <Input vs <select
        const chunk = lines.slice(i, i + 12).join("\n");
        const hasInput = /<Input\b/i.test(chunk) || /\bInput\b/.test(chunk);
        const hasSelect = /<select\b/i.test(chunk);

        if (hasInput && !hasSelect) {
          issues.push({
            file: filePath,
            line: i + 1,
            lineText: line.trim().slice(0, 80),
            rule: "SELECT_REQUIRED",
            message,
          });
        }
      }
    }
  }

  return issues;
}

function checkZIndexHierarchy(): Issue[] {
  const issues: Issue[] = [];

  const selectPath = path.join(COMPONENTS_DIR, "ui", "select.tsx");
  const dialogPath = path.join(COMPONENTS_DIR, "ui", "dialog.tsx");

  if (!fs.existsSync(selectPath) || !fs.existsSync(dialogPath)) return issues;

  const selectContent = fs.readFileSync(selectPath, "utf-8");
  const dialogContent = fs.readFileSync(dialogPath, "utf-8");

  const selectZMatch = selectContent.match(/z-(\d+)|z-\[(\d+)\]/);
  const dialogZMatch = dialogContent.match(/z-(\d+)|z-\[(\d+)\]/);

  if (selectZMatch && dialogZMatch) {
    const selectZ = parseInt(selectZMatch[1] ?? selectZMatch[2], 10);
    const dialogZ = parseInt(dialogZMatch[1] ?? dialogZMatch[2], 10);

    if (selectZ <= dialogZ) {
      const selectLines = selectContent.split("\n");
      const lineIdx = selectLines.findIndex((l) => /z-\d+|z-\[\d+\]/.test(l));
      issues.push({
        file: selectPath,
        line: lineIdx + 1,
        lineText: "SelectContent z-index: " + selectZ + ", DialogContent z-index: " + dialogZ,
        rule: "Z_INDEX_HIERARCHY",
        message: "SelectContent (z-" + selectZ + ") musi miec wyzszy z-index niz DialogContent (z-" + dialogZ + "), " +
          "inaczej dropdown w dialogu bedzie zasloniety.",
      });
    }
  }

  return issues;
}

function checkConfigFieldsLoaded(
  filePath: string,
  content: string,
  lines: string[]
): Issue[] {
  const issues: Issue[] = [];

  // Only check if file edits floor values (inline editing pattern)
  const usesFloorEdit = /isEditing\([^)]*,\s*["']floor["']\)/.test(content);

  if (usesFloorEdit) {
    const importsHotelConfig = /getHotelConfig/.test(content);
    if (!importsHotelConfig) {
      const editLine = lines.findIndex((l) => /floor/.test(l) && /isEditing|select/i.test(l));
      issues.push({
        file: filePath,
        line: editLine >= 0 ? editLine + 1 : 1,
        lineText: editLine >= 0 ? lines[editLine].trim().slice(0, 80) : "(plik)",
        rule: "CONFIG_NOT_LOADED",
        message:
          "Plik uzywa pola floor z konfiguracja pieter, ale nie importuje getHotelConfig. " +
          "Dropdown pieter bedzie pusty.",
      });
    }
  }

  return issues;
}

function main(): void {
  const allIssues: Issue[] = [];

  // Check z-index hierarchy
  allIssues.push(...checkZIndexHierarchy());

  // Check page files
  for (const filePath of findTsxFiles(PAGES_DIR)) {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    allIssues.push(...checkSelectRequiredFields(filePath, lines));
    allIssues.push(...checkConfigFieldsLoaded(filePath, content, lines));
  }

  if (allIssues.length === 0) {
    console.log("OK: Nie znaleziono problemow z kontrolkami formularzy.");
    return;
  }

  console.error(
    "Znaleziono " + allIssues.length + " problemow z kontrolkami formularzy:\n"
  );
  for (const issue of allIssues) {
    const rel = path.relative(process.cwd(), issue.file);
    console.error("  [" + issue.rule + "] " + rel + ":" + issue.line);
    console.error("    " + issue.lineText);
    console.error("    " + issue.message + "\n");
  }
  process.exit(1);
}

main();
