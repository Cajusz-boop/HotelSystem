import "dotenv/config";
import "@/lib/env";
import { prisma } from "@/lib/db";

async function main() {
  const last = await prisma.eventOrder.findFirst({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      clientName: true,
      eventDate: true,
      createdAt: true,
      googleCalendarEventId: true,
      googleCalendarCalId: true,
      googleCalendarSynced: true,
      googleCalendarError: true,
      googleCalendarSyncedAt: true,
    },
  });
  console.log(JSON.stringify(last, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
