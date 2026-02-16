/**
 * Walidacja lokalna XML faktury KSeF (well-formedness + opcjonalnie XSD).
 */

export interface ValidateResult {
  valid: boolean;
  error?: string;
}

/**
 * Sprawdza, czy XML jest poprawny składniowo (well-formed).
 * Gdy KSEF_XSD_PATH jest ustawione, próbuje walidacji XSD przez xmllint (jeśli dostępny).
 */
export function validateInvoiceXml(xmlString: string): ValidateResult {
  if (typeof xmlString !== "string" || !xmlString.trim()) {
    return { valid: false, error: "Pusty XML" };
  }
  const trimmed = xmlString.trim();
  if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<")) {
    return { valid: false, error: "Nieprawidłowy początek dokumentu XML" };
  }

  try {
    let parsed = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic require for optional dependency
      const FXParser = require("fast-xml-parser").XMLParser;
      if (FXParser) {
        new FXParser({ ignoreAttributes: false }).parse(trimmed);
        parsed = true;
      }
    } catch {
      // fast-xml-parser nie zainstalowany lub błąd parsowania
    }
    if (!parsed) {
      wellFormedCheck(trimmed);
    }
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : "Błąd parsowania XML",
    };
  }

  const xsdPath = process.env.KSEF_XSD_PATH;
  if (xsdPath) {
    const xsdResult = validateWithXsdSync(trimmed, xsdPath);
    if (!xsdResult.valid) return xsdResult;
  }

  return { valid: true };
}

function wellFormedCheck(xml: string): void {
  const openTags: string[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9_:.-]*)(?:\s[^>]*)?\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(xml)) !== null) {
    const full = m[0];
    const name = m[1];
    if (full.startsWith("</")) {
      if (openTags.pop() !== name) throw new Error(`Niezamknięty lub niepasujący tag: ${name}`);
    } else if (!full.endsWith("/>")) {
      openTags.push(name);
    }
  }
  if (openTags.length > 0) throw new Error(`Niezamknięte tagi: ${openTags.join(", ")}`);
}

function validateWithXsdSync(xml: string, xsdPath: string): ValidateResult {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- sync APIs for xmllint subprocess
    const { execSync } = require("child_process");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tmpFile = path.join(require("os").tmpdir(), `ksef-validate-${Date.now()}.xml`);
    fs.writeFileSync(tmpFile, xml, "utf8");
    try {
      execSync(`xmllint --noout --schema "${xsdPath}" "${tmpFile}" 2>&1`, {
        encoding: "utf8",
        timeout: 10000,
      });
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
    return { valid: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { valid: false, error: `Walidacja XSD (xmllint): ${msg.slice(0, 300)}` };
  }
}
