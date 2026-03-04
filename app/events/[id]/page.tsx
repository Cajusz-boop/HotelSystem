import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CancelEventButton } from "./cancel-button";

export const metadata = { title: "Szczegóły imprezy", description: "Impreza" };

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

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await prisma.eventOrder.findUnique({
    where: { id },
  });

  if (!event) notFound();

  const fmtDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("pl-PL") : "—";

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2 text-sm text-muted-foreground">
          <Link href="/mice" className="hover:text-foreground">
            MICE
          </Link>
          <span>/</span>
          <Link href="/events" className="hover:text-foreground">
            Imprezy
          </Link>
          <span>/</span>
          <span>{event.clientName ?? event.name}</span>
        </div>
        <div className="flex gap-2">
          {event.checklistDocUrl && (
            <a
              href={event.checklistDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border px-4 py-2 h-12 text-base hover:bg-muted"
            >
              Otwórz checklist
            </a>
          )}
          {event.menuDocUrl && (
            <a
              href={event.menuDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border px-4 py-2 h-12 text-base hover:bg-muted"
            >
              Otwórz ofertę menu
            </a>
          )}
          {event.googleCalendarEventId && process.env.GOOGLE_CALENDAR_ID && (
            <a
              href={`https://www.google.com/calendar/event?eid=${Buffer.from(
                (process.env.GOOGLE_CALENDAR_ID.endsWith("group.calendar.google.com")
                  ? process.env.GOOGLE_CALENDAR_ID.replace("@group.calendar.google.com", "@g")
                  : process.env.GOOGLE_CALENDAR_ID.replace("@gmail.com", "@g")) +
                  " " +
                  (event.googleCalendarEventId.endsWith("@google.com")
                    ? event.googleCalendarEventId.replace("@google.com", "")
                    : event.googleCalendarEventId)
              ).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border px-4 py-2 h-12 text-base hover:bg-muted"
            >
              Otwórz w Google Calendar
            </a>
          )}
          <Link
            href={`/events/${id}/edit`}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground h-12 text-base flex items-center"
          >
            Edytuj imprezę
          </Link>
          {event.status !== "CANCELLED" && (
            <CancelEventButton eventId={id} />
          )}
        </div>
      </div>

      <h1 className="text-2xl font-semibold mb-6">
        {event.clientName ?? event.name}
      </h1>

      <div className="space-y-4 rounded-lg border p-6 text-base">
        <p>
          <strong>Typ:</strong> {EVENT_TYPE_LABELS[event.eventType ?? ""] ?? event.eventType}
        </p>
        <p>
          <strong>Status:</strong>{" "}
          <span
            className={
              event.status === "CANCELLED"
                ? "text-destructive"
                : event.status === "CONFIRMED"
                  ? "text-green-600"
                  : ""
            }
          >
            {STATUS_LABELS[event.status ?? ""] ?? event.status}
          </span>
        </p>
        <p>
          <strong>Klient:</strong> {event.clientName ?? "—"}
        </p>
        <p>
          <strong>Telefon:</strong> {event.clientPhone ?? "—"}
        </p>
        <p>
          <strong>Data:</strong> {fmtDate(event.eventDate)}
        </p>
        <p>
          <strong>Godziny:</strong> {event.timeStart ?? "—"} – {event.timeEnd ?? "—"}
        </p>
        <p>
          <strong>Sala:</strong> {event.roomName ?? "—"}
        </p>
        <p>
          <strong>Goście:</strong> {event.guestCount ?? "—"} (dorośli: {event.adultsCount ?? "—"}, dzieci 0-3:{" "}
          {event.children03 ?? "—"}, dzieci 4-7: {event.children47 ?? "—"})
        </p>
        {event.eventType === "WESELE" && (
          <>
            <p>
              <strong>Godzina kościoła:</strong> {event.churchTime ?? "—"}
            </p>
            <p>
              <strong>Stół Pary Młodej:</strong> {event.brideGroomTable ?? "—"}
            </p>
            <p>
              <strong>Stół orkiestry:</strong> {event.orchestraTable ?? "—"}
            </p>
          </>
        )}
        <p>
          <strong>Torty i desery:</strong> {event.cakesAndDesserts ?? "—"}
        </p>
        <p>
          <strong>Specjalne życzenia:</strong> {event.specialRequests ?? "—"}
        </p>
        {event.afterpartyEnabled && (
          <>
            <p>
              <strong>Afterparty:</strong> {event.afterpartyTimeFrom ?? "—"} –{" "}
              {event.afterpartyTimeTo ?? "—"}, {event.afterpartyGuests ?? "—"} gości
            </p>
            <p>
              <strong>Afterparty – menu:</strong> {event.afterpartyMenu ?? "—"}
            </p>
            <p>
              <strong>Afterparty – muzyka:</strong> {event.afterpartyMusic ?? "—"}
            </p>
          </>
        )}
        {event.notes && (
          <p>
            <strong>Uwagi:</strong> {event.notes}
          </p>
        )}
      </div>
    </div>
  );
}
