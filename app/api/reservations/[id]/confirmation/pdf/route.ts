import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const HOTEL_NAME = process.env.HOTEL_NAME ?? "Hotel";

/**
 * GET /api/reservations/[id]/confirmation/pdf
 * Generuje potwierdzenie rezerwacji jako HTML (do druku / Zapisz jako PDF).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) {
    return new NextResponse("Brak ID rezerwacji", { status: 400 });
  }

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: id.trim() },
      include: {
        room: true,
        guest: true,
        company: true,
      },
    });

    if (!reservation) {
      return new NextResponse("Rezerwacja nie istnieje", { status: 404 });
    }

    // Pobierz szablon dokumentu
    let template = await prisma.documentTemplate.findUnique({
      where: { templateType: "CONFIRMATION" },
    });

    // Pobierz szablon faktury dla logo/danych sprzedawcy (jeśli używany)
    const invoiceTemplate = await prisma.invoiceTemplate.findUnique({
      where: { templateType: "DEFAULT" },
    });

    // Utwórz domyślny szablon jeśli nie istnieje
    if (!template) {
      template = await prisma.documentTemplate.create({
        data: {
          templateType: "CONFIRMATION",
          title: "POTWIERDZENIE REZERWACJI",
          welcomeText: "Dziękujemy za dokonanie rezerwacji w naszym hotelu.",
          footerText: "W razie pytań prosimy o kontakt. Do zobaczenia!",
          hotelName: HOTEL_NAME,
        },
      });
    }

    // Dane rezerwacji
    const checkIn = new Date(reservation.checkIn).toLocaleDateString("pl-PL", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const checkOut = new Date(reservation.checkOut).toLocaleDateString("pl-PL", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const nights = Math.ceil(
      (new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalAmount = null; // Reservation nie ma totalAmount – można obliczyć z transakcji

    // Dane hotelu
    let hotelName = template.hotelName || HOTEL_NAME;
    let hotelAddress = template.hotelAddress;
    let hotelPostalCode = template.hotelPostalCode;
    let hotelCity = template.hotelCity;
    let hotelPhone = template.hotelPhone;
    let hotelEmail = template.hotelEmail;
    let hotelWebsite = template.hotelWebsite;

    // Jeśli używamy danych z szablonu faktury
    if (template.useInvoiceSeller && invoiceTemplate) {
      hotelName = invoiceTemplate.sellerName || hotelName;
      hotelAddress = invoiceTemplate.sellerAddress || hotelAddress;
      hotelPostalCode = invoiceTemplate.sellerPostalCode || hotelPostalCode;
      hotelCity = invoiceTemplate.sellerCity || hotelCity;
      hotelPhone = invoiceTemplate.sellerPhone || hotelPhone;
      hotelEmail = invoiceTemplate.sellerEmail || hotelEmail;
      hotelWebsite = invoiceTemplate.sellerWebsite || hotelWebsite;
    }

    // Logo
    let logoHtml = "";
    let logoSrc: string | null = null;
    let logoWidth = template.logoWidth;
    
    if (template.useInvoiceLogo && invoiceTemplate?.logoBase64) {
      logoSrc = `data:image/png;base64,${invoiceTemplate.logoBase64}`;
      logoWidth = invoiceTemplate.logoWidth;
    } else if (template.useInvoiceLogo && invoiceTemplate?.logoUrl) {
      logoSrc = invoiceTemplate.logoUrl;
      logoWidth = invoiceTemplate.logoWidth;
    } else if (template.logoBase64) {
      logoSrc = `data:image/png;base64,${template.logoBase64}`;
    } else if (template.logoUrl) {
      logoSrc = template.logoUrl;
    }

    if (logoSrc) {
      const logoAlign = template.logoPosition === "center" ? "center" : 
                        template.logoPosition === "right" ? "right" : "left";
      logoHtml = `
        <div style="text-align: ${logoAlign}; margin-bottom: 1.5rem;">
          <img src="${logoSrc}" alt="Logo" style="max-width: ${logoWidth}px; height: auto;" />
        </div>
      `;
    }

    // Buduj dane hotelu HTML
    const hotelLines: string[] = [
      hotelName,
      ...(hotelAddress ? [hotelAddress] : []),
      ...(hotelPostalCode || hotelCity
        ? [[hotelPostalCode, hotelCity].filter(Boolean).join(" ")]
        : []),
      ...(hotelPhone ? [`Tel: ${hotelPhone}`] : []),
      ...(hotelEmail ? [`Email: ${hotelEmail}`] : []),
      ...(hotelWebsite ? [hotelWebsite] : []),
    ].filter(Boolean);
    const hotelHtml = hotelLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");

    // Data wystawienia
    const issuedDate = new Date().toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(template.title || "Potwierdzenie rezerwacji")} - ${escapeHtml(reservation.confirmationNumber || reservation.id.slice(-8))}</title>
  <style>
    body { 
      font-family: ${template.fontFamily}; 
      max-width: 800px; 
      margin: 2rem auto; 
      padding: 1rem; 
      color: ${template.primaryColor}; 
      font-size: ${template.fontSize}px;
      line-height: 1.6;
    }
    h1 { 
      font-size: 1.5rem; 
      margin-bottom: 1.5rem; 
      color: ${template.accentColor};
      text-align: center;
      border-bottom: 2px solid ${template.accentColor};
      padding-bottom: 0.5rem;
    }
    .header-info { 
      display: flex; 
      justify-content: space-between; 
      margin-bottom: 2rem; 
      gap: 2rem;
    }
    .header-info > div { flex: 1; }
    .mb-0 { margin-bottom: 0; }
    .mt-2 { margin-top: 1rem; }
    .mb-2 { margin-bottom: 1rem; }
    .text-muted { color: #666; font-size: 0.875rem; }
    .details-box {
      background: ${template.accentColor}10;
      border: 1px solid ${template.accentColor}30;
      border-radius: 8px;
      padding: 1.5rem;
      margin: 1.5rem 0;
    }
    .details-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    .detail-item {
      padding: 0.5rem 0;
    }
    .detail-label {
      font-size: 0.875rem;
      color: #666;
      margin-bottom: 0.25rem;
    }
    .detail-value {
      font-weight: 600;
      color: ${template.accentColor};
    }
    .guest-info {
      background: #f9f9f9;
      padding: 1rem;
      border-radius: 4px;
      margin: 1rem 0;
    }
    .total-box {
      background: ${template.accentColor};
      color: white;
      padding: 1rem;
      border-radius: 4px;
      text-align: center;
      margin: 1.5rem 0;
    }
    .total-amount {
      font-size: 1.5rem;
      font-weight: 700;
    }
    .welcome-text {
      font-style: italic;
      color: ${template.accentColor};
      text-align: center;
      margin: 1rem 0;
    }
    .footer-text {
      border-top: 1px solid #ddd;
      padding-top: 1rem;
      margin-top: 2rem;
      text-align: center;
      color: #666;
    }
    .terms-text {
      font-size: 0.8rem;
      color: #666;
      margin-top: 1.5rem;
      padding: 1rem;
      background: #f5f5f5;
      border-radius: 4px;
    }
    .confirmation-number {
      background: ${template.accentColor};
      color: white;
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-weight: 600;
      font-family: monospace;
    }
    @media print { 
      body { margin: 0; padding: 0.5rem; } 
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  ${logoHtml}
  
  <h1>${escapeHtml(reservation.status === "CANCELLED" ? "POTWIERDZENIE REZERWACJI (ANULOWANA)" : (template.title || "POTWIERDZENIE REZERWACJI"))}</h1>
  ${reservation.status === "CANCELLED" ? `<div class="details-box" style="background: #fef2f2; border-color: #dc2626; margin-bottom: 1rem;"><p class="mb-0" style="color: #b91c1c; font-weight: 600;">Ta rezerwacja została anulowana. Dokument ma charakter informacyjny.</p></div>` : ""}
  
  <div class="header-info">
    <div>
      ${hotelHtml}
    </div>
    <div style="text-align: right;">
      <p class="mb-0"><strong>Data wystawienia:</strong> ${escapeHtml(issuedDate)}</p>
      ${reservation.confirmationNumber ? `<p class="mb-0"><strong>Nr potwierdzenia:</strong> <span class="confirmation-number">${escapeHtml(reservation.confirmationNumber)}</span></p>` : ""}
    </div>
  </div>

  ${template.welcomeText ? `<p class="welcome-text">${escapeHtml(template.welcomeText)}</p>` : ""}

  ${template.headerText ? `<div class="mb-2">${escapeHtml(template.headerText).replace(/\n/g, "<br>")}</div>` : ""}

  <div class="guest-info">
    <strong>Dane gościa:</strong>
    <p class="mb-0">${escapeHtml(reservation.guest?.name ?? "— (brak danych gościa)")}</p>
    ${reservation.guest?.email ? `<p class="mb-0">Email: ${escapeHtml(reservation.guest.email)}</p>` : ""}
    ${reservation.guest?.phone ? `<p class="mb-0">Tel: ${escapeHtml(reservation.guest.phone)}</p>` : ""}
  </div>

  <div class="details-box">
    <div class="details-grid">
      <div class="detail-item">
        <div class="detail-label">Pokój</div>
        <div class="detail-value">${escapeHtml(reservation.room.number)} ${reservation.room.type ? `(${escapeHtml(reservation.room.type)})` : ""}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Liczba osób</div>
        <div class="detail-value">${reservation.adults || 1} dorosłych${reservation.children ? `, ${reservation.children} dzieci` : ""}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Zameldowanie</div>
        <div class="detail-value">${escapeHtml(checkIn)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Wymeldowanie</div>
        <div class="detail-value">${escapeHtml(checkOut)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Liczba nocy</div>
        <div class="detail-value">${nights}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Status</div>
        <div class="detail-value">${escapeHtml(reservation.status)}</div>
      </div>
    </div>
  </div>

  ${totalAmount ? `
  <div class="total-box">
    <div>Wartość pobytu</div>
    <div class="total-amount">${totalAmount} PLN</div>
  </div>
  ` : ""}

  ${reservation.notes ? `
  <div class="mt-2">
    <strong>Uwagi:</strong>
    <p>${escapeHtml(reservation.notes)}</p>
  </div>
  ` : ""}

  ${template.termsText ? `
  <div class="terms-text">
    <strong>Warunki rezerwacji:</strong><br>
    ${escapeHtml(template.termsText).replace(/\n/g, "<br>")}
  </div>
  ` : ""}

  ${template.footerText ? `
  <div class="footer-text">
    ${escapeHtml(template.footerText).replace(/\n/g, "<br>")}
  </div>
  ` : ""}

  <p class="mt-2 text-muted no-print" style="font-size: 0.75rem; text-align: center;">
    Dokument wygenerowany z systemu Hotel PMS. Do druku: użyj „Drukuj" → „Zapisz jako PDF".
  </p>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="potwierdzenie-${reservation.confirmationNumber || reservation.id.slice(-8)}.html"`,
      },
    });
  } catch (e) {
    console.error("[confirmation-pdf]", e);
    return new NextResponse("Błąd generowania potwierdzenia", { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
