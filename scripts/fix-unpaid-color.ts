import { prisma } from "../lib/db";

async function run() {
  const p = await prisma.property.findFirst({
    orderBy: { code: "asc" },
    select: { id: true, code: true, paymentStatusColors: true },
  });
  if (!p) {
    console.log("Brak Property");
    return;
  }
  console.log("Property:", p.code, "id:", p.id);
  console.log("paymentStatusColors (aktualnie):", JSON.stringify(p.paymentStatusColors, null, 2));

  const raw = p.paymentStatusColors;
  const obj = raw && typeof raw === "object" ? { ...(raw as Record<string, string>) } : {};
  obj.UNPAID = "rgb(139 92 246)";

  await prisma.property.update({
    where: { id: p.id },
    data: { paymentStatusColors: obj },
  });

  const after = await prisma.property.findUnique({
    where: { id: p.id },
    select: { paymentStatusColors: true },
  });
  console.log("paymentStatusColors (po aktualizacji):", JSON.stringify(after?.paymentStatusColors, null, 2));
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
