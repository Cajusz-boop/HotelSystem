/**
 * Audyt Centrum Sprzedaży — zapytania SQL na EventOrder
 * Uruchom: npx tsx scripts/centrum-audit-db.ts
 */
import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  console.log("=== 1A. Unikalne wartości roomName + ile rekordów ===");
  const q1a = await prisma.$queryRaw<{ roomName: string | null; cnt: bigint }[]>`
    SELECT roomName, COUNT(*) as cnt FROM EventOrder GROUP BY roomName ORDER BY cnt DESC
  `;
  console.log(JSON.stringify(q1a.map((r) => ({ roomName: r.roomName, cnt: Number(r.cnt) })), null, 2));

  console.log("\n=== 1B. Unikalne wartości eventType + ile rekordów ===");
  const q1b = await prisma.$queryRaw<{ eventType: string; cnt: bigint }[]>`
    SELECT eventType, COUNT(*) as cnt FROM EventOrder GROUP BY eventType ORDER BY cnt DESC
  `;
  console.log(JSON.stringify(q1b.map((r) => ({ ...r, cnt: Number(r.cnt) })), null, 2));

  console.log("\n=== 1C. Unikalne wartości status + ile rekordów ===");
  const q1c = await prisma.$queryRaw<{ status: string; cnt: bigint }[]>`
    SELECT status, COUNT(*) as cnt FROM EventOrder GROUP BY status ORDER BY cnt DESC
  `;
  console.log(JSON.stringify(q1c.map((r) => ({ ...r, cnt: Number(r.cnt) })), null, 2));

  console.log("\n=== 1D. Imprezy bez klienta, bez daty, lub bez typu (LIMIT 20) ===");
  const q1d = await prisma.$queryRaw<
    { id: string; clientName: string | null; eventDate: Date | null; eventType: string | null; roomName: string | null; status: string | null }[]
  >`
    SELECT id, clientName, eventDate, eventType, roomName, status
    FROM EventOrder
    WHERE clientName IS NULL OR clientName = '' OR eventDate IS NULL OR eventType IS NULL OR eventType = ''
    LIMIT 20
  `;
  console.log(JSON.stringify(q1d, null, 2));

  console.log("\n=== 1E. Imprezy z depositAmount — opłacone vs nieopłacone ===");
  const q1e = await prisma.$queryRaw<
    { total: bigint; has_deposit: bigint; paid: bigint; unpaid: bigint }[]
  >`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN depositAmount IS NOT NULL AND depositAmount > 0 THEN 1 ELSE 0 END) as has_deposit,
      SUM(CASE WHEN depositPaid = 1 THEN 1 ELSE 0 END) as paid,
      SUM(CASE WHEN depositAmount IS NOT NULL AND depositAmount > 0 AND depositPaid = 0 THEN 1 ELSE 0 END) as unpaid
    FROM EventOrder
  `;
  const e = q1e[0];
  console.log({
    total: Number(e?.total ?? 0),
    has_deposit: Number(e?.has_deposit ?? 0),
    paid: Number(e?.paid ?? 0),
    unpaid: Number(e?.unpaid ?? 0),
  });

  console.log("\n=== 1F. Poprawiny — ile z isPoprawiny=true i ile ma parentEventId ===");
  const q1f = await prisma.$queryRaw<{ total_poprawiny: bigint; has_parent: bigint }[]>`
    SELECT
      COUNT(*) as total_poprawiny,
      SUM(CASE WHEN parentEventId IS NOT NULL AND parentEventId != '' THEN 1 ELSE 0 END) as has_parent
    FROM EventOrder WHERE isPoprawiny = 1
  `;
  const f = q1f[0];
  console.log({ total_poprawiny: Number(f?.total_poprawiny ?? 0), has_parent: Number(f?.has_parent ?? 0) });

  console.log("\n=== 1G. Google Calendar — ile zsynchronizowanych ===");
  const q1g = await prisma.$queryRaw<
    { total: bigint; synced: bigint; has_gcal_id: bigint; has_error: bigint }[]
  >`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN googleCalendarSynced = 1 THEN 1 ELSE 0 END) as synced,
      SUM(CASE WHEN googleCalendarEventId IS NOT NULL THEN 1 ELSE 0 END) as has_gcal_id,
      SUM(CASE WHEN googleCalendarError IS NOT NULL AND googleCalendarError != '' THEN 1 ELSE 0 END) as has_error
    FROM EventOrder
  `;
  const g = q1g[0];
  console.log({
    total: Number(g?.total ?? 0),
    synced: Number(g?.synced ?? 0),
    has_gcal_id: Number(g?.has_gcal_id ?? 0),
    has_error: Number(g?.has_error ?? 0),
  });

  console.log("\n=== 1H. Menu — ile imprez ma zapisane menu ===");
  const q1h = await prisma.$queryRaw<{ total: bigint; has_menu: bigint }[]>`
    SELECT COUNT(*) as total, SUM(CASE WHEN menu IS NOT NULL THEN 1 ELSE 0 END) as has_menu
    FROM EventOrder
  `;
  const h = q1h[0];
  console.log({ total: Number(h?.total ?? 0), has_menu: Number(h?.has_menu ?? 0) });

  console.log("\n=== 1I. GroupQuote — ile rekordów ===");
  const q1i = await prisma.groupQuote.count();
  console.log({ total: q1i });

  console.log("\n=== 1J. Kolizje dat — top 10 dni z >3 imprez (bez CANCELLED) ===");
  const q1j = await prisma.$queryRaw<{ eventDate: Date; cnt: bigint }[]>`
    SELECT eventDate, COUNT(*) as cnt FROM EventOrder
    WHERE status != 'CANCELLED'
    GROUP BY eventDate HAVING cnt > 3
    ORDER BY cnt DESC LIMIT 10
  `;
  console.log(q1j.map((r) => ({ eventDate: r.eventDate?.toISOString?.() ?? r.eventDate, cnt: Number(r.cnt) })));

  console.log("\n=== 1K. Zakres dat — najstarsza i najnowsza impreza ===");
  const q1k = await prisma.$queryRaw<{ najstarsza: Date | null; najnowsza: Date | null }[]>`
    SELECT MIN(eventDate) as najstarsza, MAX(eventDate) as najnowsza FROM EventOrder
  `;
  console.log(q1k[0]);

  // === DODATKOWE ZAPYTANIA PROFESJONALNE ===
  console.log("\n=== 1L. Warianty roomName — polskie znaki (Sala Duza vs Duża, Zlota vs Złota) ===");
  const q1l = await prisma.$queryRaw<{ roomName: string; cnt: bigint }[]>`
    SELECT roomName, COUNT(*) as cnt FROM EventOrder
    WHERE roomName LIKE '%Duza%' OR roomName LIKE '%Duz%' OR roomName LIKE '%Zlota%' OR roomName LIKE '%Zlot%'
    GROUP BY roomName
  `;
  console.log(q1l.length ? JSON.stringify(q1l.map((r) => ({ ...r, cnt: Number(r.cnt) })), null, 2) : "Brak wariantów ASCII");

  console.log("\n=== 1M. dateFrom vs eventDate — niespójności (dateFrom<>eventDate lub eventDate NULL) ===");
  const q1m = await prisma.$queryRaw<
    { cnt_EventDateNull: bigint; cnt_dateFromNotNull: bigint; cnt_mismatch: bigint }[]
  >`
    SELECT
      SUM(CASE WHEN eventDate IS NULL THEN 1 ELSE 0 END) as cnt_EventDateNull,
      SUM(CASE WHEN dateFrom IS NOT NULL THEN 1 ELSE 0 END) as cnt_dateFromNotNull,
      SUM(CASE WHEN eventDate IS NOT NULL AND dateFrom IS NOT NULL AND DATE(eventDate) != DATE(dateFrom) THEN 1 ELSE 0 END) as cnt_mismatch
    FROM EventOrder
  `;
  const m = q1m[0];
  console.log({
    eventDate_NULL: Number(m?.cnt_EventDateNull ?? 0),
    dateFrom_notNull: Number(m?.cnt_dateFromNotNull ?? 0),
    eventDate_vs_dateFrom_rozne: Number(m?.cnt_mismatch ?? 0),
  });

  console.log("\n=== 1N. clientName — puste stringi vs NULL ===");
  const q1n = await prisma.$queryRaw<{ cnt_null: bigint; cnt_empty: bigint; cnt_ok: bigint }[]>`
    SELECT
      SUM(CASE WHEN clientName IS NULL THEN 1 ELSE 0 END) as cnt_null,
      SUM(CASE WHEN clientName = '' THEN 1 ELSE 0 END) as cnt_empty,
      SUM(CASE WHEN clientName IS NOT NULL AND clientName != '' THEN 1 ELSE 0 END) as cnt_ok
    FROM EventOrder
  `;
  const n = q1n[0];
  console.log({ null: Number(n?.cnt_null ?? 0), empty_string: Number(n?.cnt_empty ?? 0), ok: Number(n?.cnt_ok ?? 0) });

  console.log("\n=== 1O. googleCalendarEvents (multi-room) — ile ma strukturę JSON != null ===");
  const q1o = await prisma.$queryRaw<{ has_events_json: bigint; total: bigint }[]>`
    SELECT
      SUM(CASE WHEN googleCalendarEvents IS NOT NULL AND JSON_TYPE(googleCalendarEvents) = 'ARRAY' THEN 1 ELSE 0 END) as has_events_json,
      COUNT(*) as total
    FROM EventOrder
  `;
  const o = q1o[0];
  console.log({ multi_room_events: Number(o?.has_events_json ?? 0), total: Number(o?.total ?? 0) });

  console.log("\n=== 1P-BIS. Kolizje po dateFrom (status != CANCELLED) — top 10 dni ===");
  const q1pbis = await prisma.$queryRaw<{ dateFrom: Date; cnt: bigint }[]>`
    SELECT dateFrom, COUNT(*) as cnt FROM EventOrder
    WHERE status != 'CANCELLED'
    GROUP BY dateFrom ORDER BY cnt DESC LIMIT 10
  `;
  console.log(q1pbis.map((r) => ({ date: r.dateFrom?.toISOString?.()?.slice(0, 10), cnt: Number(r.cnt) })));

  console.log("\n=== 1P. Wszystkie unikalne roomName (pełna lista) ===");
  const q1p = await prisma.$queryRaw<{ roomName: string | null; cnt: bigint }[]>`
    SELECT roomName, COUNT(*) as cnt FROM EventOrder GROUP BY roomName ORDER BY roomName
  `;
  console.log(q1p.map((r) => `${r.roomName ?? "(NULL)"}: ${r.cnt}`).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
