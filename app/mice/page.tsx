import Link from "next/link";

export const metadata = { title: "MICE", description: "Konferencje i bankiety" };

export default function MicePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">MICE – Konferencje i bankiety</h1>
      <section className="rounded-lg border bg-card p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">Grafik sal konferencyjnych</h2>
        <p className="text-sm text-muted-foreground mb-4">Sal konferencyjnych – do rozbudowy. Pokoje typu Sala w module Pokoje.</p>
        <Link href="/mice/grafik" className="text-sm text-primary hover:underline">Grafik sal konferencyjnych</Link>
      </section>
      <section className="rounded-lg border bg-card p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">Kosztorysy grupowe</h2>
        <Link href="/mice/kosztorysy" className="text-sm text-primary hover:underline">Lista kosztorysów</Link>
      </section>
      <section className="rounded-lg border bg-card p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">Eventy (wesela, konferencje, bankiety)</h2>
        <Link href="/mice/eventy" className="text-sm text-primary hover:underline">Moduł eventów</Link>
      </section>
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Zlecenia realizacji</h2>
        <Link href="/mice/zlecenia" className="text-sm text-primary hover:underline">Lista zleceń</Link>
      </section>
    </div>
  );
}
