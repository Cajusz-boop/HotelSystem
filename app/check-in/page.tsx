import { GuestCheckInForm } from "@/components/guest-check-in-form";

export const metadata = {
  title: "Meldunek – Hotel PMS",
  description: "Formularz meldunkowy z polem MRZ i Parse & Forget",
};

export default function CheckInPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Meldunek gościa</h1>
      <GuestCheckInForm />
    </div>
  );
}
