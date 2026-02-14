import Link from "next/link";
import { prisma } from "@/lib/db";
import { RentalBookingForm } from "./rental-booking-form";

export const metadata = {
  title: "Wypożyczalnia",
  description: "Sprzęt do wypożyczenia – rowery, narty",
};

export default async function RentalsPage() {
  const items = await prisma.rentalItem.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, quantity: true, unit: true },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Wypożyczalnia</h1>
      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 shadow-sm max-w-xl">
          <p className="text-muted-foreground mb-4">
            Brak pozycji w wypożyczalni. Dodaj sprzęt (RentalItem) w bazie – model: nazwa, cena za dobę, ilość.
          </p>
          <Link href="/front-office" className="text-sm text-primary hover:underline">
            Powrót do recepcji →
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-2 max-w-xl">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex justify-between items-center rounded border px-4 py-3 text-sm"
              >
                <span className="font-medium">{item.name}</span>
                <span>{item.quantity} {item.unit}</span>
              </li>
            ))}
          </ul>
          <RentalBookingForm items={items} />
        </>
      )}
    </div>
  );
}
