import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const rooms = await prisma.room.findMany({
    where: { number: { startsWith: "SI " } },
    select: { id: true, number: true },
    orderBy: { number: "asc" },
  });

  for (const room of rooms) {
    const newNumber = room.number.replace("SI ", "SI");
    await prisma.room.update({ where: { id: room.id }, data: { number: newNumber } });
    console.log(`  "${room.number}" → "${newNumber}"`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
