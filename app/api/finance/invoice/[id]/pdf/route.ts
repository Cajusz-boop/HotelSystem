import { NextRequest, NextResponse } from "next/server";
import { generateInvoiceHtml, generatePdfFromHtml } from "@/lib/invoice-html";

const PDF_GENERATION_TIMEOUT_MS = Number(process.env.INVOICE_PDF_TIMEOUT_MS) || 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

/**
 * GET /api/finance/invoice/[id]/pdf
 * Zwraca fakturę VAT w HTML (do druku) lub PDF (gdy ?format=pdf).
 * Opcjonalny ?amountOverride=123.45 – nadpisuje kwotę brutto (np. dla faktury zbiorczej przy częściowej zapłacie).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) {
    return new NextResponse("Brak ID faktury", { status: 400 });
  }
  const url = new URL(request.url);
  const amountOverrideParam = url.searchParams.get("amountOverride");
  const amountOverride = amountOverrideParam ? parseFloat(amountOverrideParam) : null;
  const variant = url.searchParams.get("variant"); // "original" = tylko oryginał (dla email), "copy" = tylko kopia, brak = oryginał + kopia
  const formatParam = url.searchParams.get("format");

  try {
    const html = await withTimeout(
      generateInvoiceHtml(id.trim(), amountOverride, variant),
      PDF_GENERATION_TIMEOUT_MS,
      "Timeout generowania PDF faktury (zbyt duża ilość danych). Spróbuj ponownie lub skróć zakres."
    );

    if (formatParam === "pdf") {
      const pdfBuffer = await generatePdfFromHtml(html);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="faktura-vat-${id.trim().replace(/\//g, "-")}.pdf"`,
        },
      });
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="faktura-vat-${id.trim().replace(/\//g, "-")}.html"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND") {
      return new NextResponse("Faktura nie istnieje", { status: 404 });
    }
    if (msg.includes("Timeout")) {
      return new NextResponse("Timeout generowania faktury – zbyt duża ilość pozycji. Spróbuj ponownie.", { status: 503 });
    }
    console.error("[invoice-pdf]", e);
    return new NextResponse("Błąd generowania faktury", { status: 500 });
  }
}
