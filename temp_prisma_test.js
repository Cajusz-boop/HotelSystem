const { PrismaClient } = require("./node_modules/@prisma/client");
const { PrismaMariaDb } = require("./node_modules/@prisma/adapter-mariadb");

const url = process.env.DATABASE_URL;
console.log("DATABASE_URL:", url ? url.substring(0, 30) + "..." : "NOT SET");

const adapter = new PrismaMariaDb(url);
const p = new PrismaClient({ adapter });

async function test() {
  try {
    const count = await p.fiscalJob.count({ where: { status: "pending" } });
    console.log("Pending count:", count);
    
    const job = await p.fiscalJob.findFirst({ 
      where: { status: "pending" },
      orderBy: { createdAt: "asc" }
    });
    console.log("Found job:", JSON.stringify(job, null, 2));
  } catch (e) {
    console.log("ERROR:", e.message);
  } finally {
    await p.$disconnect();
  }
}

test();
