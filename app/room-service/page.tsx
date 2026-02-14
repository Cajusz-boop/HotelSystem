import Link from "next/link";
import { GastronomyClient } from "@/app/gastronomy/gastronomy-client";

export const metadata = {
  title: "Room service – zamówienia do pokoju",
  description: "Zamówienia do pokoju, room service – karta dań, koszyk, obciążenie rachunku",
};

export default function RoomServicePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Room service (zamówienia do pokoju)</h1>
      <p className="text-muted-foreground mb-6">
        Wybierz rezerwację (pokój · gość), dodaj dania z karty, złóż zamówienie – kwota zostanie doliczona do rachunku pokoju.
      </p>
      <GastronomyClient />
      <p className="mt-6 text-sm">
        <Link href="/front-office" className="text-primary hover:underline">
          Powrót do recepcji
        </Link>
      </p>
    </div>
  );
}
