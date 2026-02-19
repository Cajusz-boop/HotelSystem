import http from "node:http";
import { mkdir, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  connect,
  sendCommand,
  printReceipt,
  printInvoice,
  printDailyReport,
  printPeriodicReport,
  cancelTransaction,
  healthCheck,
  sanitizeText,
  amountToPosnet,
} from "./posnet-protocol.mjs";

// ─── Configuration ──────────────────────────────────────────────────
const PORT = Number(process.env.POSNET_BRIDGE_PORT ?? "9977");
const API_KEY = process.env.FISCAL_POSNET_API_KEY || "";

const PRINTER_HOST = process.env.POSNET_PRINTER_HOST || "10.119.169.55";
const PRINTER_PORT = Number(process.env.POSNET_PRINTER_PORT ?? "6666");
const PRINTER_TIMEOUT = Number(process.env.POSNET_PRINTER_TIMEOUT ?? "5000");

// "tcp" = real printer, "spool" = save to files (testing)
const MODE = (process.env.POSNET_BRIDGE_MODE || "tcp").toLowerCase();

const SPOOL_DIR = process.env.FISCAL_POSNET_SPOOL_DIR || join(process.cwd(), "posnet-bridge", "spool");
const MAX_BODY_BYTES = 1_000_000;

// ─── State ──────────────────────────────────────────────────────────
let startedAt = new Date().toISOString();
let receiptCount = 0;
let invoiceCount = 0;
let reportCount = 0;
let stornoCount = 0;
let lastError = null;
let lastPrinterCheck = null;

// ─── HTTP helpers ───────────────────────────────────────────────────
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, x-api-key",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  });
  res.end(body);
}

function unauthorized(res) {
  return sendJson(res, 401, { success: false, error: "Unauthorized (x-api-key)" });
}

function badRequest(res, error) {
  return sendJson(res, 400, { success: false, error });
}

function checkAuth(req, res) {
  if (!API_KEY) return true;
  const headerKey = req.headers["x-api-key"];
  if (typeof headerKey === "string" && headerKey === API_KEY) return true;
  unauthorized(res);
  return false;
}

