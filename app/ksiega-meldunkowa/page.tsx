import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEffectivePropertyId } from "@/app/actions/properties";
import { getRoomsForProperty } from "@/app/actions/properties";
import {
  getLogbookData,
  type LogbookResponse,
} from "@/app/actions/dashboard";
import { KsiegaMeldunkowaClient } from "./ksiega-meldunkowa-client";

function firstDayOfMonth( d: Date ): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function lastDayOfMonth( d: Date ): string {
  const d2 = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return d2.toISOString().slice(0, 10);
}

export default async function KsiegaMeldunkowaPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const propertyId = await getEffectivePropertyId();
  const now = new Date();
  const dateFrom = firstDayOfMonth(now);
  const dateTo = lastDayOfMonth(now);

  const emptyRooms: { id: string; number: string; type: string }[] = [];
  const [roomsResult, initialResult] = await Promise.all([
    propertyId ? getRoomsForProperty(propertyId) : Promise.resolve({ success: true, data: emptyRooms }),
    getLogbookData({
      propertyId,
      mode: "all",
      dateFrom,
      dateTo,
      sortBy: "checkIn",
      sortDir: "desc",
      page: 1,
      pageSize: 25,
    }),
  ]);

  const rooms = roomsResult.success && roomsResult.data ? roomsResult.data : [];
  const roomTypes = Array.from(new Set(rooms.map((r) => r.type)))
    .sort()
    .map((name) => ({ id: name, name }));

  let initialData: LogbookResponse = {
    data: [],
    total: 0,
    summary: { arrivals: 0, departures: 0, inhouse: 0, noshow: 0, cancelled: 0 },
  };

  if (initialResult && "data" in initialResult && "total" in initialResult) {
    initialData = initialResult as LogbookResponse;
  }

  return (
    <KsiegaMeldunkowaClient
      initialData={initialData}
      rooms={rooms}
      roomTypes={roomTypes}
      propertyId={propertyId}
      defaultDateFrom={dateFrom}
      defaultDateTo={dateTo}
    />
  );
}
