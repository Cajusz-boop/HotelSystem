/**
 * Google Docs – generowanie checklist operacyjnych dla imprez.
 * Wymaga: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_DOCS_FOLDER_ID
 */
import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/google-auth";
import { prisma } from "@/lib/db";

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
  menu?: {
    pakietId?: string | null;
    wybory?: Record<string, string[]>;
    doplaty?: Record<string, boolean>;
    dopWybory?: Record<string, string[]>;
    notatka?: string;
    zamienniki?: Record<string, string>;
    dodatkiDan?: Record<string, { nazwa: string; cena: number }[]>;
  } | null;
  packageName?: string | null;
  cakesAndDesserts?: string | null;
};

async function buildMenuLines(
  event: EventOrderForChecklist & { packageName?: string | null; cakesAndDesserts?: string | null }
): Promise<string[]> {
  const menu = event.menu;
  const lines: string[] = [];

  lines.push("OFERTA MENU", "");
  lines.push(`Klient: ${event.clientName ?? ""}`);
  lines.push(`Data: ${event.eventDate ? new Date(event.eventDate).toLocaleDateString("pl-PL") : ""}`);
  lines.push(`Sala: ${event.roomName ?? ""}`);
  lines.push(`Liczba osób: ${event.guestCount ?? ""}`);
  lines.push("");

  if (!menu?.pakietId) {
    lines.push("Pakiet: — do wyboru —", "");
  } else {
    type PakietWithRelations = { name?: string; sections?: Array<{ code: string; label: string; type: string; dishes: string[]; choiceLimit?: number }>; surcharges?: Array<{ code: string; label: string }> } | null;
    let pakiet: PakietWithRelations = null;
    try {
      pakiet = await prisma.menuPackage.findFirst({
        where: { code: menu.pakietId },
        include: {
          sections: { orderBy: { sortOrder: "asc" } },
          surcharges: { orderBy: { sortOrder: "asc" } },
        },
      }) as PakietWithRelations;
    } catch (err) {
      console.warn("Nie udało się pobrać definicji pakietu do dokumentu:", err);
    }

    const packageDisplayName = pakiet?.name ?? event.packageName ?? menu.pakietId;
    lines.push(`Pakiet: ${packageDisplayName}`, "");

    if (pakiet) {
      const sekcje = pakiet.sections as Array<{ code: string; label: string; type: string; dishes: string[]; choiceLimit?: number }>;

      for (const sek of sekcje) {
          const limit = sek.choiceLimit;
          const labelInfo =
            sek.type === "wybor" && limit
              ? `${sek.label.replace(/ \(.*\)/, "")} (${limit} do wyboru):`
              : `${sek.label.replace(/ \(.*\)/, "")}:`;

          lines.push(labelInfo);

          if (sek.type === "fixed") {
            const dishes = Array.isArray(sek.dishes) ? sek.dishes : [];
            for (const danie of dishes) {
              const zamiennik = menu.zamienniki?.[danie];
              if (zamiennik) {
                lines.push(`${zamiennik} (zamiennik za: ${danie})`);
              } else {
                lines.push(danie);
              }
            }
          } else {
            const wybrane = menu.wybory?.[sek.code] ?? [];
            if (wybrane.length > 0) {
              for (const d of wybrane) {
                const orig = Object.entries(menu.zamienniki ?? {}).find(([, z]) => z === d)?.[0];
                lines.push(orig ? `${d} (zamiennik za: ${orig})` : d);
              }
            } else {
              lines.push("— nie wybrano —");
            }
          }
          lines.push("");
        }

        const dodatkiDanMenu = (menu as { dodatkiDan?: Record<string, { nazwa: string; cena: number }[]> }).dodatkiDan ?? {};
        const wszystkieDodatki = Object.entries(dodatkiDanMenu).flatMap(([sekcjaCode, dania]) => {
          const sek = sekcje.find((s: { code: string }) => s.code === sekcjaCode);
          return dania.map((d: { nazwa: string; cena: number }) =>
            `• ${d.nazwa} (${sek?.label ?? sekcjaCode}) +${d.cena} zł/os`
          );
        });
        if (wszystkieDodatki.length > 0) {
          lines.push("Dodatkowe dania:");
          wszystkieDodatki.forEach((l) => lines.push(l));
          lines.push("");
        }

        const wybraneDoplatyCodes = Object.entries(menu.doplaty ?? {})
          .filter(([, v]) => v)
          .map(([k]) => k);
        if (wybraneDoplatyCodes.length > 0) {
          const surcharges = pakiet.surcharges as Array<{ code: string; label: string }>;
          const codeToLabel = new Map(surcharges.map((s) => [s.code, s.label]));
          lines.push("Dopłaty:");
          wybraneDoplatyCodes.forEach((code) => {
            const label = codeToLabel.get(code) ?? code;
            const dopWyb = menu.dopWybory?.[code];
            lines.push(dopWyb?.length ? `• ${label} (${dopWyb.join(", ")})` : `• ${label}`);
          });
          lines.push("");
        }
    }

    if (menu.notatka) {
      lines.push("Notatka:", menu.notatka, "");
    }
  }

  lines.push("Torty i desery:");
  lines.push(event.cakesAndDesserts ?? "—");

  return lines;
}

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
    ["", ""],
    ["PAKIET MENU", event.menu?.pakietId ? (event.packageName ?? event.menu.pakietId) : "— nie wybrano —"],
    ...(event.menu?.zamienniki && Object.keys(event.menu.zamienniki).length > 0
      ? [["ZAMIENNIKI", Object.entries(event.menu.zamienniki).map(([orig, zam]) => `${zam} zamiast ${orig}`).join(", ")]] as [string, string][]
      : []),
    [
      "WYBRANE DANIA",
      (() => {
        const wybrane = Object.values(event.menu?.wybory ?? {}).flat();
        const zam = event.menu?.zamienniki ?? {};
        return wybrane
          .map((d) => {
            const orig = Object.entries(zam).find(([, z]) => z === d)?.[0];
            return orig ? `${d} zamiast ${orig}` : d;
          })
          .join(", ") || "—";
      })(),
    ],
    [
      "DODATKOWE DANIA",
      (() => {
        const dodatki = (event.menu as { dodatkiDan?: Record<string, { nazwa: string; cena: number }[]> })?.dodatkiDan ?? {};
        const lista = Object.values(dodatki).flat();
        return lista.map((d) => `${d.nazwa} (+${d.cena} zł/os)`).join(", ") || "—";
      })(),
    ],
    [
      "DOPŁATY",
      Object.entries(event.menu?.doplaty ?? {})
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(", ") || "—",
    ],
    ["NOTATKA MENU", event.menu?.notatka ?? "—"],
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

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? process.env.GOOGLE_DOCS_FOLDER_ID;
  if (folderId) {
    try {
      await drive.files.update({
        fileId: docId,
        addParents: folderId,
        removeParents: "root",
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

/** Tworzy dokument "Oferta menu" – z pełnym składem pakietu i wyborów. */
export async function createMenuDoc(
  event: EventOrderForChecklist & { packageId?: string | null; packageName?: string | null; cakesAndDesserts?: string | null }
): Promise<{ docId: string; docUrl: string }> {
  const auth = getGoogleAuth();
  const docs = google.docs({ version: "v1", auth });
  const drive = google.drive({ version: "v3", auth });

  const title = `Oferta menu – ${event.clientName ?? "Impreza"} – ${event.eventDate ? new Date(event.eventDate).toLocaleDateString("pl-PL") : "?"}`;
  const createRes = await docs.documents.create({ requestBody: { title } });
  const docId = createRes.data.documentId!;

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? process.env.GOOGLE_DOCS_FOLDER_ID;
  if (folderId) {
    try {
      await drive.files.update({
        fileId: docId,
        addParents: folderId,
        removeParents: "root",
        fields: "id, parents",
      });
    } catch (err) {
      console.warn("Nie udało się przenieść dokumentu do folderu:", err);
    }
  }

  const lines = await buildMenuLines(event);
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

/** Aktualizuje dokument "Oferta menu" – czyści zawartość i generuje od nowa. */
export async function updateMenuDoc(
  docId: string,
  event: EventOrderForChecklist & { packageName?: string | null; cakesAndDesserts?: string | null }
): Promise<void> {
  const auth = getGoogleAuth();
  const docs = google.docs({ version: "v1", auth });

  const doc = await docs.documents.get({ documentId: docId });
  const content = doc.data.body?.content;
  if (!content || content.length === 0) return;
  const lastEl = content[content.length - 1];
  const endIndex = (lastEl?.endIndex ?? 2) - 1;
  if (endIndex <= 1) return;

  const lines = await buildMenuLines(event);
  const text = lines.join("\n") + "\n";

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        { deleteContentRange: { range: { startIndex: 1, endIndex } } },
        { insertText: { location: { index: 1 }, text } },
      ],
    },
  });
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
