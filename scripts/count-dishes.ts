import "dotenv/config";
import { prisma } from "../lib/db";
async function main() {
  const c = await prisma.dish.count();
  console.log("Dish count:", c);
}
main().then(() => prisma.$disconnect());
