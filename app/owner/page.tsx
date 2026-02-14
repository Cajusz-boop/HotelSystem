import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getPropertiesForOwner,
  getOccupancyForProperty,
} from "@/app/actions/properties";
import Link from "next/link";
import { OwnerRevenueSection } from "./owner-revenue-section";
import { OwnerReservationForm } from "./owner-reservation-form";
import { OwnerSettlementsSection } from "./owner-settlements-section";

export const metadata = {
  title: "Portal Właściciela",
  description: "Obłożenie i rozliczenia",
};

export default async function OwnerPortalPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const propsResult = await getPropertiesForOwner(session.userId);
  const properties = propsResult.success && propsResult.data ? propsResult.data : [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Portal Właściciela</h1>
        <span className="text-sm text-muted-foreground">
          Zalogowany: {session.name}
        </span>
      </div>
      {properties.length === 0 ? (
        <p className="text-muted-foreground">
          Brak obiektów przypisanych do Twojego konta. Poproś administratora o przypisanie obiektu (Property.ownerId).
        </p>
      ) : (
        <>
          <OwnerRevenueSection properties={properties} />

          <OwnerReservationForm properties={properties} />
          <div className="mb-8">
            <Link href="/front-office" className="text-sm text-primary hover:underline">
              Grafik rezerwacji →
            </Link>
          </div>

          <OwnerSettlementsSection ownerId={session.userId} />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {properties.map(async (prop) => {
              const occResult = await getOccupancyForProperty(prop.id);
              const occ = occResult.success && occResult.data ? occResult.data : null;
              return (
                <div
                  key={prop.id}
                  className="rounded-lg border bg-card p-6 shadow-sm"
                >
                  <h2 className="font-semibold text-lg mb-2">{prop.name}</h2>
                  <p className="text-sm text-muted-foreground mb-4">{prop.code}</p>
                  {occ && (
                    <div className="space-y-1 text-sm">
                      <p>Pokoi: {occ.totalRooms}</p>
                      <p>Zajęte dziś: <strong>{occ.occupiedToday}</strong></p>
                      <p>Obłożenie: <strong>{occ.occupancyPercent}%</strong></p>
                    </div>
                  )}
                  <Link
                    href="/"
                    className="mt-4 inline-block text-sm text-primary hover:underline"
                  >
                    Przejdź do panelu
                  </Link>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
