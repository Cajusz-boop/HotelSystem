import Link from "next/link";
import { prisma } from "@/lib/db";
import { KosztorysForm } from "./kosztorys-form";

export const metadata = { title: "Kosztorysy", description: "Oferty grupowe MICE" };

export default async function KosztorysyPage() {
  const quotes = await prisma.groupQuote.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const quotesForForm = quotes.map((q) => ({
    id: q.id,
    name: q.name,
    validUntil: q.validUntil ? q.validUntil.toISOString().slice(0, 10) : null,
    totalAmount: q.totalAmount != null ? Number(q.totalAmount) : null,
    items: q.items as { name: string; quantity: number; unitPrice: number; amount: number }[] | null,
  }));
  return (
    <div className="p-8">
      <div className="mb-6 flex gap-2 text-sm text-muted-foreground">
        <Link href="/mice" className="hover:text-foreground">MICE</Link>
        <span>/</span>
        <span>Kosztorysy</span>
      </div>
      <h1 className="text-2xl font-semibold mb-6">Kosztorysy grupowe</h1>
      <KosztorysForm quotes={quotesForForm} />
    </div>
  );
}
