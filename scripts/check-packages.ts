import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const count = await prisma.menuPackage.count();
  const list = await prisma.menuPackage.findMany({
    select: { id: true, name: true, code: true },
    take: 20,
  });
  console.log("MenuPackage count:", count);
  console.log(JSON.stringify(list, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
