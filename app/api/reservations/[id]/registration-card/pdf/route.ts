import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const HOTEL_NAME = process.env.HOTEL_NAME ?? "Hotel";

/**
 * GET /api/reservations/[id]/registration-card/pdf
 * Generuje kartę meldunkową jako HTML (do druku / Zapisz jako PDF).
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
      where: { templateType: "REGISTRATION_CARD" },
    });

    // Pobierz szablon faktury dla logo/danych sprzedawcy (jeśli używany)
    const invoiceTemplate = await prisma.invoiceTemplate.findUnique({
      where: { templateType: "DEFAULT" },
    });

    // Utwórz domyślny szablon jeśli nie istnieje
    if (!template) {
      template = await prisma.documentTemplate.create({
        data: {
          templateType: "REGISTRATION_CARD",
          title: "KARTA MELDUNKOWA",
          showIdField: true,
          showSignatureField: true,
          showVehicleField: true,
          footerText: "Podpis gościa jest wymagany. Dane przetwarzane zgodnie z RODO.",
          hotelName: HOTEL_NAME,
        },
      });
    }

    // Dane rezerwacji
    const checkIn = new Date(reservation.checkIn).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const checkOut = new Date(reservation.checkOut).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const nights = Math.ceil(
      (new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Dane hotelu
    let hotelName = template.hotelName || HOTEL_NAME;
    let hotelAddress = template.hotelAddress;
    let hotelPostalCode = template.hotelPostalCode;
    let hotelCity = template.hotelCity;
    let hotelPhone = template.hotelPhone;
    let hotelEmail = template.hotelEmail;

    // Jeśli używamy danych z szablonu faktury
    if (template.useInvoiceSeller && invoiceTemplate) {
      hotelName = invoiceTemplate.sellerName || hotelName;
      hotelAddress = invoiceTemplate.sellerAddress || hotelAddress;
      hotelPostalCode = invoiceTemplate.sellerPostalCode || hotelPostalCode;
      hotelCity = invoiceTemplate.sellerCity || hotelCity;
      hotelPhone = invoiceTemplate.sellerPhone || hotelPhone;
      hotelEmail = invoiceTemplate.sellerEmail || hotelEmail;
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
        <div style="text-align: ${logoAlign}; margin-bottom: 1rem;">
          <img src="${logoSrc}" alt="Logo" style="max-width: ${logoWidth}px; height: auto;" />
        </div>
      `;
    }

    // Buduj dane hotelu HTML
    const hotelInfoHtml = [
      hotelName,
      hotelAddress,
      [hotelPostalCode, hotelCity].filter(Boolean).join(" "),
      hotelPhone ? `Tel: ${hotelPhone}` : null,
      hotelEmail ? `Email: ${hotelEmail}` : null,
    ]
      .filter(Boolean)
      .map((l) => `<span>${escapeHtml(l as string)}</span>`)
      .join(" | ");

    // Data wystawienia
    const issuedDate = new Date().toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const issuedTime = new Date().toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(template.title || "Karta meldunkowa")} - ${escapeHtml(reservation.room.number)}</title>
  <style>
    body { 
      font-family: ${template.fontFamily}; 
      max-width: 800px; 
      margin: 1rem auto; 
      padding: 1rem; 
      color: ${template.primaryColor}; 
      font-size: ${template.fontSize}px;
      line-height: 1.4;
    }
    h1 { 
      font-size: 1.3rem; 
      margin-bottom: 0.5rem; 
      color: ${template.accentColor};
      text-align: center;
      border-bottom: 2px solid ${template.accentColor};
      padding-bottom: 0.5rem;
    }
    .hotel-info {
      text-align: center;
      font-size: 0.8rem;
      color: #666;
      margin-bottom: 1rem;
    }
    .section-title {
      font-weight: 600;
      color: ${template.accentColor};
      margin: 1rem 0 0.5rem;
      font-size: 0.9rem;
      border-bottom: 1px solid ${template.accentColor}40;
      padding-bottom: 0.25rem;
    }
    .form-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1rem;
    }
    .form-table td {
      padding: 0.4rem 0.5rem;
      border: 1px solid #ddd;
      vertical-align: top;
    }
    .form-table .label {
      background: #f9f9f9;
      font-weight: 500;
      width: 30%;
      font-size: 0.85rem;
      color: #555;
    }
    .form-table .value {
      width: 70%;
    }
    .input-line {
      min-height: 1.2rem;
      border-bottom: 1px dotted #999;
      display: inline-block;
      width: 100%;
    }
    .signature-box {
      margin-top: 2rem;
      padding: 1rem;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .signature-line {
      margin-top: 2.5rem;
      border-top: 1px solid #333;
      width: 60%;
      padding-top: 0.25rem;
      font-size: 0.8rem;
      color: #666;
    }
    .footer-text {
      margin-top: 1.5rem;
      padding: 0.75rem;
      background: #f5f5f5;
      border-radius: 4px;
      font-size: 0.75rem;
      color: #666;
      text-align: center;
    }
    .stamp-area {
      width: 180px;
      height: 80px;
      border: 1px dashed #ccc;
      float: right;
      margin-top: -3rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ccc;
      font-size: 0.7rem;
    }
    .meta-info {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: #666;
      margin-bottom: 1rem;
    }
    @media print { 
      body { margin: 0; padding: 0.5rem; } 
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  ${logoHtml}
  
  <h1>${escapeHtml(template.title || "KARTA MELDUNKOWA")}</h1>
  <div class="hotel-info">${hotelInfoHtml}</div>

  <div class="meta-info">
    <span>Data: ${escapeHtml(issuedDate)} ${escapeHtml(issuedTime)}</span>
    <span>Pokój: <strong>${escapeHtml(reservation.room.number)}</strong></span>
  </div>

  ${template.headerText ? `<div style="margin-bottom: 1rem; font-size: 0.85rem;">${escapeHtml(template.headerText).replace(/\n/g, "<br>")}</div>` : ""}

  <div class="section-title">Dane pobytu</div>
  <table class="form-table">
    <tr>
      <td class="label">Nr pokoju</td>
      <td class="value"><strong>${escapeHtml(reservation.room.number)}</strong> ${reservation.room.type ? `(${escapeHtml(reservation.room.type)})` : ""}</td>
    </tr>
    <tr>
      <td class="label">Zameldowanie</td>
      <td class="value">${escapeHtml(checkIn)}</td>
    </tr>
    <tr>
      <td class="label">Wymeldowanie</td>
      <td class="value">${escapeHtml(checkOut)}</td>
    </tr>
    <tr>
      <td class="label">Liczba nocy</td>
      <td class="value">${nights}</td>
    </tr>
    <tr>
      <td class="label">Liczba osób</td>
      <td class="value">${reservation.adults || 1} dorosłych${reservation.children ? `, ${reservation.children} dzieci` : ""}</td>
    </tr>
  </table>

  <div class="section-title">Dane gościa</div>
  <table class="form-table">
    <tr>
      <td class="label">Imię i nazwisko</td>
      <td class="value">${escapeHtml(reservation.guest.name)}</td>
    </tr>
    ${template.showIdField ? `
    <tr>
      <td class="label">Nr dowodu / paszportu</td>
      <td class="value">${reservation.guest.documentNumber ? escapeHtml(reservation.guest.documentNumber) : `<span class="input-line"></span>`}</td>
    </tr>
    ` : ""}
    <tr>
      <td class="label">Adres</td>
      <td class="value">
        ${[reservation.guest.street, reservation.guest.postalCode, reservation.guest.city, reservation.guest.country].filter(Boolean).join(", ") ? escapeHtml([reservation.guest.street, reservation.guest.postalCode, reservation.guest.city, reservation.guest.country].filter(Boolean).join(", ")) : `<span class="input-line"></span>`}
      </td>
    </tr>
    <tr>
      <td class="label">Kod pocztowy, miasto</td>
      <td class="value">
        ${reservation.guest.postalCode || reservation.guest.city 
          ? escapeHtml([reservation.guest.postalCode, reservation.guest.city].filter(Boolean).join(", "))
          : `<span class="input-line"></span>`}
      </td>
    </tr>
    <tr>
      <td class="label">Kraj</td>
      <td class="value">
        ${reservation.guest.country ? escapeHtml(reservation.guest.country) : "Polska"}
      </td>
    </tr>
    <tr>
      <td class="label">Telefon</td>
      <td class="value">${reservation.guest.phone ? escapeHtml(reservation.guest.phone) : `<span class="input-line"></span>`}</td>
    </tr>
    <tr>
      <td class="label">Email</td>
      <td class="value">${reservation.guest.email ? escapeHtml(reservation.guest.email) : `<span class="input-line"></span>`}</td>
    </tr>
    ${template.showVehicleField ? `
    <tr>
      <td class="label">Nr rejestracyjny pojazdu</td>
      <td class="value">${`<span class="input-line"></span>`}</td>
    </tr>
    ` : ""}
  </table>

  ${reservation.company ? `
  <div class="section-title">Dane firmy</div>
  <table class="form-table">
    <tr>
      <td class="label">Nazwa firmy</td>
      <td class="value">${escapeHtml(reservation.company.name)}</td>
    </tr>
    ${reservation.company.nip ? `
    <tr>
      <td class="label">NIP</td>
      <td class="value">${escapeHtml(reservation.company.nip)}</td>
    </tr>
    ` : ""}
  </table>
  ` : ""}

  ${reservation.notes ? `
  <div class="section-title">Uwagi</div>
  <p style="font-size: 0.85rem;">${escapeHtml(reservation.notes)}</p>
  ` : ""}

  ${template.termsText ? `
  <div class="section-title">Regulamin</div>
  <div style="font-size: 0.75rem; color: #666;">${escapeHtml(template.termsText).replace(/\n/g, "<br>")}</div>
  ` : ""}

  ${template.showSignatureField ? `
  <div class="signature-box">
    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <p style="font-size: 0.8rem; margin-bottom: 0;">
          Wyrażam zgodę na przetwarzanie moich danych osobowych w celu realizacji usługi hotelowej.
        </p>
        <div class="signature-line">Podpis gościa</div>
      </div>
      <div class="stamp-area">Pieczęć hotelu</div>
    </div>
  </div>
  ` : ""}

  ${template.footerText ? `
  <div class="footer-text">
    ${escapeHtml(template.footerText).replace(/\n/g, "<br>")}
  </div>
  ` : ""}

  <p class="no-print" style="font-size: 0.7rem; text-align: center; color: #999; margin-top: 1.5rem;">
    Dokument wygenerowany z systemu Hotel PMS. Do druku: użyj „Drukuj" → „Zapisz jako PDF".
  </p>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="karta-meldunkowa-${reservation.room.number}-${reservation.id.slice(-6)}.html"`,
      },
    });
  } catch (e) {
    console.error("[registration-card-pdf]", e);
    return new NextResponse("Błąd generowania karty meldunkowej", { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
