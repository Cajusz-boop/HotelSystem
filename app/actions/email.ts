"use server";

import nodemailer from "nodemailer";
import puppeteer from "puppeteer";
import { prisma } from "@/lib/db";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
  });
}

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3011"
  );
}

/**
 * Konwertuje stronę HTML (faktura/proforma) na PDF za pomocą Puppeteer.
 */
async function generatePdfBuffer(htmlUrl: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(htmlUrl, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Wysyła fakturę na email z załącznikiem PDF (oryginał).
 */
export async function sendInvoiceByEmail(data: {
  invoiceId: string;
  recipientEmail: string;
  subject: string;
  message: string;
  amountOverride?: number | null;
}): Promise<ActionResult<{ sent: boolean }>> {
  const transporter = getTransporter();
  if (!transporter) {
    return {
      success: false,
      error:
        "Konfiguracja SMTP nie jest ustawiona. Dodaj zmienne SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS w pliku .env",
    };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: data.invoiceId },
    select: { id: true, number: true },
  });
  if (!invoice) {
    return { success: false, error: "Faktura nie istnieje" };
  }

  const baseUrl = getBaseUrl();
  const params = new URLSearchParams();
  if (data.amountOverride != null && Number.isFinite(data.amountOverride)) {
    params.set("amountOverride", String(data.amountOverride));
  }
  params.set("variant", "original"); // tylko oryginał w załączniku (nie kopia)
  const pdfUrl = `${baseUrl}/api/finance/invoice/${data.invoiceId}/pdf?${params.toString()}`;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const filename = `${invoice.number.replace(/\//g, "_")}.pdf`;

  try {
    const pdfBuffer = await generatePdfBuffer(pdfUrl);
    await transporter.sendMail({
      from,
      to: data.recipientEmail,
      subject: data.subject,
      text: data.message,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
    return { success: true, data: { sent: true } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Błąd wysyłki email";
    return { success: false, error: msg };
  }
}

/**
 * Wysyła proformę na email z załącznikiem PDF.
 */
export async function sendProformaByEmail(data: {
  proformaId: string;
  recipientEmail: string;
  subject: string;
  message: string;
}): Promise<ActionResult<{ sent: boolean }>> {
  const transporter = getTransporter();
  if (!transporter) {
    return {
      success: false,
      error:
        "Konfiguracja SMTP nie jest ustawiona. Dodaj zmienne SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS w pliku .env",
    };
  }

  const proforma = await prisma.proforma.findUnique({
    where: { id: data.proformaId },
    select: { id: true, number: true },
  });
  if (!proforma) {
    return { success: false, error: "Proforma nie istnieje" };
  }

  const baseUrl = getBaseUrl();
  const pdfUrl = `${baseUrl}/api/finance/proforma/${data.proformaId}/pdf?variant=original`;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const filename = `${proforma.number.replace(/\//g, "_")}.pdf`;

  try {
    const pdfBuffer = await generatePdfBuffer(pdfUrl);
    await transporter.sendMail({
      from,
      to: data.recipientEmail,
      subject: data.subject,
      text: data.message,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
    return { success: true, data: { sent: true } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Błąd wysyłki email";
    return { success: false, error: msg };
  }
}
