import { prisma } from "../lib/db";

async function main() {
  const all = await prisma.property.findMany({
    select: { id: true, code: true, statusCombinationColors: true },
  });
  console.log(JSON.stringify(all, null, 2));
}

main()
  .finally(() => prisma.$disconnect());
