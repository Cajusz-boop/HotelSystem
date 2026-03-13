import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const HOTEL_NAME = process.env.HOTEL_NAME ?? "Karczma Łabędź";
const HOTEL_ADDRESS = process.env.HOTEL_ADDRESS ?? "";
const HOTEL_POSTAL = process.env.HOTEL_POSTAL_CODE ?? "";
const HOTEL_CITY = process.env.HOTEL_CITY ?? "";
const HOTEL_NIP = process.env.HOTEL_NIP ?? "";

const EVENT_TYPE_LABELS: Record<string, string> = {
  WESELE: "Wesele", KOMUNIA: "Komunia", CHRZCINY: "Chrzciny",
  URODZINY: "Urodziny", STYPA: "Stypa", FIRMOWA: "Impreza firmowa",
  SYLWESTER: "Sylwester", INNE: "Impreza",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Szkic", CONFIRMED: "Potwierdzone", DONE: "Wykonane", CANCELLED: "Anulowane",
};

function esc(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function fmtDateLong(d: Date): string { return d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
function fmtDateShort(d: Date): string { return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function fm(n: number): string { return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fld(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<div><div class="fl">${esc(label)}</div><div class="fv">${esc(value)}</div></div>`;
}
function hasAlcohol(e: { drinksArrival: string | null; drinksStorage: string | null; champagneStorage: string | null; firstBottlesBy: string | null; coolersWithIce: string | null; alcoholServiceBy: string | null; wineLocation: string | null; beerWhen: string | null; alcoholUnderStairs: boolean; alcoholAtTeamTable: boolean }): boolean {
  return !!(e.drinksArrival || e.drinksStorage || e.champagneStorage || e.firstBottlesBy || e.coolersWithIce || e.alcoholServiceBy || e.wineLocation || e.beerWhen || e.alcoholUnderStairs || e.alcoholAtTeamTable);
}
function hasDeco(e: { decorationColor: string | null; ownFlowers: boolean; ownVases: boolean; placeCards: boolean; cakesSwedishTable: boolean; fruitsSwedishTable: boolean; ownNapkins: boolean; facebookConsent: boolean }): boolean {
  return !!(e.decorationColor || e.ownFlowers || e.ownVases || e.placeCards || e.cakesSwedishTable || e.fruitsSwedishTable || e.ownNapkins || e.facebookConsent);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) return new NextResponse("Brak ID imprezy", { status: 400 });

  try {
    const event = await prisma.eventOrder.findUnique({ where: { id: id.trim() } });
    if (!event) return new NextResponse("Impreza nie istnieje", { status: 404 });

    let packageName: string | null = null;
    let packagePrice: number | null = null;
    interface SurchargeInfo { code: string; label: string; pricePerPerson: number | null; flatPrice: number | null; }
    let surcharges: SurchargeInfo[] = [];
    let packageSections: Array<{ code: string; label: string; type: string; dishes: string[] }> = [];

    if (event.packageId) {
      const pkg = await prisma.menuPackage.findFirst({
        where: { code: event.packageId },
        include: { surcharges: true, sections: { orderBy: { sortOrder: "asc" } } },
      });
      if (pkg) {
        packageName = pkg.name;
        packagePrice = Number(pkg.price);
        surcharges = pkg.surcharges.map((s) => ({
          code: s.code, label: s.label,
          pricePerPerson: s.pricePerPerson != null ? Number(s.pricePerPerson) : null,
          flatPrice: s.flatPrice != null ? Number(s.flatPrice) : null,
        }));
        packageSections = pkg.sections.map((s) => ({
          code: s.code, label: s.label, type: s.type,
          dishes: Array.isArray(s.dishes) ? (s.dishes as string[]) : [],
        }));
      }
    }

    const menu = event.menu as {
      pakietId?: string | null;
      wybory?: Record<string, string[]>;
      doplaty?: Record<string, boolean>;
      dopWybory?: Record<string, string[]>;
      notatka?: string;
      zamienniki?: Record<string, string>;
      dodatkiDan?: Record<string, { nazwa: string; cena: number }[]>;
    } | null;

    const selectedSurcharges = surcharges.filter((s) => menu?.doplaty?.[s.code]);

    let poprawiny: typeof event | null = null;
    poprawiny = await prisma.eventOrder.findFirst({
      where: { parentEventId: event.id, isPoprawiny: true },
    });

    const guestCount = event.guestCount ?? event.adultsCount ?? 0;
    const basePerPerson = packagePrice ?? 0;
    let surchargePerPerson = 0, surchargeFlat = 0;
    for (const s of selectedSurcharges) {
      if (s.pricePerPerson != null) surchargePerPerson += s.pricePerPerson;
      if (s.flatPrice != null) surchargeFlat += s.flatPrice;
    }
    let additionalDishesPerPerson = 0;
    if (menu?.dodatkiDan) {
      for (const items of Object.values(menu.dodatkiDan)) {
        for (const d of items) additionalDishesPerPerson += d.cena;
      }
    }
    const totalPerPerson = basePerPerson + surchargePerPerson + additionalDishesPerPerson;
    const menuTotal = guestCount > 0 ? totalPerPerson * guestCount + surchargeFlat : null;
    const depositAmount = event.depositAmount != null ? Number(event.depositAmount) : 0;
    const remaining = menuTotal != null ? menuTotal - depositAmount : null;

    const eventDate = event.eventDate ? fmtDateLong(new Date(event.eventDate)) : fmtDateLong(new Date(event.dateFrom));
    const docNumber = `ROZ/${event.eventNumber ?? event.id.slice(-6).toUpperCase()}/${new Date().getFullYear()}`;

    const menuDishesHtml = packageSections.length > 0 ? packageSections.map((sek) => {
      const chosen = sek.type === "wybor" ? (menu?.wybory?.[sek.code] ?? []) : sek.dishes;
      const displayed = chosen.map((d) => menu?.zamienniki?.[d] ? `${menu.zamienniki[d]} <small style="color:#94a3b8">(zamiast: ${esc(d)})</small>` : esc(d));
      if (displayed.length === 0) return "";
      return `<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px">${esc(sek.label)}</div><div style="font-size:12px;color:#374151">${displayed.join(", ")}</div></div>`;
    }).filter(Boolean).join("") : "";

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>Rozliczenie — ${esc(event.clientName ?? event.name)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 32px 24px; color: #111827; font-size: 13px; line-height: 1.6; }
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .doc-header .hotel-info { font-size: 11px; color: #6b7280; text-align: right; }
    .doc-title { font-size: 20px; font-weight: 800; text-align: center; margin-bottom: 2px; letter-spacing: 1px; text-transform: uppercase; }
    .doc-subtitle { font-size: 13px; text-align: center; color: #6b7280; margin-bottom: 20px; }
    .doc-number { text-align: center; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
    .badge { display: inline-block; padding: 2px 12px; border-radius: 3px; font-size: 11px; font-weight: 700; }
    .badge-type { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .badge-status { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    .badge-cancelled { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .badge-draft { background: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb; }
    h2 { font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin: 20px 0 10px 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 28px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 20px; }
    .fl { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.8px; }
    .fv { font-size: 13px; color: #111827; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-size: 12px; }
    th { background: #f9fafb; font-weight: 700; color: #374151; font-size: 11px; text-transform: uppercase; }
    .tr { text-align: right; } .tc { text-align: center; }
    .summary-box { background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; padding: 14px 18px; margin: 16px 0; }
    .sr { display: flex; justify-content: space-between; font-size: 13px; line-height: 2; }
    .sr.bold { font-weight: 700; font-size: 15px; border-top: 1px dashed #86efac; padding-top: 4px; margin-top: 4px; }
    .sr.dep { color: #166534; } .sr.rem { color: #991b1b; font-weight: 700; }
    .ib { padding: 10px 14px; border-radius: 6px; margin: 10px 0; font-size: 12px; }
    .ib.rec { background: #eff6ff; border: 1px solid #93c5fd; color: #1e40af; }
    .ib.note { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
    .checklist { list-style: none; padding: 0; }
    .checklist li { font-size: 12px; padding: 3px 0; display: flex; align-items: center; gap: 6px; }
    .chk { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #d1d5db; border-radius: 2px; text-align: center; line-height: 12px; font-size: 10px; }
    .chk.done { background: #d1fae5; border-color: #34d399; color: #065f46; }
    .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; }
    .footer-col { width: 45%; }
    .footer-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .sig-line { border-bottom: 1px solid #d1d5db; height: 40px; margin-top: 8px; }
    .pfooter { margin-top: 20px; font-size: 10px; color: #d1d5db; text-align: center; }
    @media print { body { padding: 12px; margin: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="doc-header">
    <div>
      <span class="badge badge-type">${esc(EVENT_TYPE_LABELS[event.eventType] ?? event.eventType)}</span>
      <span class="badge ${event.status === "CANCELLED" ? "badge-cancelled" : event.status === "DRAFT" ? "badge-draft" : "badge-status"}" style="margin-left:6px">${esc(STATUS_LABELS[event.status] ?? event.status)}</span>
    </div>
    <div class="hotel-info">${esc(HOTEL_NAME)}<br/>${HOTEL_ADDRESS ? esc(HOTEL_ADDRESS) + "<br/>" : ""}${HOTEL_POSTAL || HOTEL_CITY ? esc([HOTEL_POSTAL, HOTEL_CITY].filter(Boolean).join(" ")) + "<br/>" : ""}${HOTEL_NIP ? "NIP: " + esc(HOTEL_NIP) : ""}</div>
  </div>
  <div class="doc-title">Rozliczenie imprezy</div>
  <div class="doc-subtitle">${esc(event.clientName ?? event.name)}</div>
  <div class="doc-number">Nr: ${esc(docNumber)}&emsp;|&emsp;Data wystawienia: ${fmtDateShort(new Date())}</div>

  <h2>Dane klienta i imprezy</h2>
  <div class="grid">
    ${fld("Klient", event.clientName ?? event.name)}
    ${fld("Data imprezy", eventDate)}
    ${fld("Telefon", event.clientPhone)}
    ${fld("Email", event.clientEmail)}
    ${fld("Sala", event.roomName)}
    ${fld("Godziny", event.timeStart || event.timeEnd ? (event.timeStart || "?") + " – " + (event.timeEnd || "?") : null)}
    ${fld("Kościół (godz.)", event.churchTime)}
    ${fld("Osoba odpowiedzialna", event.assignedTo)}
    ${fld("Osoba dyżurna", event.dutyPerson)}
  </div>

  <h2>Goście</h2>
  <div class="grid-3">
    <div><div class="fl">Ogółem</div><div class="fv">${event.guestCount ?? "—"} os.</div></div>
    <div><div class="fl">Dorośli</div><div class="fv">${event.adultsCount ?? "—"}</div></div>
    <div><div class="fl">Dzieci 0–3</div><div class="fv">${event.children03 ?? "—"}</div></div>
    <div><div class="fl">Dzieci 4–7</div><div class="fv">${event.children47 ?? "—"}</div></div>
    <div><div class="fl">Orkiestra</div><div class="fv">${event.orchestraCount ?? "—"}</div></div>
    <div><div class="fl">Kamerzysta / fotograf</div><div class="fv">${[event.cameramanCount, event.photographerCount].filter(Boolean).join(" / ") || "—"}</div></div>
  </div>

  ${event.eventType === "WESELE" ? `<h2>Szczegóły wesela</h2><div class="grid">${fld("Stół pary młodej", event.brideGroomTable)}${fld("Stół orkiestry", event.orchestraTable)}${fld("Układ stołów", event.tableLayout)}${fld("Winszowanie chlebem", event.breadWelcomeBy)}</div>` : ""}

  <h2>Menu i wycena</h2>
  ${packageName ? `
  <table><thead><tr><th>Pozycja</th><th class="tc">Ilość os.</th><th class="tr">Cena/os. (zł)</th><th class="tr">Wartość (zł)</th></tr></thead><tbody>
    <tr><td><strong>${esc(packageName)}</strong> — pakiet bazowy</td><td class="tc">${guestCount || "—"}</td><td class="tr">${fm(basePerPerson)}</td><td class="tr">${guestCount > 0 ? fm(basePerPerson * guestCount) : "—"}</td></tr>
    ${selectedSurcharges.map((s) => {
      const isPP = s.pricePerPerson != null && s.pricePerPerson > 0;
      const isF = s.flatPrice != null && s.flatPrice > 0;
      const price = isPP ? s.pricePerPerson! : (isF ? s.flatPrice! : 0);
      const total = isPP && guestCount > 0 ? price * guestCount : isF ? price : 0;
      return `<tr><td>${esc(s.label)}${isF ? " (ryczałt)" : ""}</td><td class="tc">${isPP ? guestCount || "—" : "—"}</td><td class="tr">${isPP ? fm(price) : "—"}</td><td class="tr">${total > 0 ? fm(total) : "—"}</td></tr>`;
    }).join("")}
    ${menu?.dodatkiDan ? Object.values(menu.dodatkiDan).flat().map((d) => `<tr><td>${esc(d.nazwa)} (dod.)</td><td class="tc">${guestCount || "—"}</td><td class="tr">${fm(d.cena)}</td><td class="tr">${guestCount > 0 ? fm(d.cena * guestCount) : "—"}</td></tr>`).join("") : ""}
  </tbody></table>` : `<p style="color:#6b7280;font-size:12px;font-style:italic">Pakiet menu nie wybrany.</p>`}

  ${menuDishesHtml ? `<div style="margin:10px 0;padding:10px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px"><div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:6px">WYBRANE DANIA</div>${menuDishesHtml}</div>` : ""}
  ${menu?.notatka ? `<div class="ib note"><strong>Notatka do menu:</strong> ${esc(menu.notatka)}</div>` : ""}

  <div class="summary-box">
    ${menuTotal != null ? `
    <div class="sr"><span>Całość za osobę:</span><span>${fm(totalPerPerson)} zł/os. × ${guestCount} os.</span></div>
    ${surchargeFlat > 0 ? `<div class="sr"><span>Dopłaty ryczałtowe:</span><span>${fm(surchargeFlat)} zł</span></div>` : ""}
    <div class="sr bold"><span>RAZEM:</span><span>${fm(menuTotal)} zł</span></div>
    ` : `<div class="sr" style="color:#6b7280"><span>Kwota do uzupełnienia ręcznie:</span><span>______________ zł</span></div>`}
    <div class="sr dep"><span>Zadatek wpłacony${event.depositPaid ? " ✓" : ""}:</span><span>${depositAmount > 0 ? fm(depositAmount) + " zł" : "—"}</span></div>
    ${event.depositDueDate && !event.depositPaid ? `<div class="sr" style="color:#b45309;font-size:12px"><span>Termin wpłaty zadatku:</span><span>${fmtDateShort(new Date(event.depositDueDate))}</span></div>` : ""}
    ${remaining != null ? `<div class="sr rem"><span>POZOSTAJE DO ZAPŁATY:</span><span>${fm(remaining)} zł</span></div>` : `<div class="sr rem"><span>POZOSTAJE DO ZAPŁATY:</span><span>______________ zł</span></div>`}
  </div>

  ${hasAlcohol(event) ? `<h2>Napoje i alkohol</h2><div class="grid">${fld("Dowóz alkoholu", event.drinksArrival)}${fld("Przechowywanie", event.drinksStorage)}${fld("Szampan", event.champagneStorage)}${fld("Pierwsze butelki", event.firstBottlesBy)}${fld("Coolery z lodem", event.coolersWithIce)}${fld("Obsługa alkoholu", event.alcoholServiceBy)}${fld("Wino", event.wineLocation)}${fld("Piwo", event.beerWhen)}${event.alcoholUnderStairs ? '<div><div class="fl">Pod schodami</div><div class="fv">Tak</div></div>' : ""}${event.alcoholAtTeamTable ? '<div><div class="fl">Alkohol przy stole ekipy</div><div class="fv">Tak</div></div>' : ""}</div>` : ""}

  ${event.cakeOrderedAt || event.cakeArrivalTime || event.cakeServedAt || event.cakesAndDesserts ? `<h2>Tort i ciasta</h2><div class="grid">${fld("Zamówiony w", event.cakeOrderedAt)}${fld("Przyjazd tortu", event.cakeArrivalTime)}${fld("Podanie tortu", event.cakeServedAt)}</div>${event.cakesAndDesserts ? `<div style="margin-top:6px;font-size:12px"><strong>Ciasta i desery:</strong> ${esc(event.cakesAndDesserts)}</div>` : ""}` : ""}

  ${hasDeco(event) ? `<h2>Dekoracje i układ sali</h2><div class="grid">${fld("Kolor dekoracji", event.decorationColor)}${event.ownFlowers ? '<div><div class="fl">Własne kwiaty</div><div class="fv">Tak</div></div>' : ""}${event.ownVases ? '<div><div class="fl">Własne wazony</div><div class="fv">Tak</div></div>' : ""}${event.placeCards ? `<div><div class="fl">Winietki</div><div class="fv">Tak${event.placeCardsLayout ? " — " + esc(event.placeCardsLayout) : ""}</div></div>` : ""}${event.cakesSwedishTable ? '<div><div class="fl">Stół szwedzki – ciasta</div><div class="fv">Tak</div></div>' : ""}${event.fruitsSwedishTable ? '<div><div class="fl">Stół szwedzki – owoce</div><div class="fv">Tak</div></div>' : ""}${event.ownNapkins ? '<div><div class="fl">Własne serwetki</div><div class="fv">Tak</div></div>' : ""}${event.facebookConsent ? '<div><div class="fl">Zgoda na Facebook</div><div class="fv">Tak</div></div>' : ""}</div>` : ""}

  ${event.extraAttractions ? `<h2>Dodatkowe atrakcje</h2><div style="font-size:12px;white-space:pre-wrap">${esc(event.extraAttractions)}</div>` : ""}

  ${event.afterpartyEnabled ? `<h2>Afterparty</h2><div class="grid">${fld("Godziny", event.afterpartyTimeFrom && event.afterpartyTimeTo ? event.afterpartyTimeFrom + " – " + event.afterpartyTimeTo : null)}<div><div class="fl">Liczba gości</div><div class="fv">${event.afterpartyGuests ?? "—"}</div></div>${fld("Muzyka", event.afterpartyMusic)}</div>${event.afterpartyMenu ? `<div style="margin-top:6px;font-size:12px"><strong>Menu afterparty:</strong> ${esc(event.afterpartyMenu)}</div>` : ""}` : ""}

  ${poprawiny ? `<h2>Poprawiny</h2><div class="grid"><div><div class="fl">Data</div><div class="fv">${fmtDateShort(new Date(poprawiny.dateFrom))}</div></div><div><div class="fl">Goście</div><div class="fv">${poprawiny.guestCount ?? "—"} os.</div></div>${fld("Sala", poprawiny.roomName)}${fld("Godziny", poprawiny.timeStart && poprawiny.timeEnd ? poprawiny.timeStart + " – " + poprawiny.timeEnd : null)}</div>` : ""}

  ${event.specialRequests || event.notes ? `<h2>Uwagi i wymagania specjalne</h2>${event.specialRequests ? `<div class="ib note"><strong>Wymagania specjalne:</strong><br/>${esc(event.specialRequests)}</div>` : ""}${event.notes ? `<div class="ib note"><strong>Notatki:</strong><br/>${esc(event.notes)}</div>` : ""}` : ""}

  ${event.checklist && typeof event.checklist === "object" ? `<h2>Checklista</h2><ul class="checklist">${Object.entries(event.checklist as Record<string, boolean>).map(([key, done]) => `<li><span class="chk${done ? " done" : ""}">${done ? "✓" : ""}</span> ${esc(key)}</li>`).join("")}</ul>` : ""}

  <div style="page-break-before:auto;margin-top:28px">
    <h2 style="background:#1e40af;color:white;padding:8px 14px;border-radius:4px;border:none;margin-bottom:12px">📋 INFORMACJA DLA RECEPCJI</h2>
    <div class="ib rec">
      <p style="margin-bottom:8px"><strong>Impreza:</strong> ${esc(EVENT_TYPE_LABELS[event.eventType] ?? event.eventType)} — ${esc(event.clientName ?? event.name)}</p>
      <p style="margin-bottom:8px"><strong>Data:</strong> ${esc(eventDate)} &emsp; <strong>Sala:</strong> ${esc(event.roomName ?? "—")}</p>
      <p style="margin-bottom:8px"><strong>Godziny:</strong> ${event.timeStart || "?"} – ${event.timeEnd || "?"}</p>
      <p style="margin-bottom:8px"><strong>Liczba gości:</strong> ${event.guestCount ?? "—"} os.</p>
      ${menuTotal != null ? `<p style="margin-bottom:8px"><strong>Kwota razem:</strong> ${fm(menuTotal)} zł &emsp; <strong>Zadatek:</strong> ${depositAmount > 0 ? fm(depositAmount) + " zł" : "brak"} &emsp; <strong>Do zapłaty:</strong> ${fm(remaining ?? 0)} zł</p>` : `<p style="margin-bottom:8px"><strong>Kwota:</strong> do uzgodnienia z Centrum Sprzedaży</p>`}
      <p style="margin-bottom:8px"><strong>Status:</strong> ${event.status === "DONE" ? "✅ Wykonane" : event.depositPaid && remaining != null && remaining <= 0 ? "✅ Rozliczone" : "⏳ W trakcie"}</p>
      ${event.afterpartyEnabled ? `<p style="margin-bottom:4px"><strong>Afterparty:</strong> ${event.afterpartyTimeFrom || "?"} – ${event.afterpartyTimeTo || "?"}, ${event.afterpartyGuests ?? "?"} os.</p>` : ""}
      ${poprawiny ? `<p style="margin-bottom:4px"><strong>Poprawiny:</strong> ${fmtDateShort(new Date(poprawiny.dateFrom))}, ${poprawiny.guestCount ?? "?"} os., sala: ${poprawiny.roomName ?? "—"}</p>` : ""}
      <p style="margin-top:10px;font-size:11px;color:#6b7280"><em>Dokument wewnętrzny — nie stanowi faktury ani paragonu.</em></p>
    </div>
  </div>

  <div class="footer">
    <div class="footer-col"><div class="footer-label">Sporządził (Centrum Sprzedaży)</div><div class="sig-line"></div></div>
    <div class="footer-col"><div class="footer-label">Potwierdzenie recepcji</div><div class="sig-line"></div></div>
  </div>
  <div class="pfooter">Dokument wewnętrzny · ${esc(HOTEL_NAME)} · Wygenerowano: ${fmtDateShort(new Date())} ${new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}<br/><span class="no-print" style="color:#3b82f6;font-size:11px">Do druku: Ctrl+P → Zapisz jako PDF</span></div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="rozliczenie-${(event.clientName ?? event.name).replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ -]/g, "").replace(/\s+/g, "-")}.html"`,
      },
    });
  } catch (e) {
    console.error("[rozliczenie]", e);
    return new NextResponse("Błąd generowania rozliczenia", { status: 500 });
  }
}
