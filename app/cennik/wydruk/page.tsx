import { getRoomsForCennik, getCennikForDate } from "@/app/actions/rooms";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CennikPrintButton } from "@/components/cennik-print-button";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = { date?: string };

export default async function CennikWydrukPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(searchParams);
  const dateParam = typeof params.date === "string" ? params.date.trim() : undefined;
  const result = dateParam
    ? await getCennikForDate(dateParam)
    : await getRoomsForCennik();
  if (!result.success || !result.data) {
    return (
      <div className="p-8">
        <p className="text-destructive">Błąd ładowania cennika.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/cennik">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót do cennika
          </Link>
        </Button>
      </div>
    );
  }

  const rooms = result.data;
  const year = new Date().getFullYear();
  const title = dateParam ? `Cennik na dzień ${dateParam}` : "Cennik pokoi";
  const subtitle = dateParam
    ? `Ceny za dobę na dzień ${dateParam}. Tylko do wglądu.`
    : `Ceny za dobę (PLN). Rok ${year}. Tylko do wglądu.`;

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/cennik">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Powrót do edycji
            </Link>
          </Button>
          <form method="get" action="/cennik/wydruk" className="flex items-center gap-2">
            <label htmlFor="wydruk-date" className="text-sm text-muted-foreground">Cennik na dzień:</label>
            <input
              id="wydruk-date"
              type="date"
              name="date"
              defaultValue={dateParam ?? undefined}
              className="rounded border px-2 py-1.5 text-sm"
            />
            <Button type="submit" variant="secondary" size="sm">Pokaż</Button>
          </form>
          <Button asChild size="sm">
            <Link href="/cennik/wydruk">Bez daty (ceny bazowe)</Link>
          </Button>
        </div>
        <CennikPrintButton />
      </div>

      <div className="cennik-wydruk rounded-lg border bg-white p-6 print:border-0 print:shadow-none">
        <h1 className="mb-1 text-xl font-semibold">{title}</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {subtitle}
        </p>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 font-medium">Nr pokoju</th>
              <th className="px-4 py-2 font-medium">Typ</th>
              <th className="px-4 py-2 font-medium">Cena (PLN / dobę)</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{r.number}</td>
                <td className="px-4 py-2">{r.type}</td>
                <td className="px-4 py-2">
                  {r.price != null ? `${Number(r.price).toFixed(2)} PLN` : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground print:block">
        Dokument wygenerowany z systemu Hotel PMS. Nie stanowi oferty handlowej.
      </p>
    </div>
  );
}
