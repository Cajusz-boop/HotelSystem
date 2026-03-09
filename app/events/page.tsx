import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata = { title: "Imprezy", description: "Moduł imprez" };

const EVENT_TYPE_LABELS: Record<string, string> = {
  WESELE: "Wesele",
  KOMUNIA: "Komunia",
  CHRZCINY: "Chrzciny",
  URODZINY: "Urodziny",
  STYPA: "Stypa",
  FIRMOWA: "Firmowa",
  SYLWESTER: "Sylwester",
  INNE: "Inne",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Szkic",
  CONFIRMED: "Potwierdzone",
  DONE: "Wykonane",
  CANCELLED: "Anulowane",
};

export default async function EventsPage() {
  const events = await prisma.eventOrder.findMany({
    where: { status: { not: "CANCELLED" } },
    orderBy: { dateFrom: "desc" },
    take: 200,
    select: {
      id: true,
      eventType: true,
      clientName: true,
      eventDate: true,
      dateFrom: true,
      dateTo: true,
      guestCount: true,
      status: true,
      roomName: true,
      parentEventId: true,
      isPoprawiny: true,
      depositAmount: true,
      depositPaid: true,
    },
  });

  const parentIds = events.filter((e) => !e.isPoprawiny && e.eventType === "WESELE").map((e) => e.id);
  const children = parentIds.length > 0
    ? await prisma.eventOrder.findMany({
        where: { parentEventId: { in: parentIds }, isPoprawiny: true },
        select: { parentEventId: true },
      })
    : [];
  const poprawinyByParent = new Set((children.map((c) => c.parentEventId).filter(Boolean)) as string[]);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2 text-sm text-muted-foreground">
          <Link href="/mice" className="hover:text-foreground">
            MICE
          </Link>
          <span>/</span>
          <span>Imprezy</span>
        </div>
        <Link
          href="/events/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 h-12 text-base font-medium min-w-[140px]"
        >
          Nowa impreza
        </Link>
      </div>
      <h1 className="text-2xl font-semibold mb-6">Imprezy</h1>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Data</th>
              <th className="px-4 py-3 text-left font-medium">Typ</th>
              <th className="px-4 py-3 text-left font-medium">Klient</th>
              <th className="px-4 py-3 text-left font-medium">Sala</th>
              <th className="px-4 py-3 text-left font-medium">Goście</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Brak imprez. Utwórz nową imprezę.
                </td>
              </tr>
            ) : (
              events.map((e) => {
                const depAmt = e.depositAmount != null ? (typeof e.depositAmount === "object" && "toNumber" in e.depositAmount ? (e.depositAmount as { toNumber: () => number }).toNumber() : Number(e.depositAmount)) : null;
                const hasPoprawinyChild = e.eventType === "WESELE" && !e.isPoprawiny ? poprawinyByParent.has(e.id) : false;
                return (
                <tr key={e.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {e.eventDate
                      ? new Date(e.eventDate).toLocaleDateString("pl-PL")
                      : new Date(e.dateFrom).toLocaleDateString("pl-PL")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      {e.isPoprawiny && <span title="Poprawiny">🔄</span>}
                      {hasPoprawinyChild && <span title="Ma poprawiny">🔄</span>}
                      {EVENT_TYPE_LABELS[e.eventType ?? ""] ?? e.eventType}
                    </span>
                  </td>
                  <td className="px-4 py-3">{e.clientName ?? "—"}</td>
                  <td className="px-4 py-3">{e.roomName ?? "—"}</td>
                  <td className="px-4 py-3">{e.guestCount ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div>
                      <span
                        className={
                          e.status === "CANCELLED"
                            ? "text-destructive"
                            : e.status === "CONFIRMED"
                              ? "text-green-600"
                              : ""
                        }
                      >
                        {STATUS_LABELS[e.status ?? ""] ?? e.status}
                      </span>
                      {depAmt != null && (
                        <span className="block text-xs text-muted-foreground">
                          Zadatek: {depAmt} zł {e.depositPaid ? "✅" : "❌"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/events/${e.id}`}
                      className="text-primary hover:underline"
                    >
                      Szczegóły
                    </Link>
                    {" · "}
                    <Link
                      href={`/events/${e.id}/edit`}
                      className="text-primary hover:underline"
                    >
                      Edytuj
                    </Link>
                  </td>
                </tr>
              );})
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
