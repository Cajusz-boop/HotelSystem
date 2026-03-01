/**
 * migrate-kwhotel.ts
 *
 * Skrypt migracji danych z KWHotelu do nowego systemu HotelSystem.
 *
 * Wymaga:
 *   1. Bazy `kwhotel_import` zaimportowanej z kw.sql (XAMPP MySQL)
 *   2. Bazy `hotelsystem` (Prisma / nowy system)
 *   3. Pakietu mysql2: npm install mysql2 --save-dev
 *
 * Uruchomienie:
 *   npx tsx prisma/migrate-kwhotel.ts
 *
 * Opcje środowiskowe:
 *   KW_DATABASE_URL  – URL do bazy KWHotel (domyślnie: mysql://root@127.0.0.1:3306/kwhotel_import)
 *   DATABASE_URL     – URL do bazy docelowej (z .env)
 *   DRY_RUN=1        – podgląd bez zapisu
 */

import "dotenv/config";
import mysql, { RowDataPacket } from "mysql2/promise";
import { prisma } from "../lib/db";

// ---------------------------------------------------------------------------
// Konfiguracja
// ---------------------------------------------------------------------------

const KW_URL = process.env.KW_DATABASE_URL ?? "mysql://root@127.0.0.1:3306/kwhotel_import";
const DRY_RUN = process.env.DRY_RUN === "1";
const CLEAR_RESERVATIONS = process.env.CLEAR_RESERVATIONS === "1";
const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// Typy dla danych z KWHotel
// ---------------------------------------------------------------------------

interface KwRoom extends RowDataPacket {
  id: number;
  name: string;
  room_group_id: number;
  floor: number;
  cleanliness: number;
  renovation: number;
  deleted: number;
}

interface KwRoomGroup extends RowDataPacket {
  id: number;
  name: string;
  beds_number: number;
  deleted: number;
}

interface KwClient extends RowDataPacket {
  KlientID: number;
  Nazwisko: string;
  Email: string | null;
  Telefon: string | null;
  NrDowodu: string | null;
  Adres: string | null;
  IsFirma: number;
  NIP: string | null;
  Countrie: string | null;
  KlientCzarny: number;
  KlientBialy: number;
  DataUr: Date | null;
  MiejsceUr: string | null;
  gender: number | null;
  mobile_number: string | null;
  Uwagi: string | null;
  Mailing: number;
  Active: number;
}

interface KwReservation extends RowDataPacket {
  RezerwacjaID: number;
  PokojID: number;
  KlientID: number;
  DataOd: Date;
  DataDo: Date;
  Cena: number;
  cena_noc: number;
  Osob: number;
  status_id: number;
  status2_id: number;
  rez_rsk_id: number | null;
  segment_id: number | null;
  channel_id: number | null;
  group_id: number | null;
  Uwagi: string | null;
  NrOnLine: string | null;
  DataUtworzenia: Date | null;
  Dzieci1: number;
  Dzieci2: number;
  Dzieci3: number;
  OplataKlimat: number;
  WplataZaliczka: number;
  rabat: number;
}

interface KwGroup extends RowDataPacket {
  GrupaID: number;
  KlientID: number;
  Uwagi: string | null;
  DataUtworzenia: Date | null;
  status2_id: number;
  NrOnLine: string | null;
}

interface KwGroupReservation extends RowDataPacket {
  GrupaID: number;
  RezerwacjaID: number;
}

interface KwReservationClient extends RowDataPacket {
  RezerwacjaID: number;
  KlientID: number;
}

interface KwBookingSource extends RowDataPacket {
  rsk_id: number;
  rsk_nazwa: string;
}

// ---------------------------------------------------------------------------
// Mapowania
// ---------------------------------------------------------------------------

function mapReservationStatus(status_id: number, status2_id: number): "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW" {
  if (status2_id === 4) return "CANCELLED";
  switch (status_id) {
    case 0: return "CONFIRMED";
    case 1: return "CONFIRMED";
    case 2: return "CHECKED_IN";
    case 3: return "CHECKED_OUT";
    case 4: return "CHECKED_OUT";
    default: return "CHECKED_OUT"; // status_id 9-40 to prawdopodobnie zakończone/rozliczone
  }
}

