import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const HOTEL_NAME = process.env.HOTEL_NAME ?? "Hotel";

/**
 * GET /api/finance/deposit-invoice/[transactionId]
 * Zwraca dokument „Faktura zaliczkowa” w HTML (do druku / Zapisz jako PDF).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  const { transactionId } = await params;
  if (!transactionId?.trim()) {
    return new NextResponse("Brak ID transakcji", { status: 400 });
  }

  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId.trim(), type: "DEPOSIT" },
      include: {
        reservation: {
          include: {
            guest: true,
            room: true,
            company: true,
          },
        },
      },
    });

    if (!tx) {
      return new NextResponse("Transakcja zaliczkowa nie istnieje", { status: 404 });
    }

    const config = await prisma.cennikConfig.findUnique({
      where: { id: "default" },
      select: { currency: true, vatPercent: true, pricesAreNetto: true },
    }).catch(() => null);

    const currency = config?.currency ?? "PLN";
    const vatPercent = config?.vatPercent != null ? Number(config.vatPercent) : 0;
    const amount = Number(tx.amount);
    const date = new Date(tx.createdAt).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const invoiceNumber = `ZAL-${tx.id.slice(-8).toUpperCase()}`;
    const guest = tx.reservation.guest;
    const room = tx.reservation.room;
    const company = tx.reservation.company;
    const checkIn = new Date(tx.reservation.checkIn).toLocaleDateString("pl-PL");
    const checkOut = new Date(tx.reservation.checkOut).toLocaleDateString("pl-PL");

    const buyerLines: string[] = [guest.name];
    if (company) {
      buyerLines.push(company.name);
      if (company.nip) buyerLines.push(`NIP: ${company.nip}`);
      if (company.address) buyerLines.push(company.address);
      if (company.postalCode || company.city) {
        buyerLines.push([company.postalCode, company.city].filter(Boolean).join(" "));
      }
    }
    const buyerHtml = buyerLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>Faktura zaliczkowa ${escapeHtml(invoiceNumber)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 1rem; color: #111; }
    h1 { font-size: 1.25rem; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid #ccc; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    .text-right { text-align: right; }
    .mt-2 { margin-top: 1rem; }
    .mb-0 { margin-bottom: 0; }
    .text-muted { color: #666; font-size: 0.875rem; }
    @media print { body { margin: 0; padding: 0.5rem; } }
  </style>
</head>
<body>
  <h1>Faktura zaliczkowa</h1>
  <p><strong>Numer:</strong> ${escapeHtml(invoiceNumber)}</p>
  <p><strong>Data:</strong> ${escapeHtml(date)}</p>

  <div class="mt-2">
    <strong>Sprzedawca:</strong>
    <p class="mb-0">${escapeHtml(HOTEL_NAME)}</p>
  </div>

  <div class="mt-2">
    <strong>Nabywca:</strong>
    ${buyerHtml}
  </div>

  <p class="mt-2 text-muted">
    Rezerwacja: pokój ${escapeHtml(room.number)}, pobyt ${escapeHtml(checkIn)} – ${escapeHtml(checkOut)}.
  </p>

  <table>
    <thead>
      <tr>
        <th>Lp</th>
        <th>Nazwa</th>
        <th class="text-right">Kwota (${escapeHtml(currency)})</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>Zaliczka na poczet usług hotelowych</td>
        <td class="text-right">${amount.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <p class="mt-2 text-muted">
    ${vatPercent > 0 ? `VAT ${vatPercent}% (z konfiguracji cennika). ` : ""}
    Kwota do zapłaty: <strong>${amount.toFixed(2)} ${escapeHtml(currency)}</strong>
  </p>

  <p class="mt-2 text-muted" style="font-size: 0.75rem;">
    Dokument wygenerowany z systemu Hotel PMS. Do druku: użyj „Drukuj” → „Zapisz jako PDF”.
  </p>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="faktura-zaliczkowa-${invoiceNumber}.html"`,
      },
    });
  } catch (e) {
    console.error("[deposit-invoice]", e);
    return new NextResponse("Błąd generowania faktury zaliczkowej", { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
