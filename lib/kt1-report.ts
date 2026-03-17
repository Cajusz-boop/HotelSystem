/**
 * Raport KT-1 (GUS) — Sprawozdanie o wykorzystaniu turystycznego obiektu noclegowego.
 * Specyfikacja: docs/specs/kt1-report-spec.md
 */

import { prisma } from "@/lib/db";
import { getKt1CountryCode, isForeignCountry } from "@/lib/guest-country";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const KT1_COUNTRIES: { code: string; label: string }[] = [
  { code: "DE", label: "Niemcy" },
  { code: "GB", label: "Wielka Brytania" },
  { code: "RU", label: "Rosja" },
  { code: "UA", label: "Ukraina" },
  { code: "BY", label: "Białoruś" },
  { code: "LT", label: "Litwa" },
  { code: "CZ", label: "Czechy" },
  { code: "SK", label: "Słowacja" },
  { code: "FR", label: "Francja" },
  { code: "IT", label: "Włochy" },
  { code: "NL", label: "Holandia" },
  { code: "ES", label: "Hiszpania" },
  { code: "SE", label: "Szwecja" },
  { code: "DK", label: "Dania" },
  { code: "NO", label: "Norwegia" },
  { code: "US", label: "USA" },
  { code: "IL", label: "Izrael" },
  { code: "JP", label: "Japonia" },
  { code: "OTHER", label: "Pozostałe kraje" },
];

export interface Kt1ReportSection1 {
  objectName: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  gmina: string | null;
  powiat: string | null;
  voivodeship: string | null;
  regon: string | null;
  objectType: number;
  category: number;
  isYearRound: boolean;
  email: string | null;
}

export interface Kt1ReportSection3 {
  totalRooms: number;
  totalPlaces: number;
  roomsWithBathroom: number;
  roomsAccessible: number;
  placesYearRound: number;
  placesSeasonal: number;
}

export interface Kt1ReportSection4 {
  daysActive: number;
  nominalPlaces: number;
  nominalRooms: number;
  guestsTotal: number;
  guestsForeign: number;
  personNightsTotal: number;
  personNightsForeign: number;
  roomNightsTotal: number;
  roomNightsForeign: number;
}

export interface Kt1ReportSection5Row {
  countryCode: string;
  countryLabel: string;
  guests: number;
  personNights: number;
}

export interface Kt1ReportResponse {
  section1: Kt1ReportSection1;
  section3: Kt1ReportSection3 | null;
  section4: Kt1ReportSection4;
  section5: Kt1ReportSection5Row[];
  meta: {
    month: number;
    year: number;
    generatedAt: string;
  };
}

/** Zwraca liczbę dni w miesiącu (UTC). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export async function getKt1Report(
  month: number,
  year: number
): Promise<Kt1ReportResponse | null> {
  const gusConfig = await prisma.gusConfig.findUnique({ where: { id: 1 } });
  if (!gusConfig) return null;

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const nextMonthStart = new Date(Date.UTC(year, month, 1));

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
      checkIn: { lt: nextMonthStart },
      checkOut: { gt: monthStart },
    },
    include: {
      guest: { select: { id: true, country: true } },
      room: { select: { id: true } },
    },
  });

  let guestsTotal = 0;
  let guestsForeign = 0;
  let personNightsTotal = 0;
  let personNightsForeign = 0;
  let roomNightsTotal = 0;
  let roomNightsForeign = 0;

  const countryAgg: Map<
    string,
    { guests: number; personNights: number }
  > = new Map();

  const knownCodes = new Set(KT1_COUNTRIES.filter((c) => c.code !== "OTHER").map((c) => c.code));

  for (const r of reservations) {
    const pax = r.pax ?? 1;
    const checkIn = new Date(r.checkIn);
    const checkOut = new Date(r.checkOut);
    const effectiveStart =
      checkIn.getTime() > monthStart.getTime() ? checkIn : monthStart;
    const effectiveEnd =
      checkOut.getTime() < nextMonthStart.getTime() ? checkOut : nextMonthStart;
    const nightsInMonth = Math.max(
      0,
      Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / MS_PER_DAY)
    );

    guestsTotal += pax;
    personNightsTotal += nightsInMonth * pax;
    roomNightsTotal += nightsInMonth;

    const countryCode = getKt1CountryCode(r.guest?.country ?? null);
    const foreign = isForeignCountry(r.guest?.country ?? null);
    if (foreign) {
      guestsForeign += pax;
      personNightsForeign += nightsInMonth * pax;
      roomNightsForeign += nightsInMonth;

      const mappedCode = knownCodes.has(countryCode) ? countryCode : "OTHER";
      const prev = countryAgg.get(mappedCode) ?? { guests: 0, personNights: 0 };
      countryAgg.set(mappedCode, {
        guests: prev.guests + pax,
        personNights: prev.personNights + nightsInMonth * pax,
      });
    }
  }

  // TODO: obsługa obiektów sezonowych (isYearRound === false)
  const daysActive = daysInMonth(year, month);

  const section5: Kt1ReportSection5Row[] = [];
  section5.push({
    countryCode: "TOTAL",
    countryLabel: "Ogółem",
    guests: guestsForeign,
    personNights: personNightsForeign,
  });
  for (const { code, label } of KT1_COUNTRIES) {
    const agg = countryAgg.get(code) ?? { guests: 0, personNights: 0 };
    section5.push({
      countryCode: code,
      countryLabel: label,
      guests: agg.guests,
      personNights: agg.personNights,
    });
  }

  return {
    section1: {
      objectName: gusConfig.objectName,
      address: gusConfig.address,
      postalCode: gusConfig.postalCode,
      city: gusConfig.city,
      gmina: gusConfig.gmina,
      powiat: gusConfig.powiat,
      voivodeship: gusConfig.voivodeship,
      regon: gusConfig.regon,
      objectType: gusConfig.objectType,
      category: gusConfig.category,
      isYearRound: gusConfig.isYearRound,
      email: gusConfig.email,
    },
    section3: null,
    section4: {
      daysActive,
      nominalPlaces: gusConfig.nominalPlaces,
      nominalRooms: gusConfig.nominalRooms,
      guestsTotal,
      guestsForeign,
      personNightsTotal,
      personNightsForeign,
      roomNightsTotal,
      roomNightsForeign,
    },
    section5,
    meta: {
      month,
      year,
      generatedAt: new Date().toISOString(),
    },
  };
}