async function readBody(req) {
  return await new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function parseJson(req, res) {
  const raw = await readBody(req);
  try {
    return JSON.parse(raw);
  } catch {
    badRequest(res, "Nieprawidłowy JSON");
    return null;
  }
}

// ─── Spool (fallback/testing) ───────────────────────────────────────
async function spoolWrite(prefix, payload) {
  await mkdir(SPOOL_DIR, { recursive: true });
  const id = randomUUID();
  const ts = new Date().toISOString().replaceAll(":", "-");
  const filePath = join(SPOOL_DIR, `${prefix}_${ts}_${id}.json`);
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return { id, filePath };
}

// ─── Validation ─────────────────────────────────────────────────────
function validateReceipt(payload) {
  if (!payload || typeof payload !== "object") return "Nieprawidłowy JSON";
  if (typeof payload.transactionId !== "string" || !payload.transactionId) return "Brak transactionId";
  if (typeof payload.reservationId !== "string" || !payload.reservationId) return "Brak reservationId";
  if (!Array.isArray(payload.items) || payload.items.length < 1) return "Brak items";
  if (typeof payload.totalAmount !== "number" || !(payload.totalAmount > 0)) return "Brak/nieprawidłowe totalAmount";
  if (typeof payload.paymentType !== "string" || !payload.paymentType) return "Brak paymentType";
  return null;
}

function validateInvoice(payload) {
  if (!payload || typeof payload !== "object") return "Nieprawidłowy JSON";
  if (typeof payload.reservationId !== "string" || !payload.reservationId) return "Brak reservationId";
  const company = payload.company;
  if (!company || typeof company !== "object") return "Brak company";
  if (typeof company.nip !== "string" || !company.nip) return "Brak company.nip";
  if (typeof company.name !== "string" || !company.name) return "Brak company.name";
  if (!Array.isArray(payload.items) || payload.items.length < 1) return "Brak items";
  if (typeof payload.totalAmount !== "number" || payload.totalAmount < 0) return "Brak/nieprawidłowe totalAmount";
  return null;
}

function validateStorno(payload) {
  if (!payload || typeof payload !== "object") return "Nieprawidłowy JSON";
  if (!payload.originalReceiptNumber) return "Brak originalReceiptNumber";
  if (!payload.reason) return "Brak reason";
  if (typeof payload.amount !== "number" || payload.amount <= 0) return "Brak/nieprawidłowe amount";
  return null;
}

// ─── TCP printer connection helper ──────────────────────────────────
/**
 * Execute a fiscal operation with automatic connect/disconnect.
 * Opens a TCP connection, runs the operation, then closes.
 */
async function withPrinter(operation) {
  let socket = null;
  try {
    socket = await connect(PRINTER_HOST, PRINTER_PORT, PRINTER_TIMEOUT);
    const result = await operation(socket);
    return result;
  } finally {
    if (socket) {
      try { socket.destroy(); } catch { /* ignore */ }
    }
  }
}

// ─── HTTP Server ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, x-api-key",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    });
    return res.end();
  }

  try {
    // ── Health / diagnostyka ──
    if (req.method === "GET" && req.url === "/health") {
      let printerStatus = lastPrinterCheck;

      if (MODE === "tcp") {
        try {
          printerStatus = await withPrinter(async (socket) => {
            return await healthCheck(socket);
          });
          lastPrinterCheck = printerStatus;
        } catch (err) {
          printerStatus = { ok: false, error: err.message };
          lastPrinterCheck = printerStatus;
        }
      }

      let spoolFiles = 0;
      if (MODE === "spool") {
        try {
          const files = await readdir(SPOOL_DIR);
          spoolFiles = files.filter((f) => f.endsWith(".json")).length;
        } catch { /* spool dir may not exist yet */ }
      }

      return sendJson(res, 200, {
        ok: MODE === "spool" ? true : (printerStatus?.ok ?? false),
        bridge: "posnet-bridge",
        version: "2.0.0",
        startedAt,
        uptime: Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
        mode: MODE,
        printer: MODE === "tcp" ? {
          host: PRINTER_HOST,
          port: PRINTER_PORT,
          status: printerStatus,
        } : undefined,
        counters: { receipts: receiptCount, invoices: invoiceCount, reports: reportCount, stornos: stornoCount },
        spoolFiles: MODE === "spool" ? spoolFiles : undefined,
        lastError,
      });
    }

    // ── Paragon ──
    if (req.method === "POST" && req.url === "/fiscal/print") {
      if (!checkAuth(req, res)) return;
      const payload = await parseJson(req, res);
      if (!payload) return;

      const err = validateReceipt(payload);
      if (err) return badRequest(res, err);

      if (MODE === "spool") {
        const { id, filePath } = await spoolWrite("receipt", payload);
        receiptCount++;
        console.log(`[SPOOL] paragon #${receiptCount} -> ${filePath}`);
        return sendJson(res, 200, { success: true, receiptNumber: `PAR-${id.slice(0, 8).toUpperCase()}` });
      }

      // TCP mode — send to real printer
      console.log(`[TCP] Drukuję paragon: ${payload.items.length} pozycji, ${payload.totalAmount} PLN`);
      try {
        const result = await withPrinter(async (socket) => {
          return await printReceipt(socket, {
            items: payload.items,
            totalAmount: payload.totalAmount,
            paymentType: payload.paymentType || payload.posnetPaymentCode || "CASH",
            buyerNip: payload.buyerNip || null,
            footerLines: payload.footerLines || null,
          });
        });

        if (result.success) {
          receiptCount++;
          console.log(`[TCP] Paragon #${receiptCount} wydrukowany OK`);
          return sendJson(res, 200, { success: true, receiptNumber: `PAR-${receiptCount}` });
        } else {
          lastError = { message: result.error, timestamp: new Date().toISOString() };
          console.error(`[TCP] Błąd paragonu: ${result.error}`);
          return sendJson(res, 500, { success: false, error: result.error });
        }
      } catch (e) {
        const msg = e.message || "Błąd połączenia z drukarką";
        lastError = { message: msg, timestamp: new Date().toISOString() };
        console.error(`[TCP] Wyjątek: ${msg}`);
        return sendJson(res, 500, { success: false, error: msg });
      }
    }

    // ── Faktura ──
    if (req.method === "POST" && req.url === "/fiscal/invoice") {
      if (!checkAuth(req, res)) return;
      const payload = await parseJson(req, res);
      if (!payload) return;

      const err = validateInvoice(payload);
      if (err) return badRequest(res, err);

      if (MODE === "spool") {
        const { id, filePath } = await spoolWrite("invoice", { ...payload, _type: "invoice" });
        invoiceCount++;
        console.log(`[SPOOL] faktura #${invoiceCount} -> ${filePath}`);
        return sendJson(res, 200, { success: true, invoiceNumber: `FV-${id.slice(0, 8).toUpperCase()}` });
      }

      console.log(`[TCP] Drukuję fakturę: ${payload.company?.name}, ${payload.totalAmount} PLN`);
      try {
        const result = await withPrinter(async (socket) => {
          return await printInvoice(socket, {
            items: payload.items,
            totalAmount: payload.totalAmount,
            company: payload.company,
          });
        });

        if (result.success) {
          invoiceCount++;
          console.log(`[TCP] Faktura #${invoiceCount} wydrukowana OK`);
          return sendJson(res, 200, { success: true, invoiceNumber: `FV-${invoiceCount}` });
        } else {
          lastError = { message: result.error, timestamp: new Date().toISOString() };
          console.error(`[TCP] Błąd faktury: ${result.error}`);
          return sendJson(res, 500, { success: false, error: result.error });
        }
      } catch (e) {
        const msg = e.message || "Błąd połączenia z drukarką";
        lastError = { message: msg, timestamp: new Date().toISOString() };
        console.error(`[TCP] Wyjątek: ${msg}`);
        return sendJson(res, 500, { success: false, error: msg });
      }
    }

    // ── Raport X ──
    if (req.method === "POST" && req.url === "/fiscal/report/x") {
      if (!checkAuth(req, res)) return;
      const payload = await parseJson(req, res);

      if (MODE === "spool") {
        const { id, filePath } = await spoolWrite("report-x", { ...payload, _type: "X_REPORT", timestamp: new Date().toISOString() });
        reportCount++;
        console.log(`[SPOOL] raport X #${reportCount} -> ${filePath}`);
        return sendJson(res, 200, { success: true, reportNumber: `X-${id.slice(0, 8).toUpperCase()}` });
      }

      console.log(`[TCP] Drukuję raport X`);
      try {
        const result = await withPrinter(async (socket) => {
          return await printDailyReport(socket, "X");
        });

        if (result.success) {
          reportCount++;
          console.log(`[TCP] Raport X #${reportCount} wydrukowany OK`);
          return sendJson(res, 200, { success: true, reportNumber: `X-${reportCount}` });
        } else {
          lastError = { message: result.error, timestamp: new Date().toISOString() };
          return sendJson(res, 500, { success: false, error: result.error });
        }
      } catch (e) {
        const msg = e.message || "Błąd druku raportu X";
        lastError = { message: msg, timestamp: new Date().toISOString() };
        return sendJson(res, 500, { success: false, error: msg });
      }
    }

    // ── Raport Z ──
    if (req.method === "POST" && req.url === "/fiscal/report/z") {
      if (!checkAuth(req, res)) return;
      const payload = await parseJson(req, res);

      if (MODE === "spool") {
        const { id, filePath } = await spoolWrite("report-z", { ...payload, _type: "Z_REPORT", timestamp: new Date().toISOString() });
        reportCount++;
        console.log(`[SPOOL] raport Z #${reportCount} -> ${filePath}`);
        return sendJson(res, 200, { success: true, reportNumber: `Z-${id.slice(0, 8).toUpperCase()}` });
      }

      console.log(`[TCP] Drukuję raport Z (dobowy)`);
      try {
        const result = await withPrinter(async (socket) => {
          return await printDailyReport(socket, "Z");
        });

        if (result.success) {
          reportCount++;
          console.log(`[TCP] Raport Z #${reportCount} wydrukowany OK`);
          return sendJson(res, 200, { success: true, reportNumber: `Z-${reportCount}` });
        } else {
          lastError = { message: result.error, timestamp: new Date().toISOString() };
          return sendJson(res, 500, { success: false, error: result.error });
        }
      } catch (e) {
        const msg = e.message || "Błąd druku raportu Z";
        lastError = { message: msg, timestamp: new Date().toISOString() };
        return sendJson(res, 500, { success: false, error: msg });
      }
    }

    // ── Raport okresowy ──
    if (req.method === "POST" && req.url === "/fiscal/report/periodic") {
      if (!checkAuth(req, res)) return;
      const payload = await parseJson(req, res);

      if (MODE === "spool") {
        const { id, filePath } = await spoolWrite("report-periodic", { ...payload, _type: "PERIODIC_REPORT", timestamp: new Date().toISOString() });
        reportCount++;
        console.log(`[SPOOL] raport okresowy #${reportCount} -> ${filePath}`);
        return sendJson(res, 200, { success: true, reportNumber: `PER-${id.slice(0, 8).toUpperCase()}` });
      }

      const dateFrom = payload?.dateFrom ? payload.dateFrom.substring(0, 10) : null;
      const dateTo = payload?.dateTo ? payload.dateTo.substring(0, 10) : null;

      if (!dateFrom || !dateTo) {
        return badRequest(res, "Brak dateFrom lub dateTo");
      }

      console.log(`[TCP] Drukuję raport okresowy: ${dateFrom} - ${dateTo}`);
      try {
        const result = await withPrinter(async (socket) => {
          return await printPeriodicReport(socket, dateFrom, dateTo);
        });

        if (result.success) {
          reportCount++;
          console.log(`[TCP] Raport okresowy #${reportCount} wydrukowany OK`);
          return sendJson(res, 200, { success: true, reportNumber: `PER-${reportCount}` });
        } else {
          lastError = { message: result.error, timestamp: new Date().toISOString() };
          return sendJson(res, 500, { success: false, error: result.error });
        }
      } catch (e) {
        const msg = e.message || "Błąd druku raportu okresowego";
        lastError = { message: msg, timestamp: new Date().toISOString() };
        return sendJson(res, 500, { success: false, error: msg });
      }
    }

    // ── Storno ──
    if (req.method === "POST" && req.url === "/fiscal/storno") {
      if (!checkAuth(req, res)) return;
      const payload = await parseJson(req, res);
      if (!payload) return;

      const err = validateStorno(payload);
      if (err) return badRequest(res, err);

      if (MODE === "spool") {
        const { id, filePath } = await spoolWrite("storno", { ...payload, _type: "storno", timestamp: new Date().toISOString() });
        stornoCount++;
        console.log(`[SPOOL] storno #${stornoCount} -> ${filePath}`);
        return sendJson(res, 200, {
          success: true,
          stornoNumber: `ST-${id.slice(0, 8).toUpperCase()}`,
          originalReceiptNumber: payload.originalReceiptNumber,
          stornoAmount: payload.amount,
        });
      }

      // TCP storno — POSNET uses stocash command for returns
      console.log(`[TCP] Storno: ${payload.originalReceiptNumber}, kwota: ${payload.amount} PLN`);
      try {
        const result = await withPrinter(async (socket) => {
          const amount = amountToPosnet(payload.amount);
          const resp = await sendCommand(socket, ["stocash", `kw${amount}`], 15000);
          if (resp.errorCode) {
            return { success: false, error: `stocash error ${resp.errorCode}` };
          }
          return { success: true };
        });

        if (result.success) {
          stornoCount++;
          console.log(`[TCP] Storno #${stornoCount} OK`);
          return sendJson(res, 200, {
            success: true,
            stornoNumber: `ST-${stornoCount}`,
            originalReceiptNumber: payload.originalReceiptNumber,
            stornoAmount: payload.amount,
          });
        } else {
          lastError = { message: result.error, timestamp: new Date().toISOString() };
          return sendJson(res, 500, { success: false, error: result.error });
        }
      } catch (e) {
        const msg = e.message || "Błąd storna";
        lastError = { message: msg, timestamp: new Date().toISOString() };
        return sendJson(res, 500, { success: false, error: msg });
      }
    }

    // ── Anulowanie bieżącej transakcji ──
    if (req.method === "POST" && req.url === "/fiscal/cancel") {
      if (!checkAuth(req, res)) return;

      if (MODE === "spool") {
        return sendJson(res, 200, { success: true, note: "Spool mode — nothing to cancel" });
      }

      try {
        await withPrinter(async (socket) => {
          await cancelTransaction(socket);
        });
        return sendJson(res, 200, { success: true });
      } catch (e) {
        return sendJson(res, 500, { success: false, error: e.message });
      }
    }

    sendJson(res, 404, { success: false, error: "Not found" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bridge error";
    lastError = { message: msg, timestamp: new Date().toISOString() };
    sendJson(res, 500, { success: false, error: msg });
  }
});

