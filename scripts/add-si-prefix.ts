import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const siRoomNumbers = Array.from({ length: 12 }, (_, i) => String(20 + i)); // "20" - "31"

  for (const num of siRoomNumbers) {
    const newNumber = `SI ${num}`;
    try {
      await prisma.room.update({
        where: { number: num },
        data: { number: newNumber },
      });
      console.log(`  "${num}" → "${newNumber}"`);
    } catch {
      console.log(`  "${num}" — nie znaleziono, pomijam`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
