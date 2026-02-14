import Link from "next/link";
import { ChannelManagerSync } from "./channel-manager-sync";

export const metadata = {
  title: "Channel Manager",
  description: "Synchronizacja z Booking.com, Airbnb, Expedia",
};

const CHANNELS = [
  {
    id: "booking_com" as const,
    name: "Booking.com",
    description: "B.XML availability – dostępność i ceny (BOOKING_COM_*).",
  },
  {
    id: "airbnb" as const,
    name: "Airbnb",
    description: "Homes API – kalendarz (AIRBNB_API_KEY, AIRBNB_LISTING_ID).",
  },
  {
    id: "expedia" as const,
    name: "Expedia",
    description: "EQC AR – dostępność i stawki (EXPEDIA_*, EXPEDIA_PROPERTY_ID).",
  },
  {
    id: "amadeus" as const,
    name: "Amadeus (GDS)",
    description: "Global Distribution System – wymaga certyfikacji i GDS_AMADEUS_URL.",
  },
  {
    id: "sabre" as const,
    name: "Sabre (GDS)",
    description: "Global Distribution System – wymaga certyfikacji i GDS_SABRE_URL.",
  },
  {
    id: "travelport" as const,
    name: "Travelport (GDS)",
    description: "Global Distribution System – wymaga certyfikacji i GDS_TRAVELPORT_URL.",
  },
];

export default function ChannelManagerPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Channel Manager</h1>
      <p className="text-muted-foreground mb-6">
        Synchronizacja dostępności i cen z kanałami dystrybucji. API dostępności: GET
        /api/v1/external/availability
      </p>
      <ChannelManagerSync />
      <div className="grid gap-4 md:grid-cols-3 mt-6">
        {CHANNELS.map((ch) => (
          <div
            key={ch.id}
            className="rounded-lg border bg-card p-6 shadow-sm"
          >
            <h2 className="font-semibold text-lg">{ch.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{ch.description}</p>
          </div>
        ))}
      </div>
      <Link
        href="/front-office"
        className="mt-6 inline-block text-sm text-primary hover:underline"
      >
        Powrót do recepcji
      </Link>
    </div>
  );
}
