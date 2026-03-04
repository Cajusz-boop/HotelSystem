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
    orderBy: { dateFrom: "desc" },
    take: 200,
  });

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
              events.map((e) => (
                <tr key={e.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {e.eventDate
                      ? new Date(e.eventDate).toLocaleDateString("pl-PL")
                      : new Date(e.dateFrom).toLocaleDateString("pl-PL")}
                  </td>
                  <td className="px-4 py-3">
                    {EVENT_TYPE_LABELS[e.eventType ?? ""] ?? e.eventType}
                  </td>
                  <td className="px-4 py-3">{e.clientName ?? "—"}</td>
                  <td className="px-4 py-3">{e.roomName ?? "—"}</td>
                  <td className="px-4 py-3">{e.guestCount ?? "—"}</td>
                  <td className="px-4 py-3">
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
