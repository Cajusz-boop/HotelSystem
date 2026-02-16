"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

export type SeasonType = "PEAK" | "OFF_PEAK";

export type SeasonEntry = {
  id: string;
  name: string;
  type: SeasonType;
  dateFrom: string; // MM-DD
  dateTo: string;   // MM-DD
};

const MM_DD_REGEX = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function isValidMMDD(s: string): boolean {
  return MM_DD_REGEX.test(s);
}

function normalizeEntry(e: unknown): SeasonEntry | null {
  if (!e || typeof e !== "object") return null;
  const o = e as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const type = o.type === "PEAK" || o.type === "OFF_PEAK" ? o.type : "OFF_PEAK";
  const dateFrom = typeof o.dateFrom === "string" && isValidMMDD(o.dateFrom) ? o.dateFrom : "01-01";
  const dateTo = typeof o.dateTo === "string" && isValidMMDD(o.dateTo) ? o.dateTo : "12-31";
  if (!id || !name) return null;
  return { id, name, type, dateFrom, dateTo };
}

export async function getSeasons(): Promise<
  { success: true; data: SeasonEntry[] } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const row = await prisma.hotelConfig.findUnique({ where: { id: "default" } });
  const raw = row?.seasons;
  if (!Array.isArray(raw)) return { success: true, data: [] };
  const data = raw.map(normalizeEntry).filter((e): e is SeasonEntry => e !== null);
  return { success: true, data };
}

export async function updateSeasons(seasons: SeasonEntry[]): Promise<
  { success: true } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const normalized = seasons
    .map((s) => ({
      id: s.id || `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: String(s.name).trim() || "Sezon",
      type: s.type === "PEAK" || s.type === "OFF_PEAK" ? s.type : "OFF_PEAK",
      dateFrom: isValidMMDD(s.dateFrom) ? s.dateFrom : "01-01",
      dateTo: isValidMMDD(s.dateTo) ? s.dateTo : "12-31",
    }))
    .filter((s) => s.name.length > 0);

  await prisma.hotelConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      name: "",
      seasons: normalized as object,
    },
    update: {
      seasons: normalized as object,
    },
  });
  return { success: true };
}

/** Sprawdza, czy dana data (YYYY-MM-DD) przypada w sezonie peak. */
export async function isDateInPeakSeason(dateStr: string): Promise<boolean> {
  const row = await prisma.hotelConfig.findUnique({ where: { id: "default" } });
  const raw = row?.seasons;
  if (!Array.isArray(raw)) return false;
  const [_y, m, d] = dateStr.split("-").map(Number);
  if (!m || !d) return false;
  const mmdd = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  for (const e of raw) {
    const entry = normalizeEntry(e);
    if (!entry || entry.type !== "PEAK") continue;
    if (isDateMMDDInRange(mmdd, entry.dateFrom, entry.dateTo)) return true;
  }
  return false;
}

function isDateMMDDInRange(mmdd: string, from: string, to: string): boolean {
  const [fm, fd] = from.split("-").map(Number);
  const [tm, td] = to.split("-").map(Number);
  const [m, d] = mmdd.split("-").map(Number);
  const fromOrd = fm * 100 + fd;
  const toOrd = tm * 100 + td;
  const ord = m * 100 + d;
  if (fromOrd <= toOrd) return ord >= fromOrd && ord <= toOrd;
  return ord >= fromOrd || ord <= toOrd; // range spans year (e.g. 12-01 to 01-31)
}