// ─── Startup ────────────────────────────────────────────────────────
server.listen(PORT, "127.0.0.1", () => {
  const modeLabel = MODE === "tcp"
    ? `TCP -> ${PRINTER_HOST}:${PRINTER_PORT}`
    : `SPOOL -> ${SPOOL_DIR}`;

  console.log(`\n  ╔══════════════════════════════════════════════════════════╗`);
  console.log(`  ║  POSNET Trio Bridge v2.0.0                              ║`);
  console.log(`  ║  http://127.0.0.1:${String(PORT).padEnd(39)}║`);
  console.log(`  ╠══════════════════════════════════════════════════════════╣`);
  console.log(`  ║  Tryb: ${modeLabel.padEnd(49)}║`);
  console.log(`  ╠══════════════════════════════════════════════════════════╣`);
  console.log(`  ║  Endpointy:                                            ║`);
  console.log(`  ║    GET  /health              - status bridge + drukarka ║`);
  console.log(`  ║    POST /fiscal/print        - paragon                  ║`);
  console.log(`  ║    POST /fiscal/invoice      - faktura VAT              ║`);
  console.log(`  ║    POST /fiscal/report/x     - raport X                 ║`);
  console.log(`  ║    POST /fiscal/report/z     - raport Z (dobowy)        ║`);
  console.log(`  ║    POST /fiscal/report/periodic - raport okresowy       ║`);
  console.log(`  ║    POST /fiscal/storno       - storno/zwrot             ║`);
  console.log(`  ║    POST /fiscal/cancel       - anuluj transakcję        ║`);
  console.log(`  ╚══════════════════════════════════════════════════════════╝\n`);

  if (MODE === "tcp") {
    console.log(`  Sprawdzam połączenie z drukarką ${PRINTER_HOST}:${PRINTER_PORT}...`);
    withPrinter(async (socket) => {
      const check = await healthCheck(socket);
      lastPrinterCheck = check;
      if (check.ok) {
        console.log(`  ✓ Drukarka odpowiada! Data/czas: ${check.dateTime || "?"}`);
      } else {
        console.log(`  ✗ Drukarka nie odpowiada: ${check.error}`);
      }
    }).catch((err) => {
      lastPrinterCheck = { ok: false, error: err.message };
      console.log(`  ✗ Nie można połączyć się z drukarką: ${err.message}`);
    });
  }
});
