import Link from "next/link";
import { GastronomyClient } from "./gastronomy-client";
import { ObciazenieForm } from "./obciazenie-form";
import { UnassignedChargesSection } from "./unassigned-charges";

export const metadata = {
  title: "Moduł gastronomii",
  description: "Restauracja, room service, bankiety",
};

export default function GastronomyPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Moduł gastronomii</h1>
      <p className="text-muted-foreground mb-6">
        Restauracja hotelowa, room service, bankiety – zamówienia, karty dań, rozliczenia.
      </p>
      <UnassignedChargesSection />
      <GastronomyClient />
      <div className="mt-10 pt-6 border-t">
        <ObciazenieForm />
      </div>
      <p className="mt-6 text-sm">
        <Link href="/front-office" className="text-primary hover:underline">
          Powrót do recepcji
        </Link>
      </p>
    </div>
  );
}
