/**
 * Szablon HTML raportu KT-1 (GUS) do generowania PDF — układ zgodny z drukiem urzędowym.
 * Wzór: form.stat.gov.pl/formularze/2026/passive/KT-1.pdf
 * Specyfikacja: docs/specs/kt1-report-spec.md
 */

import type { Kt1ReportResponse } from "@/lib/kt1-report";

const OBJECT_TYPE_LABELS: Record<number, string> = {
  1: "hotel",
  2: "motel",
  3: "pensjonat",
  4: "inny obiekt hotelowy",
  5: "dom wycieczkowy",
  6: "schronisko",
  7: "schronisko młodzieżowe",
  8: "szkolne schronisko młodzieżowe",
  9: "ośrodek wczasowy",
  10: "ośrodek kolonijny",
  11: "ośrodek szkoleniowo-wypoczynkowy",
  12: "dom pracy twórczej",
  13: "zespół domków turystycznych",
  14: "kemping (camping)",
  15: "pole biwakowe",
  16: "hostel",
  17: "zakład uzdrowiskowy",
  18: "pokoje gościnne / kwatery prywatne",
  19: "kwatera agroturystyczna",
  20: "inny turystyczny obiekt noclegowy",
};

const CATEGORY_LABELS: Record<number, string> = {
  1: "*****",
  2: "****",
  3: "***",
  4: "**",
  5: "*",
  6: "I",
  7: "II",
  8: "III",
  9: "w trakcie kategoryzacji",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getObjectTypeLabel(objectType: number): string {
  return OBJECT_TYPE_LABELS[objectType] ?? `nieznany (${objectType})`;
}

function getCategoryLabel(category: number): string {
  return CATEGORY_LABELS[category] ?? `nieznana (${category})`;
}

export function generateKt1Html(data: Kt1ReportResponse): string {
  const s1 = data.section1;
  const s4 = data.section4;
  const s5 = data.section5;
  const meta = data.meta;

  const monthNames = [
    "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
    "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
  ];
  const periodLabel = `${monthNames[meta.month - 1]} ${meta.year}`;
  const objectTypeLabel = `${s1.objectType} - ${getObjectTypeLabel(s1.objectType)}`;
  const categoryLabel = `${s1.category} - ${getCategoryLabel(s1.category)}`;
  const yearRoundLabel = s1.isYearRound ? "1 - całoroczny" : "2 - sezonowy";

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>KT-1 — Sprawozdanie o wykorzystaniu turystycznego obiektu noclegowego — ${escapeHtml(periodLabel)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.25; color: #000; margin: 0; padding: 12px 14px; }
    .header-org { font-size: 9pt; margin-bottom: 2px; }
    .form-title { font-size: 11pt; font-weight: bold; margin: 6px 0 2px; }
    .form-subtitle { font-size: 10pt; margin-bottom: 8px; }
    .header-address { font-size: 9pt; margin-bottom: 12px; }
    .section-title { font-weight: bold; margin-top: 14px; margin-bottom: 6px; font-size: 10pt; }
    .dział1-grid { display: table; width: 100%; margin-bottom: 8px; }
    .dział1-row { display: table-row; }
    .dział1-label { display: table-cell; vertical-align: top; width: 1%; white-space: nowrap; padding-right: 8px; font-weight: bold; }
    .dział1-value { display: table-cell; }
    table.kt1 { border-collapse: collapse; width: 100%; margin-bottom: 12px; font-size: 9pt; }
    table.kt1 th, table.kt1 td { border: 1px solid #000; padding: 3px 6px; text-align: left; }
    table.kt1 th { background: #f5f5f5; font-weight: bold; }
    table.kt1 .num { text-align: right; }
    table.kt1 .col-ogolem { min-width: 52px; }
    table.kt1 .col-zagraniczni { min-width: 52px; }
    .footer-note { font-size: 8pt; color: #444; margin-top: 14px; }
    @media print {
      body { padding: 8px 10px; font-size: 9pt; }
      .section-title { break-after: avoid; }
      table.kt1 { break-inside: auto; }
      table.kt1 thead { display: table-header-group; }
      table.kt1 tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header-org">GŁÓWNY URZĄD STATYSTYCZNY, al. Niepodległości 208, 00-925 Warszawa, www.stat.gov.pl</div>
  <div class="form-title">Nazwa i adres jednostki sprawozdawczej</div>
  <div class="form-subtitle"><strong>KT-1</strong> — Sprawozdanie o wykorzystaniu turystycznego obiektu noclegowego</div>
  <div class="header-address">
    Portal Sprawozdawczy GUS: raport.stat.gov.pl<br />
    Urząd Statystyczny w Rzeszowie, ul. Jana III Sobieskiego 10, 35-959 Rzeszów<br />
    Numer identyfikacyjny – REGON<br />
    <strong>za miesiąc ${escapeHtml(periodLabel)}</strong><br />
    Termin przekazania: raz w miesiącu do 10. dnia po miesiącu sprawozdawczym
  </div>

  <div class="section-title">Dział 1. DANE OGÓLNE</div>
  <div class="dział1-grid">
    <div class="dział1-row">
      <div class="dział1-label">1. Nazwa obiektu</div>
      <div class="dział1-value">${escapeHtml(s1.objectName)}</div>
    </div>
    <div class="dział1-row">
      <div class="dział1-label">2. Adres obiektu</div>
      <div class="dział1-value">
        województwo ${escapeHtml(s1.voivodeship ?? "—")}, powiat ${escapeHtml(s1.powiat ?? "—")}, gmina ${escapeHtml(s1.gmina ?? "—")}<br />
        ${escapeHtml(s1.address ?? "")}, ${escapeHtml(s1.postalCode ?? "")} ${escapeHtml(s1.city ?? "")}
      </div>
    </div>
    <div class="dział1-row">
      <div class="dział1-label">3. Rodzaj obiektu</div>
      <div class="dział1-value">${escapeHtml(objectTypeLabel)}</div>
    </div>
    <div class="dział1-row">
      <div class="dział1-label">5. Kategoria obiektu</div>
      <div class="dział1-value">${escapeHtml(categoryLabel)}</div>
    </div>
    <div class="dział1-row">
      <div class="dział1-label">6. Czy obiekt jest całoroczny?</div>
      <div class="dział1-value">${escapeHtml(yearRoundLabel)}</div>
    </div>
    <div class="dział1-row">
      <div class="dział1-label">REGON</div>
      <div class="dział1-value">${escapeHtml(s1.regon ?? "—")}</div>
    </div>
  </div>

  <div class="section-title">Dział 4. WYKORZYSTANIE OBIEKTU W BADANYM MIESIĄCU (DOTYCZY TURYSTÓW)</div>
  <table class="kt1">
    <thead>
      <tr>
        <th>Wyszczególnienie</th>
        <th class="num col-ogolem">Ogółem</th>
        <th class="num col-zagraniczni">W tym turyści zagraniczni</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1. Liczba dni działalności obiektu</td>
        <td class="num">${s4.daysActive}</td>
        <td class="num">—</td>
      </tr>
      <tr>
        <td>2. Nominalna liczba miejsc noclegowych</td>
        <td class="num">${s4.nominalPlaces}</td>
        <td class="num">—</td>
      </tr>
      <tr>
        <td>3. Nominalna liczba pokoi</td>
        <td class="num">${s4.nominalRooms}</td>
        <td class="num">—</td>
      </tr>
      <tr>
        <td>4. Liczba osób korzystających z noclegów</td>
        <td class="num">${s4.guestsTotal}</td>
        <td class="num">${s4.guestsForeign}</td>
      </tr>
      <tr>
        <td>5. Liczba udzielonych noclegów (osobonoce)</td>
        <td class="num">${s4.personNightsTotal}</td>
        <td class="num">${s4.personNightsForeign}</td>
      </tr>
      <tr>
        <td>6. Liczba wynajętych pokoi (pokojo-dni)</td>
        <td class="num">${s4.roomNightsTotal}</td>
        <td class="num">${s4.roomNightsForeign}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">Dział 5. TURYŚCI ZAGRANICZNI WEDŁUG KRAJU STAŁEGO ZAMIESZKANIA</div>
  <table class="kt1">
    <thead>
      <tr>
        <th>Kraj zamieszkania turysty zagranicznego</th>
        <th class="num col-ogolem">Liczba turystów korzystających z noclegów</th>
        <th class="num col-zagraniczni">Liczba noclegów udzielonych turystom zagranicznym</th>
      </tr>
    </thead>
    <tbody>
${s5.map((row) => `      <tr><td>${escapeHtml(row.countryLabel)}</td><td class="num">${row.guests}</td><td class="num">${row.personNights}</td></tr>`).join("\n")}
    </tbody>
  </table>

  <p class="footer-note">Wypełniony druk urzędowy KT-1 — wygenerowano: ${escapeHtml(meta.generatedAt)}</p>
</body>
</html>`;

  return html;
}