function mapBookingSource(rsk_id: number | null, sources: Map<number, string>): { source: string | null; channel: string | null } {
  if (!rsk_id || !sources.has(rsk_id)) return { source: null, channel: null };
  const name = sources.get(rsk_id)!.trim();
  switch (name) {
    case "Booking.com": return { source: "OTA", channel: "BOOKING_COM" };
    case "HRS": return { source: "OTA", channel: "HRS" };
    case "Booking Engine": return { source: "WEBSITE", channel: "DIRECT" };
    case "Recepcja": return { source: "WALK_IN", channel: "DIRECT" };
    case "Travelist": return { source: "OTA", channel: "TRAVELIST" };
    case "etravel": return { source: "OTA", channel: "ETRAVEL" };
    case "eholiday": return { source: "OTA", channel: "EHOLIDAY" };
    case "Mybenefit": return { source: "OTA", channel: "MYBENEFIT" };
    case "Strona WWW": return { source: "WEBSITE", channel: "DIRECT" };
    case "API": return { source: "OTA", channel: "API" };
    case "Wesele": return { source: "PHONE", channel: "DIRECT" };
    default: return { source: "OTHER", channel: name.toUpperCase() };
  }
}

function cleanNip(nip: string | null): string | null {
  if (!nip) return null;
  const cleaned = nip.replace(/[-\s]/g, "");
  if (cleaned.length !== 10 || !/^\d{10}$/.test(cleaned)) return null;
  return cleaned;
}

function cleanPhone(phone: string | null, mobile: string | null): string | null {
  const p = mobile || phone;
  if (!p || p.trim() === "") return null;
  return p.trim().substring(0, 50);
}

function mapCountry(code: string | null): string {
  if (!code || code.trim() === "") return "PL";
  const c = code.trim().toUpperCase();
  if (c === "PL" || c === "POL") return "PL";
  if (c.length === 2) return c;
  return c.substring(0, 3);
}

function mapGender(g: number | null): string | null {
  if (g === 1) return "M";
  if (g === 2) return "F";
  return null;
}

function cleanRoomName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function cleanRoomGroupName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function parseAddress(adres: string | null): { street: string | null; postalCode: string | null; city: string | null } {
  if (!adres) return { street: null, postalCode: null, city: null };
  const clean = adres.replace(/\\n/g, ", ").trim();
  const postalMatch = clean.match(/(\d{2}-\d{3})\s+(.+?)$/);
  if (postalMatch) {
    const beforePostal = clean.substring(0, postalMatch.index).replace(/,\s*$/, "").trim();
    return {
      street: beforePostal || null,
      postalCode: postalMatch[1],
      city: postalMatch[2].trim() || null,
    };
  }
  return { street: clean || null, postalCode: null, city: null };
}

// ---------------------------------------------------------------------------
// Konwersja dat KWHotel → HotelSystem
// ---------------------------------------------------------------------------

function convertKwDates(dataOd: Date, dataDo: Date): { checkIn: Date; checkOut: Date } {
  const checkIn = new Date(dataOd);
  const checkOut = new Date(dataDo);
  checkOut.setDate(checkOut.getDate() + 1);
  return { checkIn, checkOut };
}

// ---------------------------------------------------------------------------
// Statystyki
// ---------------------------------------------------------------------------

const stats = {
  roomTypesCreated: 0,
  roomsCreated: 0,
  roomsSkipped: 0,
  guestsCreated: 0,
  guestsSkipped: 0,
  companiesCreated: 0,
  companiesSkipped: 0,
  groupsCreated: 0,
  reservationsCreated: 0,
  reservationsSkipped: 0,
  reservationsErrors: [] as string[],
  occupantsCreated: 0,
};

