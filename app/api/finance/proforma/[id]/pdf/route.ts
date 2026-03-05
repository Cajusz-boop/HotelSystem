import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const HOTEL_NAME = process.env.HOTEL_NAME ?? "Hotel";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function amountToWords(amount: number): string {
  const units = ["", "jeden", "dwa", "trzy", "cztery", "pięć", "sześć", "siedem", "osiem", "dziewięć"];
  const teens = ["dziesięć", "jedenaście", "dwanaście", "trzynaście", "czternaście", "piętnaście", "szesnaście", "siedemnaście", "osiemnaście", "dziewiętnaście"];
  const tens = ["", "", "dwadzieścia", "trzydzieści", "czterdzieści", "pięćdziesiąt", "sześćdziesiąt", "siedemdziesiąt", "osiemdziesiąt", "dziewięćdziesiąt"];
  const hundreds = ["", "sto", "dwieście", "trzysta", "czterysta", "pięćset", "sześćset", "siedemset", "osiemset", "dziewięćset"];

  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);

  if (intPart === 0) return `zero ${decPart.toString().padStart(2, "0")}/100`;

  const convertGroup = (n: number): string => {
    if (n === 0) return "";
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const t = Math.floor(n / 10);
      const u = n % 10;
      return tens[t] + (u > 0 ? " " + units[u] : "");
    }
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return hundreds[h] + (rest > 0 ? " " + convertGroup(rest) : "");
  };

  let result = "";
  if (intPart >= 1000) {
    const thousands = Math.floor(intPart / 1000);
    result = thousands === 1 ? "jeden tysiąc" : convertGroup(thousands) + (thousands >= 2 && thousands <= 4 ? " tysiące" : " tysięcy");
    const rest = intPart % 1000;
    if (rest > 0) result += " " + convertGroup(rest);
  } else {
    result = convertGroup(intPart);
  }
  return result + " " + decPart.toString().padStart(2, "0") + "/100";
}

/**
 * GET /api/finance/proforma/[id]/pdf
 * Zwraca proformę rezerwacji w HTML (do druku / Zapisz jako PDF).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) {
    return new NextResponse("Brak ID proformy", { status: 400 });
  }

  try {
    const proforma = await prisma.proforma.findUnique({
      where: { id: id.trim() },
      include: {
        reservation: {
          include: { company: true, guest: { select: { name: true } } },
        },
      },
    });

    if (!proforma) {
      return new NextResponse("Proforma nie istnieje", { status: 404 });
    }

    let template = await prisma.invoiceTemplate.findUnique({
      where: { templateType: "DEFAULT" },
    });

    if (!template) {
      template = await prisma.invoiceTemplate.create({
        data: {
          templateType: "DEFAULT",
          sellerName: HOTEL_NAME,
          footerText: "Dziękujemy za skorzystanie z naszych usług.",
          thanksText: "Zapraszamy ponownie!",
        },
      });
    }

    const amount = Number(proforma.amount);
    const issueDate = new Date(proforma.issuedAt).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const company = proforma.reservation?.company;
    const buyerName = company?.name ?? proforma.reservation?.guest?.name ?? "—";
    const buyerNip = company?.nip?.trim() ?? "";
    const buyerAddress = [company?.address, company?.postalCode, company?.city].filter(Boolean).join(", ");

    const sellerLines: string[] = [
      template.sellerName || HOTEL_NAME,
      ...(template.sellerAddress ? [template.sellerAddress] : []),
      ...(template.sellerPostalCode || template.sellerCity
        ? [[template.sellerPostalCode, template.sellerCity].filter(Boolean).join(" ")]
        : []),
      ...(template.sellerNip ? [`NIP: ${template.sellerNip}`] : []),
    ].filter(Boolean);

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>Proforma ${escapeHtml(proforma.number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ${escapeHtml(template.fontFamily || "Arial, sans-serif")}; max-width: 900px; margin: 1rem auto; padding: 1rem; font-size: 12px; }
    h1 { font-size: 1.3rem; margin: 0.5rem 0 1rem; text-align: center; }
    .header-row { display: flex; justify-content: space-between; margin-bottom: 1rem; font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid #333; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .text-right { text-align: right; }
    .payment-box { margin-top: 1rem; padding: 1rem; border: 1px solid #ccc; border-radius: 4px; display: flex; flex-wrap: wrap; gap: 2rem; }
    .amount-words { margin-top: 1rem; font-size: 0.95rem; }
    .footer { margin-top: 2rem; font-size: 0.85rem; color: #666; }
  </style>
</head>
<body>
  <h1>Proforma ${escapeHtml(proforma.number)} oryginał</h1>
  <div class="header-row">
    <div>
      <strong>Sprzedawca:</strong><br>
      ${sellerLines.map((l) => escapeHtml(l)).join("<br>")}
    </div>
    <div style="text-align: right;">
      <strong>Data wystawienia:</strong> ${issueDate}
    </div>
  </div>
  <div class="header-row">
    <div>
      <strong>Nabywca:</strong><br>
      ${escapeHtml(buyerName)}<br>
      ${buyerAddress ? escapeHtml(buyerAddress) + "<br>" : ""}
      ${buyerNip ? "NIP: " + escapeHtml(buyerNip) : ""}
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Lp</th><th>Opis</th><th class="text-right">Kwota brutto (zł)</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>Rezerwacja noclegowa – ${escapeHtml(proforma.reservation?.guest?.name ?? "gość")}</td>
        <td class="text-right">${amount.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  <div class="payment-box">
    <div>
      <strong>Do zapłaty:</strong><br>
      <span style="font-size: 1.2rem; font-weight: 600;">${amount.toFixed(2)} zł</span>
    </div>
  </div>
  <div class="amount-words">
    <strong>Słownie zł:</strong> ${amountToWords(amount)}
  </div>
  <div class="footer">
    ${template.footerText ? escapeHtml(template.footerText) : ""}
  </div>
  <p class="footer" style="margin-top: 1rem; font-size: 0.75rem; color: #999;">
    Dokument wygenerowany z systemu Hotel PMS. Do druku: użyj „Drukuj" → „Zapisz jako PDF".
  </p>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="proforma-${proforma.number.replace(/\//g, "-")}.html"`,
      },
    });
  } catch (e) {
    console.error("[proforma-pdf]", e);
    return new NextResponse("Błąd generowania proformy", { status: 500 });
  }
}
