import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calendar, Sparkles, Trash2, AlertTriangle } from "lucide-react";
import { getDashboardData } from "@/app/actions/dashboard";

export const dynamic = "force-dynamic";

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function HomePage() {
  const data = await getDashboardData();
  const todayStr = toDateOnly(new Date());

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Panel</h1>
          <p className="text-sm text-muted-foreground">Dane na dzień {todayStr}</p>
        </div>
        <Button asChild>
          <Link href="/front-office">
            <Calendar className="mr-2 h-4 w-4" />
            Otwórz grafik
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* VIP Arrival – przyjazdy dzisiaj/jutro */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5" />
            Przyjazdy VIP (dzisiaj / jutro)
          </h2>
          {data.vipArrivals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak przyjazdów.</p>
          ) : (
            <ul className="space-y-2">
              {data.vipArrivals.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{a.guestName}</span>
                  <span className="text-muted-foreground">
                    Pokój {a.room} · {a.checkIn}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Pokoje do sprzątania */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Trash2 className="h-5 w-5" />
            Pokoje do sprzątania
          </h2>
          {data.dirtyRooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak pokoi do sprzątania.</p>
          ) : (
            <ul className="space-y-2">
              {data.dirtyRooms.map((r) => (
                <li
                  key={r.number}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="font-medium">Pokój {r.number}</span>
                  <span className="text-muted-foreground">{r.type}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* OOO – ostatnie zgłoszenia (sortowane wg daty zmiany) */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="h-5 w-5" />
            Wyłączone z użytku (OOO)
          </h2>
          {data.oooRooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak pokoi OOO.</p>
          ) : (
            <ul className="space-y-2">
              {data.oooRooms.map((r) => (
                <li
                  key={r.number}
                  className="flex flex-col gap-0.5 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="font-medium">Pokój {r.number}</span>
                  {r.reason && (
                    <span className="text-muted-foreground">{r.reason}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Zgłoszono: {new Date(r.updatedAt).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Dzisiejsze check-iny */}
      {data.todayCheckIns.length > 0 && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Dzisiejsze meldunki</h2>
          <ul className="space-y-2">
            {data.todayCheckIns.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="font-medium">{a.guestName}</span>
                <span className="text-muted-foreground">Pokój {a.room}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