// ---------------------------------------------------------------------------
// Główna funkcja migracji
// ---------------------------------------------------------------------------

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  Migracja KWHotel → HotelSystem                    ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  if (DRY_RUN) console.log("⚠ Tryb DRY_RUN – dane nie zostaną zapisane.\n");
  if (CLEAR_RESERVATIONS) console.log("⚠ Tryb CLEAR_RESERVATIONS – istniejące rezerwacje zostaną usunięte!\n");

  // Połącz z bazą KWHotel
  const kw = await mysql.createConnection(KW_URL);
  console.log("✔ Połączono z kwhotel_import");

  // Upewnij się, że property istnieje
  const property = await prisma.property.upsert({
    where: { code: "default" },
    update: {},
    create: { name: "Karczma Łabędź", code: "default", overbookingLimitPercent: 0 },
  });
  console.log(`✔ Property: ${property.name} (${property.id})\n`);

  // =========================================================================
  // 0. Czyszczenie istniejących rezerwacji (jeśli CLEAR_RESERVATIONS=1)
  // =========================================================================
  if (CLEAR_RESERVATIONS && !DRY_RUN) {
    console.log("=== 0/6 Czyszczenie istniejących danych ===");
    
    // Usuń w odpowiedniej kolejności (foreign keys)
    const deletedOccupants = await prisma.reservationOccupant.deleteMany({});
    console.log(`  Usunięto ReservationOccupant: ${deletedOccupants.count}`);
    
    const deletedTransactions = await prisma.transaction.deleteMany({});
    console.log(`  Usunięto Transaction: ${deletedTransactions.count}`);
    
    const deletedReservations = await prisma.reservation.deleteMany({});
    console.log(`  Usunięto Reservation: ${deletedReservations.count}`);
    
    const deletedGroups = await prisma.reservationGroup.deleteMany({});
    console.log(`  Usunięto ReservationGroup: ${deletedGroups.count}`);
    
    const deletedGuests = await prisma.guest.deleteMany({});
    console.log(`  Usunięto Guest: ${deletedGuests.count}`);
    
    const deletedCompanies = await prisma.company.deleteMany({});
    console.log(`  Usunięto Company: ${deletedCompanies.count}`);
    
    console.log("  ✔ Dane wyczyszczone\n");
  }

  // =========================================================================
  // 1. Typy pokoi (room_groups → RoomType)
  // =========================================================================
  console.log("=== 1/6 Typy pokoi (room_groups → RoomType) ===");
  const [roomGroups] = await kw.query<KwRoomGroup[]>("SELECT id, name, beds_number, deleted FROM room_groups WHERE deleted = 0 ORDER BY id");
  const roomGroupMap = new Map<number, string>(); // kwGroupId → newRoomTypeName

  for (const rg of roomGroups) {
    const typeName = cleanRoomGroupName(rg.name);
    roomGroupMap.set(rg.id, typeName);
    if (DRY_RUN) { stats.roomTypesCreated++; continue; }
    await prisma.roomType.upsert({
      where: { name: typeName },
      update: {},
      create: { name: typeName, sortOrder: rg.id },
    });
    stats.roomTypesCreated++;
  }
  console.log(`  Typy pokoi: ${stats.roomTypesCreated} utworzono/zaktualizowano`);

  // =========================================================================
  // 2. Pokoje (rooms → Room)
  // =========================================================================
  console.log("\n=== 2/6 Pokoje (rooms → Room) ===");
  const [kwRooms] = await kw.query<KwRoom[]>("SELECT id, name, room_group_id, floor, cleanliness, renovation+0 AS renovation, deleted FROM rooms WHERE deleted = 0 ORDER BY id");

  const roomIdMap = new Map<number, string>(); // kwRoomId → newRoomId (cuid)

  for (const r of kwRooms) {
    const roomNumber = cleanRoomName(r.name);
    const typeName = roomGroupMap.get(r.room_group_id) ?? "Standard";

    if (DRY_RUN) {
      roomIdMap.set(r.id, `dry-${r.id}`);
      stats.roomsCreated++;
      continue;
    }

    const existing = await prisma.room.findUnique({ where: { number: roomNumber } });
    if (existing) {
      roomIdMap.set(r.id, existing.id);
      stats.roomsSkipped++;
      continue;
    }

    const status = r.renovation ? "OOO" as const : r.cleanliness === 1 ? "DIRTY" as const : "CLEAN" as const;

    const room = await prisma.room.create({
      data: {
        propertyId: property.id,
        number: roomNumber,
        type: typeName,
        status,
        activeForSale: true,
        floor: r.floor > 0 ? String(r.floor) : null,
      },
    });
    roomIdMap.set(r.id, room.id);
    stats.roomsCreated++;
  }
  console.log(`  Pokoje: ${stats.roomsCreated} utworzono, ${stats.roomsSkipped} pominięto (istniały)`);

  // =========================================================================
  // 3. Goście i firmy (klienci → Guest + Company)
  // =========================================================================
  console.log("\n=== 3/6 Goście i firmy (klienci → Guest + Company) ===");

  const [kwClients] = await kw.query<KwClient[]>(
    `SELECT KlientID, Nazwisko, Email, Telefon, NrDowodu, Adres, IsFirma, NIP, Countrie,
            KlientCzarny, KlientBialy, DataUr, MiejsceUr, gender, mobile_number, Uwagi, Mailing, Active
     FROM klienci
     WHERE Active = 1 OR KlientID IN (SELECT DISTINCT KlientID FROM rezerwacje)
     ORDER BY KlientID`
  );

  const guestIdMap = new Map<number, string>();   // kwKlientID → new Guest.id
  const companyNipMap = new Map<string, string>(); // NIP → new Company.id
  const kwClientToCompany = new Map<number, string>(); // kwKlientID (firma) → Company.id

  let clientBatch = 0;
  for (let i = 0; i < kwClients.length; i++) {
    const c = kwClients[i];
    const name = (c.Nazwisko ?? "").trim();
    if (!name || name.length < 2) continue;

    // --- Firma ---
    if (c.IsFirma === 1) {
      const nip = cleanNip(c.NIP);
      if (nip && !companyNipMap.has(nip)) {
        const addr = parseAddress(c.Adres);
        if (!DRY_RUN) {
          const existing = await prisma.company.findUnique({ where: { nip } });
          if (existing) {
            companyNipMap.set(nip, existing.id);
            kwClientToCompany.set(c.KlientID, existing.id);
            stats.companiesSkipped++;
          } else {
            const company = await prisma.company.create({
              data: {
                nip,
                name,
                address: addr.street,
                postalCode: addr.postalCode,
                city: addr.city,
                country: mapCountry(c.Countrie) === "PL" ? "POL" : mapCountry(c.Countrie),
                contactPhone: cleanPhone(c.Telefon, c.mobile_number),
                contactEmail: c.Email?.trim() || null,
              },
            });
            companyNipMap.set(nip, company.id);
            kwClientToCompany.set(c.KlientID, company.id);
            stats.companiesCreated++;
          }
        } else {
          companyNipMap.set(nip, `dry-co-${nip}`);
          kwClientToCompany.set(c.KlientID, `dry-co-${nip}`);
          stats.companiesCreated++;
        }
      } else if (nip && companyNipMap.has(nip)) {
        kwClientToCompany.set(c.KlientID, companyNipMap.get(nip)!);
        stats.companiesSkipped++;
      }
      // Firmy z NIP też mogą być "gościem" w rezerwacji – tworzymy wpis Guest
    }

    // --- Gość ---
    if (DRY_RUN) {
      guestIdMap.set(c.KlientID, `dry-${c.KlientID}`);
      stats.guestsCreated++;
      continue;
    }

    // Szukaj po nazwisku + email/telefon (unikaj duplikatów)
    const existingGuest = await prisma.guest.findFirst({
      where: { name },
      select: { id: true },
    });
    if (existingGuest) {
      guestIdMap.set(c.KlientID, existingGuest.id);
      stats.guestsSkipped++;
      continue;
    }

    const addr = parseAddress(c.Adres);
    const guest = await prisma.guest.create({
      data: {
        name,
        email: c.Email?.trim() || null,
        phone: cleanPhone(c.Telefon, c.mobile_number),
        documentNumber: c.NrDowodu?.trim() || null,
        country: mapCountry(c.Countrie),
        nationality: mapCountry(c.Countrie),
        isBlacklisted: c.KlientCzarny === 1,
        isVip: c.KlientBialy === 1,
        dateOfBirth: c.DataUr ?? undefined,
        placeOfBirth: c.MiejsceUr?.trim() || null,
        gender: mapGender(c.gender),
        street: addr.street,
        postalCode: addr.postalCode,
        city: addr.city,
        staffNotes: c.Uwagi?.trim() || null,
        gdprMarketingConsent: c.Mailing === 1,
      },
    });
    guestIdMap.set(c.KlientID, guest.id);
    stats.guestsCreated++;

    if (++clientBatch % 1000 === 0) {
      console.log(`  ... ${clientBatch}/${kwClients.length} klientów przetworzono`);
    }
  }
  console.log(`  Goście: ${stats.guestsCreated} utworzono, ${stats.guestsSkipped} pominięto`);
  console.log(`  Firmy: ${stats.companiesCreated} utworzono, ${stats.companiesSkipped} pominięto`);

  // =========================================================================
  // 4. Grupy rezerwacji (grupy → ReservationGroup)
  // =========================================================================
  console.log("\n=== 4/6 Grupy rezerwacji ===");

  const [kwGroups] = await kw.query<KwGroup[]>(
    "SELECT GrupaID, KlientID, Uwagi, DataUtworzenia, status2_id, NrOnLine FROM grupy ORDER BY GrupaID"
  );
  const [kwGroupRezLinks] = await kw.query<KwGroupReservation[]>(
    "SELECT GrupaID, RezerwacjaID FROM grupyrezerwacje ORDER BY GrupaID, RezerwacjaID"
  );

  // Zbuduj mapę: GrupaID → [RezerwacjaID, ...]
  const groupResMap = new Map<number, number[]>();
  for (const link of kwGroupRezLinks) {
    if (!groupResMap.has(link.GrupaID)) groupResMap.set(link.GrupaID, []);
    groupResMap.get(link.GrupaID)!.push(link.RezerwacjaID);
  }

  const groupIdMap = new Map<number, string>(); // kwGrupaID → new ReservationGroup.id

  for (const g of kwGroups) {
    const guestName = guestIdMap.has(g.KlientID) ? (kwClients.find(c => c.KlientID === g.KlientID)?.Nazwisko?.trim() ?? "") : "";
    const groupName = g.NrOnLine
      ? `KW-${g.GrupaID} (${g.NrOnLine})`
      : guestName
        ? `KW-${g.GrupaID} (${guestName})`
        : `KW-${g.GrupaID}`;

    if (DRY_RUN) {
      groupIdMap.set(g.GrupaID, `dry-grp-${g.GrupaID}`);
      stats.groupsCreated++;
      continue;
    }

    const group = await prisma.reservationGroup.create({
      data: {
        name: groupName.substring(0, 200),
        note: g.Uwagi?.trim()?.substring(0, 190) || null,
      },
    });
    groupIdMap.set(g.GrupaID, group.id);
    stats.groupsCreated++;
  }
  console.log(`  Grupy: ${stats.groupsCreated} utworzono`);

  // Odwrotna mapa: RezerwacjaID → GrupaID (dla szybkiego lookup)
  const rezToGroup = new Map<number, number>();
  for (const [groupId, rezIds] of groupResMap) {
    for (const rezId of rezIds) {
      rezToGroup.set(rezId, groupId);
    }
  }

  // =========================================================================
  // 5. Źródła rezerwacji
  // =========================================================================
  const [kwSources] = await kw.query<KwBookingSource[]>("SELECT rsk_id, rsk_nazwa FROM rez_skad");
  const sourcesMap = new Map<number, string>();
  for (const s of kwSources) sourcesMap.set(s.rsk_id, s.rsk_nazwa);

  // =========================================================================
  // 6. Rezerwacje (rezerwacje → Reservation)
  // =========================================================================
  console.log("\n=== 5/6 Rezerwacje ===");

  const totalReservations = ((await kw.query<RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM rezerwacje"))[0][0] as { cnt: number }).cnt;
  console.log(`  Łącznie w KWHotel: ${totalReservations} rezerwacji`);

  const reservationIdMap = new Map<number, string>(); // kwRezerwacjaID → new Reservation.id
  let rezOffset = 0;
  let rezProcessed = 0;

  while (rezOffset < totalReservations) {
    const [batch] = await kw.query<KwReservation[]>(
      `SELECT RezerwacjaID, PokojID, KlientID, DataOd, DataDo, Cena, cena_noc, Osob,
              status_id, status2_id, rez_rsk_id, segment_id, channel_id, group_id,
              Uwagi, NrOnLine, DataUtworzenia, Dzieci1, Dzieci2, Dzieci3,
              OplataKlimat, WplataZaliczka, rabat
       FROM rezerwacje
       ORDER BY RezerwacjaID
       LIMIT ${BATCH_SIZE} OFFSET ${rezOffset}`
    );

    for (const r of batch) {
      const roomId = r.PokojID ? roomIdMap.get(r.PokojID) : undefined;
      const guestId = r.KlientID ? guestIdMap.get(r.KlientID) : undefined;

      if (!roomId) {
        stats.reservationsErrors.push(`Rez #${r.RezerwacjaID}: brak pokoju PokojID=${r.PokojID}`);
        stats.reservationsSkipped++;
        continue;
      }
      if (!guestId) {
        stats.reservationsErrors.push(`Rez #${r.RezerwacjaID}: brak gościa KlientID=${r.KlientID}`);
        stats.reservationsSkipped++;
        continue;
      }

      const status = mapReservationStatus(r.status_id, r.status2_id);
      const { source, channel } = mapBookingSource(r.rez_rsk_id, sourcesMap);
      const children = (r.Dzieci1 || 0) + (r.Dzieci2 || 0) + (r.Dzieci3 || 0);
      const adults = Math.max(1, (r.Osob || 1) - children);

      // Grupa: sprawdź w tabeli grupyrezerwacje LUB w rezerwacje.group_id
      const kwGroupId = rezToGroup.get(r.RezerwacjaID) ?? r.group_id;
      const groupId = kwGroupId ? groupIdMap.get(kwGroupId) ?? null : null;

      // Firma (jeśli klient jest firmą)
      const companyId = kwClientToCompany.get(r.KlientID) ?? null;

      if (DRY_RUN) {
        reservationIdMap.set(r.RezerwacjaID, `dry-rez-${r.RezerwacjaID}`);
        stats.reservationsCreated++;
        continue;
      }

      try {
        const { checkIn, checkOut } = convertKwDates(r.DataOd, r.DataDo);

        const reservation = await prisma.reservation.create({
          data: {
            guestId,
            roomId,
            companyId,
            groupId,
            checkIn,
            checkOut,
            status,
            source,
            channel,
            pax: r.Osob || 1,
            adults,
            children: children > 0 ? children : null,
            notes: r.Uwagi?.trim() || null,
            internalNotes: r.NrOnLine ? `KW Online: ${r.NrOnLine}` : null,
            createdAt: r.DataUtworzenia ?? undefined,
          },
        });
        reservationIdMap.set(r.RezerwacjaID, reservation.id);
        stats.reservationsCreated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stats.reservationsErrors.push(`Rez #${r.RezerwacjaID}: ${msg.substring(0, 120)}`);
        stats.reservationsSkipped++;
      }
    }

    rezOffset += BATCH_SIZE;
    rezProcessed += batch.length;
    if (rezProcessed % 5000 === 0 || rezProcessed === totalReservations) {
      console.log(`  ... ${rezProcessed}/${totalReservations} rezerwacji przetworzono`);
    }
  }
  console.log(`  Rezerwacje: ${stats.reservationsCreated} utworzono, ${stats.reservationsSkipped} pominięto`);
  if (stats.reservationsErrors.length > 0) {
    console.log(`  Błędy (pierwsze 20):`);
    stats.reservationsErrors.slice(0, 20).forEach(e => console.log(`    - ${e}`));
  }

  // =========================================================================
  // 7. Dodatkowi goście w rezerwacji (rezerwklient → ReservationOccupant)
  // =========================================================================
  console.log("\n=== 6/6 Dodatkowi goście w rezerwacjach ===");

  const [kwRezClients] = await kw.query<KwReservationClient[]>(
    "SELECT RezerwacjaID, KlientID FROM rezerwklient ORDER BY RezerwacjaID, KlientID"
  );

  // Zbuduj mapę głównych klientów rezerwacji (by pominąć ich jako occupant)
  const rezMainClient = new Map<number, number>();
  let mainClientOffset = 0;
  while (true) {
    const [mainBatch] = await kw.query<RowDataPacket[]>(
      `SELECT RezerwacjaID, KlientID FROM rezerwacje ORDER BY RezerwacjaID LIMIT ${BATCH_SIZE} OFFSET ${mainClientOffset}`
    );
    if (mainBatch.length === 0) break;
    for (const row of mainBatch) rezMainClient.set(row.RezerwacjaID as number, row.KlientID as number);
    mainClientOffset += BATCH_SIZE;
  }

  let occBatch = 0;
  for (const rc of kwRezClients) {
    const reservationId = reservationIdMap.get(rc.RezerwacjaID);
    const guestId = guestIdMap.get(rc.KlientID);
    if (!reservationId || !guestId) continue;

    // Pomiń głównego gościa (jest już w Reservation.guestId)
    if (rezMainClient.get(rc.RezerwacjaID) === rc.KlientID) continue;

    if (DRY_RUN) {
      stats.occupantsCreated++;
      continue;
    }

    try {
      await prisma.reservationOccupant.create({
        data: { reservationId, guestId },
      });
      stats.occupantsCreated++;
    } catch {
      // duplikat – ignoruj (unique constraint)
    }

    if (++occBatch % 5000 === 0) {
      console.log(`  ... ${occBatch} occupants przetworzono`);
    }
  }
  console.log(`  Occupants: ${stats.occupantsCreated} utworzono`);

  // =========================================================================
  // Podsumowanie
  // =========================================================================
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  PODSUMOWANIE MIGRACJI                              ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Typy pokoi:    ${String(stats.roomTypesCreated).padStart(6)}  utworzono             ║`);
  console.log(`║  Pokoje:        ${String(stats.roomsCreated).padStart(6)}  utworzono / ${String(stats.roomsSkipped).padStart(4)} pom.  ║`);
  console.log(`║  Goście:        ${String(stats.guestsCreated).padStart(6)}  utworzono / ${String(stats.guestsSkipped).padStart(4)} pom.  ║`);
  console.log(`║  Firmy:         ${String(stats.companiesCreated).padStart(6)}  utworzono / ${String(stats.companiesSkipped).padStart(4)} pom.  ║`);
  console.log(`║  Grupy:         ${String(stats.groupsCreated).padStart(6)}  utworzono             ║`);
  console.log(`║  Rezerwacje:    ${String(stats.reservationsCreated).padStart(6)}  utworzono / ${String(stats.reservationsSkipped).padStart(4)} pom.  ║`);
  console.log(`║  Occupants:     ${String(stats.occupantsCreated).padStart(6)}  utworzono             ║`);
  console.log(`║  Błędy rez.:    ${String(stats.reservationsErrors.length).padStart(6)}                      ║`);
  console.log("╚══════════════════════════════════════════════════════╝");

  await kw.end();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Błąd migracji:", e);
  process.exit(1);
});
