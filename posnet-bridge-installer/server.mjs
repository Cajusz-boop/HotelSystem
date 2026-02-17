import http from "node:http";
import { mkdir, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.POSNET_BRIDGE_PORT ?? "9977");
const API_KEY = process.env.FISCAL_POSNET_API_KEY || "";
const SPOOL_DIR = process.env.FISCAL_POSNET_SPOOL_DIR || join(process.cwd(), "spool");

const MAX_BODY_BYTES = 1_000_000;
let startedAt = new Date().toISOString();
let receiptCount = 0;
let invoiceCount = 0;
let reportCount = 0;
let stornoCount = 0;
let lastError = null;

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
    badRequest(res, "Nieprawidlowy JSON");
    return null;
  }
}

async function spoolWrite(prefix, payload) {
  await mkdir(SPOOL_DIR, { recursive: true });
  const id = randomUUID();
  const ts = new Date().toISOString().replaceAll(":", "-");
  const filePath = join(SPOOL_DIR, `${prefix}_${ts}_${id}.json`);
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return { id, filePath };
}

function validateReceipt(payload) {
  if (!payload || typeof payload !== "object") return "Nieprawidlowy JSON";
  if (typeof payload.transactionId !== "string" || !payload.transactionId) return "Brak transactionId";
  if (typeof payload.reservationId !== "string" || !payload.reservationId) return "Brak reservationId";
  if (!Array.isArray(payload.items) || payload.items.length < 1) return "Brak items";
  if (typeof payload.totalAmount !== "number" || !(payload.totalAmount > 0)) return "Brak/nieprawidlowe totalAmount";
  if (typeof payload.paymentType !== "string" || !payload.paymentType) return "Brak paymentType";
  return null;
}

function validateInvoice(payload) {
  if (!payload || typeof payload !== "object") return "Nieprawidlowy JSON";
  if (typeof payload.reservationId !== "string" || !payload.reservationId) return "Brak reservationId";
  const company = payload.company;
  if (!company || typeof company !== "object") return "Brak company";
  if (typeof company.nip !== "string" || !company.nip) return "Brak company.nip";
  if (typeof company.name !== "string" || !company.name) return "Brak company.name";
  if (!Array.isArray(payload.items) || payload.items.length < 1) return "Brak items";
  if (typeof payload.totalAmount !== "number" || payload.totalAmount < 0) return "Brak/nieprawidlowe totalAmount";
  return null;
}

