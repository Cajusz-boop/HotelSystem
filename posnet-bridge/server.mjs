import http from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.POSNET_BRIDGE_PORT ?? "9977");
const API_KEY = process.env.FISCAL_POSNET_API_KEY || "";
const SPOOL_DIR = process.env.FISCAL_POSNET_SPOOL_DIR || join(process.cwd(), "posnet-bridge", "spool");

const MAX_BODY_BYTES = 1_000_000;

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function unauthorized(res) {
  return sendJson(res, 401, { success: false, error: "Unauthorized (x-api-key)" });
}

function badRequest(res, error) {
  return sendJson(res, 400, { success: false, error });
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

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && req.url === "/fiscal/print") {
      if (API_KEY) {
        const headerKey = req.headers["x-api-key"];
        if (typeof headerKey !== "string" || headerKey !== API_KEY) {
          return unauthorized(res);
        }
      }

      const raw = await readBody(req);
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        return badRequest(res, "Nieprawidłowy JSON");
      }

      const err = validateReceipt(payload);
      if (err) return badRequest(res, err);

      await mkdir(SPOOL_DIR, { recursive: true });
      const id = randomUUID();
      const filePath = join(SPOOL_DIR, `${new Date().toISOString().replaceAll(":", "-")}_${id}.json`);
      await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

      // Na tym etapie bridge tylko kolekcjonuje zlecenia.
      // W następnym kroku podpinamy tu sterownik POSNET/OPOS/SDK i drukujemy.
      console.log(`[POSNET BRIDGE] queued receipt -> ${filePath}`);

      return sendJson(res, 200, { success: true, receiptNumber: `BRIDGE-${id.slice(0, 8)}` });
    }

    if (req.method === "POST" && req.url === "/fiscal/invoice") {
      if (API_KEY) {
        const headerKey = req.headers["x-api-key"];
        if (typeof headerKey !== "string" || headerKey !== API_KEY) {
          return unauthorized(res);
        }
      }

      const raw = await readBody(req);
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        return badRequest(res, "Nieprawidłowy JSON");
      }

      const err = validateInvoice(payload);
      if (err) return badRequest(res, err);

      await mkdir(SPOOL_DIR, { recursive: true });
      const id = randomUUID();
      const filePath = join(SPOOL_DIR, `invoice_${new Date().toISOString().replaceAll(":", "-")}_${id}.json`);
      await writeFile(filePath, JSON.stringify({ ...payload, _type: "invoice" }, null, 2), "utf8");

      console.log(`[POSNET BRIDGE] queued invoice -> ${filePath}`);

      return sendJson(res, 200, { success: true, invoiceNumber: `BRIDGE-FV-${id.slice(0, 8)}` });
    }

    sendJson(res, 404, { success: false, error: "Not found" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bridge error";
    sendJson(res, 500, { success: false, error: msg });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[POSNET BRIDGE] listening on http://127.0.0.1:${PORT}`);
  console.log(`[POSNET BRIDGE] endpoints: POST /fiscal/print, POST /fiscal/invoice`);
  console.log(`[POSNET BRIDGE] spool dir: ${SPOOL_DIR}`);
});

