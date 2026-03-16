/**
 * Szablon HTML raportu KT-1 (GUS) do generowania PDF.
 * Specyfikacja: docs/specs/kt1-report-spec.md
 */

import type { Kt1ReportResponse } from "@/lib/kt1-report";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

  let html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>KT-1 GUS — ${escapeHtml(periodLabel)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.35; color: #222; margin: 12px; }
    h1 { font-size: 14pt; margin-bottom: 4px; }
    .subtitle { font-size: 10pt; color: #555; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
    th, td { border: 1px solid #333; padding: 4px 8px; text-align: left; }
    th { background: #eee; font-weight: bold; }
    .number { text-align: right; }
    .section-title { font-weight: bold; margin-top: 16px; margin-bottom: 6px; }
    .dane-ogolne { margin-bottom: 12px; }
    .dane-ogolne p { margin: 2px 0; }
  </style>
</head>
<body>
  <h1>GUS — Sprawozdanie KT-1</h1>
  <p class="subtitle">Sprawozdanie o wykorzystaniu turystycznego obiektu noclegowego — ${escapeHtml(periodLabel)}</p>

  <div class="section-title">Dział 1. Dane ogólne</div>
  <div class="dane-ogolne">
    <p><strong>Nazwa obiektu:</strong> ${escapeHtml(s1.objectName)}</p>
    <p><strong>Adres:</strong> ${escapeHtml(s1.address ?? "")} ${escapeHtml(s1.postalCode ?? "")} ${escapeHtml(s1.city ?? "")}</p>
    <p><strong>Gmina:</strong> ${escapeHtml(s1.gmina ?? "")} &nbsp; <strong>Powiat:</strong> ${escapeHtml(s1.powiat ?? "")} &nbsp; <strong>Województwo:</strong> ${escapeHtml(s1.voivodeship ?? "")}</p>
    <p><strong>REGON:</strong> ${escapeHtml(s1.regon ?? "")} &nbsp; Rodzaj obiektu: ${s1.objectType} &nbsp; Kategoria: ${s1.category} &nbsp; Całoroczny: ${s1.isYearRound ? "tak" : "nie"}</p>
  </div>

  <div class="section-title">Dział 4. Wykorzystanie obiektu w badanym miesiącu</div>
  <table>
    <thead>
      <tr>
        <th>Lp.</th>
        <th>Pozycja</th>
        <th class="number">Ogółem</th>
        <th class="number">W tym turyści zagraniczni</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>Liczba dni działalności obiektu</td><td class="number">${s4.daysActive}</td><td class="number">—</td></tr>
      <tr><td>2</td><td>Nominalna liczba miejsc noclegowych</td><td class="number">${s4.nominalPlaces}</td><td class="number">—</td></tr>
      <tr><td>3</td><td>Nominalna liczba pokoi</td><td class="number">${s4.nominalRooms}</td><td class="number">—</td></tr>
      <tr><td>4</td><td>Liczba osób korzystających z noclegów</td><td class="number">${s4.guestsTotal}</td><td class="number">${s4.guestsForeign}</td></tr>
      <tr><td>5</td><td>Udzielone noclegi (osobonoce)</td><td class="number">${s4.personNightsTotal}</td><td class="number">${s4.personNightsForeign}</td></tr>
      <tr><td>6</td><td>Liczba wynajętych pokoi (pokojo-dni)</td><td class="number">${s4.roomNightsTotal}</td><td class="number">${s4.roomNightsForeign}</td></tr>
    </tbody>
  </table>

  <div class="section-title">Dział 5. Turyści zagraniczni według kraju stałego zamieszkania</div>
  <table>
    <thead>
      <tr>
        <th>Kraj</th>
        <th class="number">Turyści korzystający z noclegów</th>
        <th class="number">Udzielone noclegi</th>
      </tr>
    </thead>
    <tbody>
`;

  for (const row of s5) {
    html += `      <tr><td>${escapeHtml(row.countryLabel)}</td><td class="number">${row.guests}</td><td class="number">${row.personNights}</td></tr>\n`;
  }

  html += `    </tbody>
  </table>
  <p style="margin-top: 16px; font-size: 9pt; color: #666;">Wygenerowano: ${escapeHtml(meta.generatedAt)}</p>
</body>
</html>`;

  return html;
}
