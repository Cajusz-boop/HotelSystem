/**
 * Google Docs – generowanie checklist operacyjnych dla imprez.
 * Wymaga: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_DOCS_FOLDER_ID
 */
import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/google-auth";

export type EventOrderForChecklist = {
  eventType?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  eventDate?: Date | null;
  timeStart?: string | null;
  timeEnd?: string | null;
  roomName?: string | null;
  guestCount?: number | null;
  adultsCount?: number | null;
  children03?: number | null;
  children47?: number | null;
  orchestraCount?: number | null;
  cameramanCount?: number | null;
  photographerCount?: number | null;
  churchTime?: string | null;
  brideGroomTable?: string | null;
  orchestraTable?: string | null;
  cakeOrderedAt?: string | null;
  cakeArrivalTime?: string | null;
  cakeServedAt?: string | null;
  drinksArrival?: string | null;
  drinksStorage?: string | null;
  champagneStorage?: string | null;
  firstBottlesBy?: string | null;
  alcoholAtTeamTable?: boolean | null;
  cakesSwedishTable?: boolean | null;
  fruitsSwedishTable?: boolean | null;
  ownFlowers?: boolean | null;
  ownVases?: boolean | null;
  decorationColor?: string | null;
  placeCards?: boolean | null;
  placeCardsLayout?: string | null;
  tableLayout?: string | null;
  breadWelcomeBy?: string | null;
  extraAttractions?: string | null;
  specialRequests?: string | null;
  ownNapkins?: boolean | null;
  dutyPerson?: string | null;
  afterpartyEnabled?: boolean | null;
  afterpartyTimeFrom?: string | null;
  afterpartyTimeTo?: string | null;
  afterpartyGuests?: number | null;
  afterpartyMusic?: string | null;
};

function buildChecklistRows(event: EventOrderForChecklist): [string, string][] {
  const fmtDate = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("pl-PL") : "";
  return [
    ["IMPREZA", event.eventType ?? ""],
    ["Klient", event.clientName ?? ""],
    ["Telefon", event.clientPhone ?? ""],
    ["Data", fmtDate(event.eventDate)],
    ["Godzina rozpoczęcia", event.timeStart ?? ""],
    ["Godzina zakończenia", event.timeEnd ?? ""],
    ["Sala", event.roomName ?? ""],
    ["Liczba gości", String(event.guestCount ?? "")],
    ["Dorośli", String(event.adultsCount ?? "")],
    ["Dzieci 0-3", String(event.children03 ?? "")],
    ["Dzieci 4-7", String(event.children47 ?? "")],
    ["Orkiestra", String(event.orchestraCount ?? "")],
    ["Kamerzysta", String(event.cameramanCount ?? "")],
    ["Fotograf", String(event.photographerCount ?? "")],
    ["Godzina kościoła", event.churchTime ?? ""],
    ["Stół Pary Młodej", event.brideGroomTable ?? ""],
    ["Stół orkiestry", event.orchestraTable ?? ""],
    ["Tort – zamówiony w", event.cakeOrderedAt ?? ""],
    ["Tort – przyjazd", event.cakeArrivalTime ?? ""],
    ["Tort – podanie", event.cakeServedAt ?? ""],
    ["Napoje – przyjazd", event.drinksArrival ?? ""],
    ["Napoje – przechowywanie", event.drinksStorage ?? ""],
    ["Szampan – przechowywanie", event.champagneStorage ?? ""],
    ["Pierwsze butelki przez", event.firstBottlesBy ?? ""],
    ["Napoje na stole zespołu", event.alcoholAtTeamTable ? "TAK" : "NIE"],
    ["Tort na stole szwedzkim", event.cakesSwedishTable ? "TAK" : "NIE"],
    ["Owoce na stole szwedzkim", event.fruitsSwedishTable ? "TAK" : "NIE"],
    ["Własne kwiaty", event.ownFlowers ? "TAK" : "NIE"],
    ["Własne wazony", event.ownVases ? "TAK" : "NIE"],
    ["Kolor dekoracji", event.decorationColor ?? ""],
    ["Winietki", event.placeCards ? "TAK" : "NIE"],
    ["Układ winietki", event.placeCardsLayout ?? ""],
    ["Układ stołów", event.tableLayout ?? ""],
    ["Chleb powitalny przez", event.breadWelcomeBy ?? ""],
    ["Atrakcje dodatkowe", event.extraAttractions ?? ""],
    ["Specjalne życzenia", event.specialRequests ?? ""],
    ["Własne serwetki", event.ownNapkins ? "TAK" : "NIE"],
    ["Osoba dyżurna", event.dutyPerson ?? ""],
    ["Afterparty", event.afterpartyEnabled ? "TAK" : "NIE"],
    ["Afterparty – od", event.afterpartyTimeFrom ?? ""],
    ["Afterparty – do", event.afterpartyTimeTo ?? ""],
    ["Afterparty – goście", String(event.afterpartyGuests ?? "")],
    ["Afterparty – muzyka", event.afterpartyMusic ?? ""],
  ];
}

