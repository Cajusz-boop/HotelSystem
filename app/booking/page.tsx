import { BookingForm } from "./booking-form";

export const metadata = {
  title: "Rezerwacja online",
  description: "Booking Engine – sprawdź dostępność i zarezerwuj pokój",
};

export default function BookingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="bg-slate-800 text-white py-4 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-xl sm:text-2xl font-semibold">Karczma Łabędź — Rezerwacja online</h1>
          <p className="text-slate-300 text-sm mt-0.5">
            Sprawdź dostępność i zarezerwuj pokój
          </p>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center p-4 sm:p-6">
        <BookingForm />
      </main>
    </div>
  );
}
