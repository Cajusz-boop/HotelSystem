import { notFound } from "next/navigation";
import { getPaymentLinkByToken } from "@/app/actions/finance";
import { PayForm } from "@/components/pay-form";

export default async function PayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPaymentLinkByToken(token);
  if (!result.success || !result.data) {
    notFound();
  }
  const { amount } = result.data;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-muted/30">
      <PayForm token={token} amount={amount} />
    </div>
  );
}
