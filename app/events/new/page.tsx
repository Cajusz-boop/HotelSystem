import Link from "next/link";
import { prisma } from "@/lib/db";
import { EventForm } from "@/components/events/event-form";

export const metadata = { title: "Nowa impreza", description: "Dodaj imprezę" };

export default async function NewEventPage() {
  const [packages, staff] = await Promise.all([
    prisma.package.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6 flex gap-2 text-sm text-muted-foreground">
        <Link href="/mice" className="hover:text-foreground">
          MICE
        </Link>
        <span>/</span>
        <Link href="/events" className="hover:text-foreground">
          Imprezy
        </Link>
        <span>/</span>
        <span>Nowa impreza</span>
      </div>
      <h1 className="text-2xl font-semibold mb-6">Nowa impreza</h1>
      <EventForm
        packages={packages}
        staff={staff}
      />
    </div>
  );
}
