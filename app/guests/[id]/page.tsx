import { notFound } from "next/navigation";
import Link from "next/link";
import { getGuestById, getReservationsByGuestId } from "@/app/actions/reservations";
import { GuestCardClient } from "./guest-card-client";

export const metadata = {
  title: "Edycja klienta",
  description: "Karta gościa – dane i historia pobytów",
};

export default async function GuestEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [guestRes, historyRes] = await Promise.all([
    getGuestById(id),
    getReservationsByGuestId(id),
  ]);
  if (!guestRes.success || !guestRes.data) notFound();
  const guest = guestRes.data;
  const history = historyRes.success && historyRes.data ? historyRes.data : [];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/front-office" className="hover:text-foreground">Recepcja</Link>
        <span>/</span>
        <span>Edycja klienta</span>
      </div>
      <h1 className="text-2xl font-semibold mb-6">Karta gościa – {guest.name}</h1>
      <GuestCardClient guest={guest} history={history} />
    </div>
  );
}
