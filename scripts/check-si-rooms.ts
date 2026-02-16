import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const rooms = await prisma.room.findMany({
    where: { number: { startsWith: "SI" } },
    select: { id: true, number: true },
    orderBy: { number: "asc" },
  });
  rooms.forEach(r => console.log(`"${r.number}"`));
  await prisma.$disconnect();
}

main();
