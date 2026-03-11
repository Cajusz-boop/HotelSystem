import { prisma } from "../lib/db";

async function main() {
  const p = await prisma.property.findFirst({
    orderBy: { code: "asc" },
    select: { code: true, paymentStatusColors: true, reservationStatusColors: true },
  });
  if (!p) {
    console.log("Brak Property");
    return;
  }
  console.log("Property:", p.code);
  console.log("paymentStatusColors:", JSON.stringify(p.paymentStatusColors, null, 2));
  console.log("reservationStatusColors:", JSON.stringify(p.reservationStatusColors, null, 2));
}

main()
  .finally(() => prisma.$disconnect());
