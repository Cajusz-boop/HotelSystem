import { BookingForm } from "./booking-form";

export const metadata = {
  title: "Rezerwacja online",
  description: "Booking Engine – sprawdź dostępność i zarezerwuj pokój",
};

export default function BookingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center p-6 bg-muted/30">
      <div className="w-full max-w-lg mb-6 text-center">
        <h1 className="text-2xl font-semibold">Rezerwacja online</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sprawdź dostępność i zarezerwuj pokój
        </p>
      </div>
      <BookingForm />
    </div>
  );
}