function validateStorno(payload) {
  if (!payload || typeof payload !== "object") return "Nieprawidlowy JSON";
  if (!payload.originalReceiptNumber) return "Brak originalReceiptNumber";
  if (!payload.reason) return "Brak reason";
  if (typeof payload.amount !== "number" || payload.amount <= 0) return "Brak/nieprawidlowe amount";
  return null;
}

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
    if (req.method === "GET" && req.url === "/health") {
      let spoolFiles = 0;
      try {
        const files = await readdir(SPOOL_DIR);
        spoolFiles = files.filter((f) => f.endsWith(".json")).length;
      } catch { /* spool dir may not exist yet */ }

      return sendJson(res, 200, {
        ok: true,
        bridge: "posnet-bridge",
        version: "1.1.0",
        startedAt,
        uptime: Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
        counters: { receipts: receiptCount, invoices: invoiceCount, reports: reportCount, stornos: stornoCount },
        spoolFiles,
        lastError,
        mode: "spool",
      });
    }

    if (req.method === "POST" && req.url === "/fiscal/print") {
      if (!checkAuth(req, res)) return;
      const payload = await parseJson(req, res);
      if (!payload) return;
      const err = validateReceipt(payload);
      if (err) return badRequest(res, err);
      const { id, filePath } = await spoolWrite("receipt", payload);
      receiptCount++;
      console.log(`[PARAGON #${receiptCount}] ${filePath}`);
      return sendJson(res, 200, { success: true, receiptNumber: `PAR-${id.slice(0, 8).toUpperCase()}` });
    }

    if (req.method === "POST" && req.url === "/fiscal/invoice") {
      if (!checkAuth(req, res)) return;
      const payload = await parseJson(req, res);
      if (!payload) return;
      const err = validateInvoice(payload);
      if (err) return badRequest(res, err);
      const { id, filePath } = await spoolWrite("invoice", { ...payload, _type: "invoice" });
      invoiceCount++;
      console.log(`[FAKTURA #${invoiceCount}] ${filePath}`);
      return sendJson(res, 200, { success: true, invoiceNumber: `FV-${id.slice(0, 8).toUpperCase()}` });
    }

    if (req.method === "POST" && req.url === "/fiscal/report/x") {
      if (!checkAuth(req, res)) return;
      const payload = await parseJson(req, res);
      const { id, filePath } = await spoolWrite("report-x", { ...payload, _type: "X_REPORT", timestamp: new Date().toISOString() });
      reportCount++;
      console.log(`[RAPORT X #${reportCount}] ${filePath}`);
      return sendJson(res, 200, { success: true, reportNumber: `X-${id.slice(0, 8).toUpperCase()}` });
    }

    if (req.method === "POST" && req.url === "/fiscal/report/z") {
      if (!checkAuth(req, res)) return;
      const payload = await parseJson(req, res);
      const { id, filePath } = await spoolWrite("report-z", { ...payload, _type: "Z_REPORT", timestamp: new Date().toISOString() });
      reportCount++;
      console.log(`[RAPORT Z #${reportCount}] ${filePath}`);
      return sendJson(res, 200, { success: true, reportNumber: `Z-${id.slice(0, 8).toUpperCase()}` });
    }

    if (req.method === "POST" && req.url === "/fiscal/report/periodic") {
      if (!checkAuth(req, res)) return;
      const payload = await parseJson(req, res);
      const { id, filePath } = await spoolWrite("report-periodic", { ...payload, _type: "PERIODIC_REPORT", timestamp: new Date().toISOString() });
      reportCount++;
      console.log(`[RAPORT OKRESOWY #${reportCount}] ${filePath}`);
      return sendJson(res, 200, { success: true, reportNumber: `PER-${id.slice(0, 8).toUpperCase()}` });
    }

    if (req.method === "POST" && req.url === "/fiscal/storno") {
      if (!checkAuth(req, res)) return;
      const payload = await parseJson(req, res);
      if (!payload) return;
      const err = validateStorno(payload);
      if (err) return badRequest(res, err);
      const { id, filePath } = await spoolWrite("storno", { ...payload, _type: "storno", timestamp: new Date().toISOString() });
      stornoCount++;
      console.log(`[STORNO #${stornoCount}] ${filePath}`);
      return sendJson(res, 200, { success: true, stornoNumber: `ST-${id.slice(0, 8).toUpperCase()}`, originalReceiptNumber: payload.originalReceiptNumber, stornoAmount: payload.amount });
    }

    sendJson(res, 404, { success: false, error: "Not found" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bridge error";
    lastError = { message: msg, timestamp: new Date().toISOString() };
    sendJson(res, 500, { success: false, error: msg });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("  ====================================================");
  console.log("  POSNET Trio Bridge v1.1.0");
  console.log(`  Nasluchuje na: http://127.0.0.1:${PORT}`);
  console.log("  ====================================================");
  console.log("  Endpointy:");
  console.log("    GET  /health              - status");
  console.log("    POST /fiscal/print        - paragon");
  console.log("    POST /fiscal/invoice      - faktura");
  console.log("    POST /fiscal/report/x     - raport X");
  console.log("    POST /fiscal/report/z     - raport Z");
  console.log("    POST /fiscal/report/periodic - raport okresowy");
  console.log("    POST /fiscal/storno       - storno");
  console.log("  ====================================================");
  console.log(`  Zlecenia zapisywane do: ${SPOOL_DIR}`);
  console.log("  ====================================================");
  console.log("");
  console.log("  Bridge dziala. Nie zamykaj tego okna!");
  console.log("  Otworz przegladarke: https://hotel.karczma-labedz.pl");
  console.log("");
});
