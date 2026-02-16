/**
 * Jednorazowy skrypt do wyczyszczenia numerów pokoi w bazie.
 *
 * Uruchomienie:  npx tsx scripts/cleanup-room-numbers.ts
 *
 * Co robi:
 *  - Usuwa prefiksy literowe (np. "SI 020" → "20")
 *  - Usuwa wiodące zera (np. "07" → "7")
 *  - Jeśli docelowy numer już istnieje, przenosi rezerwacje/bloki i usuwa duplikat
 */

import "dotenv/config";
import { prisma } from "../lib/db";

function cleanRoomNumber(num: string): string {
  let clean = num.replace(/^[A-Za-z\u0104-\u017B\u0105-\u017C]+\s+/, "");
  clean = clean.replace(/^0+(?=\d)/, "");
  return clean.trim() || num;
}

async function main() {
  const allRooms = await prisma.room.findMany({
    select: { id: true, number: true },
    orderBy: { number: "asc" },
  });

  console.log(`Znaleziono ${allRooms.length} pokoi\n`);

  let renamed = 0;
  let merged = 0;
  let unchanged = 0;

  for (const room of allRooms) {
    const cleanNumber = cleanRoomNumber(room.number);

    if (cleanNumber === room.number) {
      unchanged++;
      continue;
    }

    const existing = await prisma.room.findUnique({
      where: { number: cleanNumber },
      select: { id: true },
    });

    if (!existing) {
      await prisma.room.update({
        where: { id: room.id },
        data: { number: cleanNumber },
      });
      console.log(`  Zmieniono: "${room.number}" → "${cleanNumber}"`);
      renamed++;
    } else if (existing.id !== room.id) {
      const movedRes = await prisma.reservation.updateMany({
        where: { roomId: room.id },
        data: { roomId: existing.id },
      });
      const movedBlocks = await prisma.roomBlock.updateMany({
        where: { roomId: room.id },
        data: { roomId: existing.id },
      });
      try { await prisma.cleaningSchedule.updateMany({ where: { roomId: room.id }, data: { roomId: existing.id } }); } catch {}
      try { await prisma.maintenanceIssue.updateMany({ where: { roomId: room.id }, data: { roomId: existing.id } }); } catch {}
      try { await prisma.roomGroupRoom.deleteMany({ where: { roomId: room.id } }); } catch {}

      await prisma.room.delete({ where: { id: room.id } });
      console.log(`  Scalono: "${room.number}" → "${cleanNumber}" (${movedRes.count} rez., ${movedBlocks.count} bloków)`);
      merged++;
    }
  }

  console.log(`\n--- Podsumowanie ---`);
  console.log(`  Zmieniono nazwy: ${renamed}`);
  console.log(`  Scalono duplikaty: ${merged}`);
  console.log(`  Bez zmian: ${unchanged}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Błąd:", e);
  process.exit(1);
});
