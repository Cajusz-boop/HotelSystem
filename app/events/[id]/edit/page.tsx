import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EventForm } from "@/components/events/event-form";
import type { EventFormData } from "@/components/events/event-form";

export const metadata = { title: "Edytuj imprezę", description: "Edycja imprezy" };

function eventToFormData(e: {
  eventType: string | null;
  clientName: string | null;
  clientPhone: string | null;
  eventDate: Date | null;
  dateFrom: Date;
  timeStart: string | null;
  timeEnd: string | null;
  roomName: string | null;
  depositAmount?: { toNumber?: () => number } | number | null;
  depositPaid?: boolean | null;
  isPoprawiny?: boolean | null;
  guestCount: number | null;
  adultsCount: number | null;
  children03: number | null;
  children47: number | null;
  orchestraCount: number | null;
  cameramanCount: number | null;
  photographerCount: number | null;
  churchTime: string | null;
  brideGroomTable: string | null;
  orchestraTable: string | null;
  packageId: string | null;
  cakesAndDesserts: string | null;
  cakeOrderedAt: string | null;
  cakeArrivalTime: string | null;
  cakeServedAt: string | null;
  drinksArrival: string | null;
  drinksStorage: string | null;
  champagneStorage: string | null;
  firstBottlesBy: string | null;
  alcoholAtTeamTable: boolean | null;
  cakesSwedishTable: boolean | null;
  fruitsSwedishTable: boolean | null;
  ownFlowers: boolean | null;
  ownVases: boolean | null;
  decorationColor: string | null;
  placeCards: boolean | null;
  placeCardsLayout: string | null;
  tableLayout: string | null;
  breadWelcomeBy: string | null;
  extraAttractions: string | null;
  specialRequests: string | null;
  facebookConsent: boolean | null;
  ownNapkins: boolean | null;
  dutyPerson: string | null;
  afterpartyEnabled: boolean | null;
  afterpartyTimeFrom: string | null;
  afterpartyTimeTo: string | null;
  afterpartyGuests: number | null;
  afterpartyMenu: string | null;
  afterpartyMusic: string | null;
}): Partial<EventFormData> {
  const fmtDate = (d: Date | null) =>
    d ? new Date(d).toISOString().slice(0, 10) : "";

  return {
    eventType: e.eventType ?? "INNE",
    clientName: e.clientName ?? "",
    clientPhone: e.clientPhone ?? "",
    eventDate: fmtDate(e.eventDate ?? e.dateFrom),
    dateFrom: fmtDate(e.dateFrom),
    timeStart: e.timeStart ?? "",
    timeEnd: e.timeEnd ?? "",
    roomName: e.roomName ?? "",
    roomNames: e.roomName ? e.roomName.split(/,\s*/).filter(Boolean) : [],
    depositAmount: e.depositAmount != null ? (typeof e.depositAmount === "object" && "toNumber" in e.depositAmount ? (e.depositAmount as { toNumber: () => number }).toNumber() : Number(e.depositAmount)) : "",
    depositPaid: e.depositPaid ?? false,
    isPoprawiny: e.isPoprawiny ?? false,
    guestCount: e.guestCount ?? "",
    adultsCount: e.adultsCount ?? "",
    children03: e.children03 ?? "",
    children47: e.children47 ?? "",
    orchestraCount: e.orchestraCount ?? "",
    cameramanCount: e.cameramanCount ?? "",
    photographerCount: e.photographerCount ?? "",
    churchTime: e.churchTime ?? "",
    brideGroomTable: e.brideGroomTable ?? "",
    orchestraTable: e.orchestraTable ?? "",
    packageId: e.packageId ?? "",
    cakesAndDesserts: e.cakesAndDesserts ?? "",
    cakeOrderedAt: e.cakeOrderedAt ?? "",
    cakeArrivalTime: e.cakeArrivalTime ?? "",
    cakeServedAt: e.cakeServedAt ?? "",
    drinksArrival: e.drinksArrival ?? "",
    drinksStorage: e.drinksStorage ?? "",
    champagneStorage: e.champagneStorage ?? "",
    firstBottlesBy: e.firstBottlesBy ?? "",
    alcoholAtTeamTable: e.alcoholAtTeamTable ?? false,
    cakesSwedishTable: e.cakesSwedishTable ?? false,
    fruitsSwedishTable: e.fruitsSwedishTable ?? false,
    ownFlowers: e.ownFlowers ?? false,
    ownVases: e.ownVases ?? false,
    decorationColor: e.decorationColor ?? "",
    placeCards: e.placeCards ?? false,
    placeCardsLayout: e.placeCardsLayout ?? "",
    tableLayout: e.tableLayout ?? "",
    breadWelcomeBy: e.breadWelcomeBy ?? "",
    extraAttractions: e.extraAttractions ?? "",
    specialRequests: e.specialRequests ?? "",
    facebookConsent: e.facebookConsent ?? false,
    ownNapkins: e.ownNapkins ?? false,
    dutyPerson: e.dutyPerson ?? "",
    afterpartyEnabled: e.afterpartyEnabled ?? false,
    afterpartyTimeFrom: e.afterpartyTimeFrom ?? "",
    afterpartyTimeTo: e.afterpartyTimeTo ?? "",
    afterpartyGuests: e.afterpartyGuests ?? "",
    afterpartyMenu: e.afterpartyMenu ?? "",
    afterpartyMusic: e.afterpartyMusic ?? "",
  };
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [event, packages, staff] = await Promise.all([
    prisma.eventOrder.findUnique({ where: { id } }),
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

  if (!event) notFound();

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
        <Link href={`/events/${id}`} className="hover:text-foreground">
          {event.clientName ?? event.name}
        </Link>
        <span>/</span>
        <span>Edycja</span>
      </div>
      <h1 className="text-2xl font-semibold mb-6">Edytuj imprezę</h1>
      <EventForm
        eventId={id}
        initialData={eventToFormData(event)}
        packages={packages}
        staff={staff}
      />
    </div>
  );
}