/** Buduje insertText requests dla treści checklist (format: Pole\tWartość per linia) */
function buildContentRequests(rows: [string, string][]): object[] {
  const text = rows.map(([k, v]) => `${k}\t${v}`).join("\n") + "\n";
  return [
    {
      insertText: {
        location: { index: 1 },
        text,
      },
    },
  ];
}

export async function createChecklistDoc(
  event: EventOrderForChecklist
): Promise<{ docId: string; docUrl: string }> {
  const auth = getGoogleAuth();
  const docs = google.docs({ version: "v1", auth });
  const drive = google.drive({ version: "v3", auth });

  const title = `Checklist – ${event.clientName ?? "Impreza"} – ${event.eventDate ? new Date(event.eventDate).toLocaleDateString("pl-PL") : "?"}`;

  const createRes = await docs.documents.create({
    requestBody: { title },
  });
  const docId = createRes.data.documentId!;

  if (process.env.GOOGLE_DOCS_FOLDER_ID) {
    try {
      await drive.files.update({
        fileId: docId,
        addParents: process.env.GOOGLE_DOCS_FOLDER_ID,
        fields: "id, parents",
      });
    } catch (err) {
      console.warn("Nie udało się przenieść dokumentu do folderu:", err);
    }
  }

  const rows = buildChecklistRows(event);
  const requests = buildContentRequests(rows);
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests },
  });

  return {
    docId,
    docUrl: `https://docs.google.com/document/d/${docId}/edit`,
  };
}

/** Tworzy dokument "Oferta menu" – placeholder lub z danymi pakietu. */
export async function createMenuDoc(
  event: EventOrderForChecklist & { packageId?: string | null; packageName?: string | null; cakesAndDesserts?: string | null }
): Promise<{ docId: string; docUrl: string }> {
  const auth = getGoogleAuth();
  const docs = google.docs({ version: "v1", auth });
  const drive = google.drive({ version: "v3", auth });

  const title = `Oferta menu – ${event.clientName ?? "Impreza"} – ${event.eventDate ? new Date(event.eventDate).toLocaleDateString("pl-PL") : "?"}`;
  const createRes = await docs.documents.create({ requestBody: { title } });
  const docId = createRes.data.documentId!;

  if (process.env.GOOGLE_DOCS_FOLDER_ID) {
    try {
      await drive.files.update({
        fileId: docId,
        addParents: process.env.GOOGLE_DOCS_FOLDER_ID,
        fields: "id, parents",
      });
    } catch {
      // ignoruj
    }
  }

  const lines: string[] = [
    "OFERTA MENU",
    "",
    `Klient: ${event.clientName ?? ""}`,
    `Data: ${event.eventDate ? new Date(event.eventDate).toLocaleDateString("pl-PL") : ""}`,
    `Pakiet: ${event.packageName ?? event.packageId ?? "— do wyboru —"}`,
    "",
    "Torty i desery:",
    event.cakesAndDesserts ?? "—",
  ];
  const text = lines.join("\n") + "\n";

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [{ insertText: { location: { index: 1 }, text } }],
    },
  });

  return {
    docId,
    docUrl: `https://docs.google.com/document/d/${docId}/edit`,
  };
}

export async function updateChecklistDoc(
  docId: string,
  event: EventOrderForChecklist
): Promise<void> {
  const auth = getGoogleAuth();
  const docs = google.docs({ version: "v1", auth });

  const doc = await docs.documents.get({ documentId: docId });
  const content = doc.data.body?.content;
  if (!content || content.length === 0) return;

  const lastEl = content[content.length - 1];
  const endIndex = (lastEl?.endIndex ?? 2) - 1;
  if (endIndex <= 1) return;

  const rows = buildChecklistRows(event);
  const contentRequests = buildContentRequests(rows);

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          deleteContentRange: {
            range: { startIndex: 1, endIndex },
          },
        },
        ...contentRequests,
      ],
    },
  });
}
