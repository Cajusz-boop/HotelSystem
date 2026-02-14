import { notFound } from "next/navigation";
import { getWebCheckInByToken } from "@/app/actions/web-check-in";
import { WebCheckInSignature } from "@/components/web-check-in-signature";

export default async function WebCheckInGuestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getWebCheckInByToken(token);
  if (!result.success || !result.data) {
    notFound();
  }
  const { guestName, checkIn, checkOut, roomNumber } = result.data;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-muted/30">
      <WebCheckInSignature
        token={token}
        guestName={guestName}
        checkIn={checkIn}
        checkOut={checkOut}
        roomNumber={roomNumber}
      />
    </div>
  );
}
