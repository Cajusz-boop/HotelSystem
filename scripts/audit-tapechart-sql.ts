#!/usr/bin/env npx tsx
/**
 * AUDYT TapeChart – zapytania SQL do porównania z wyświetlaniem w UI.
 * Uruchom: npx tsx scripts/audit-tapechart-sql.ts
 */
import "dotenv/config";
import { prisma } from "../lib/db";

type Row = Record<string, unknown>;

async function main() {
  console.log("=== AUDYT TapeChart – zapytania SQL ===\n");

  // TEST 1: Rezerwacje w zakresie 2026-03-01 do 2026-03-14
  const q1 = await prisma.$queryRaw<Row[]>`
    SELECT r.id, r.checkIn, r.checkOut, r.status, rm.number as roomNumber, g.name as guestName
    FROM Reservation r
    JOIN Room rm ON r.roomId = rm.id
    JOIN Guest g ON r.guestId = g.id
    WHERE r.status NOT IN ('CANCELLED', 'NO_SHOW')
    AND r.checkOut >= '2026-03-01'
    AND r.checkIn <= '2026-03-14'
    ORDER BY rm.number, r.checkIn
  `;
  console.log("TEST 1: Rezerwacje 2026-03-01 .. 2026-03-14");
  console.log("Liczba rezerwacji z bazy:", q1.length);
  q1.forEach((r) => console.log(`  ${r.id} | ${r.roomNumber} | ${r.checkIn} - ${r.checkOut} | ${r.status} | ${r.guestName}`));
  console.log("");

  // TEST 4a: Rezerwacje zaczynające się PRZED widocznym zakresem
  const q4a = await prisma.$queryRaw<Row[]>`
    SELECT id, checkIn, checkOut, status, roomId
    FROM Reservation
    WHERE checkIn < '2026-03-01' AND checkOut > '2026-03-01'
    AND status NOT IN ('CANCELLED', 'NO_SHOW')
  `;
  console.log("TEST 4a: Rezerwacje zaczynające się PRZED 2026-03-01 (clamp lewa):");
  console.log("Liczba:", q4a.length);
  q4a.forEach((r) => console.log(`  ${r.id} | checkIn=${r.checkIn} checkOut=${r.checkOut} roomId=${r.roomId}`));
  console.log("");

  // TEST 4b: Rezerwacje kończące się PO widocznym zakresie
  const q4b = await prisma.$queryRaw<Row[]>`
    SELECT id, checkIn, checkOut, status, roomId
    FROM Reservation
    WHERE checkOut > '2026-03-14' AND checkIn < '2026-03-14'
    AND status NOT IN ('CANCELLED', 'NO_SHOW')
  `;
  console.log("TEST 4b: Rezerwacje kończące się PO 2026-03-14 (clamp prawa):");
  console.log("Liczba:", q4b.length);
  q4b.forEach((r) => console.log(`  ${r.id} | checkIn=${r.checkIn} checkOut=${r.checkOut} roomId=${r.roomId}`));
  console.log("");

  // TEST 4c: Rezerwacje jednodniowe (1 noc)
  const q4c = await prisma.$queryRaw<Row[]>`
    SELECT id, checkIn, checkOut, roomId
    FROM Reservation
    WHERE DATEDIFF(checkOut, checkIn) = 1
    AND checkIn >= '2026-03-01' AND checkOut <= '2026-03-14'
    AND status NOT IN ('CANCELLED', 'NO_SHOW')
  `;
  console.log("TEST 4c: Rezerwacje jednodniowe (1 noc):");
  console.log("Liczba:", q4c.length);
  q4c.forEach((r) => console.log(`  ${r.id} | ${r.checkIn} - ${r.checkOut} roomId=${r.roomId}`));
  console.log("");

  // TEST 7: Status PENDING
  const q7 = await prisma.$queryRaw<Row[]>`
    SELECT id, status FROM Reservation
    WHERE status = 'PENDING' AND checkOut >= '2026-03-01'
  `;
  console.log("TEST 7: Rezerwacje PENDING:");
  console.log("Liczba:", q7.length);
  q7.forEach((r) => console.log(`  ${r.id} | ${r.status}`));
  console.log("");

  // TEST 8: Duplikaty / nakładające się rezerwacje
  const q8 = await prisma.$queryRaw<Row[]>`
    SELECT r1.id as id1, r2.id as id2, r1.roomId, rm.number,
           r1.checkIn as checkIn1, r1.checkOut as checkOut1,
           r2.checkIn as checkIn2, r2.checkOut as checkOut2
    FROM Reservation r1
    JOIN Reservation r2 ON r1.roomId = r2.roomId AND r1.id < r2.id
    JOIN Room rm ON r1.roomId = rm.id
    WHERE r1.status NOT IN ('CANCELLED', 'NO_SHOW')
    AND r2.status NOT IN ('CANCELLED', 'NO_SHOW')
    AND r1.checkIn < r2.checkOut AND r2.checkIn < r1.checkOut
    ORDER BY rm.number
  `;
  console.log("TEST 8: Nakładające się rezerwacje (ten sam pokój):");
  console.log("Liczba par:", q8.length);
  q8.forEach((r) => console.log(`  ${r.id1} vs ${r.id2} | room ${r.number} | ${r.checkIn1}..${r.checkOut1} vs ${r.checkIn2}..${r.checkOut2}`));
  console.log("");

  // TEST 9: Pokoje
  const q9 = await prisma.$queryRaw<Row[]>`SELECT number FROM Room ORDER BY number`;
  console.log("TEST 9: Wszystkie pokoje z bazy:");
  console.log("Liczba:", q9.length);
  console.log("Numery:", q9.map((r) => r.number).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
