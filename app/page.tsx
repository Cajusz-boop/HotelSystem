import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calendar, Sparkles, Trash2, AlertTriangle, BarChart3 } from "lucide-react";
import { getDashboardData, getKpiReport, getOccupancyReport, getRevParReport } from "@/app/actions/dashboard";
import { Dashboard } from "@/components/Dashboard";
import { DashboardCharts } from "@/components/DashboardCharts";
import { CheckInReminderNotification } from "@/components/check-in-reminder-notification";

export const dynamic = "force-dynamic";

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function HomePage() {
  const today = new Date();
  const todayStr = toDateOnly(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toDateOnly(yesterday);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = toDateOnly(weekAgo);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromStr = toDateOnly(thirtyDaysAgo);

  const [data, kpiResult, occResult, revParResult, kpiToday, kpiYesterday, kpiWeekAgo] = await Promise.all([
    getDashboardData(),
    getKpiReport(fromStr, todayStr),
    getOccupancyReport(fromStr, todayStr),
    getRevParReport(fromStr, todayStr),
    getKpiReport(todayStr, todayStr),
    getKpiReport(yesterdayStr, yesterdayStr),
    getKpiReport(weekAgoStr, weekAgoStr),
  ]);
  const kpi = kpiResult.success ? kpiResult.data : null;
  const occupancyReport = occResult.success ? occResult.data : null;
  const revParReport = revParResult.success ? revParResult.data : null;
  const todayKpi = kpiToday.success ? kpiToday.data : null;
  const yesterdayKpi = kpiYesterday.success ? kpiYesterday.data : null;
  const weekAgoKpi = kpiWeekAgo.success ? kpiWeekAgo.data : null;

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Centrum Dowodzenia</h1>
          <p className="text-sm text-muted-foreground">Główna nawigacja · Dane na dzień {todayStr}</p>
        </div>
        <Button asChild>
          <Link href="/front-office">
            <Calendar className="mr-2 h-4 w-4" />
            Otwórz grafik
          </Link>
        </Button>
      </div>

      <CheckInReminderNotification count={data.todayCheckIns.length} />

      {/* Dashboard nawigacyjny: wyszukiwarka + mapa drogowa gościa + kafelki */}
      <Dashboard />

      {/* Porównanie: dziś vs wczoraj vs tydzień temu */}
      {(todayKpi || yesterdayKpi || weekAgoKpi) && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Porównanie: dziś vs wczoraj vs tydzień temu</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium text-muted-foreground">Dziś ({todayStr})</p>
              {todayKpi ? (
                <>
                  <p className="mt-1 text-2xl font-semibold">{todayKpi.occupancyPercent}% obłożenie</p>
                  <p className="text-sm text-muted-foreground">
                    ADR: {todayKpi.adr != null ? `${todayKpi.adr.toFixed(2)} PLN` : "—"} · RevPAR: {todayKpi.revPar != null ? `${todayKpi.revPar.toFixed(2)} PLN` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Przychód noclegowy: {todayKpi.roomRevenue.toFixed(2)} PLN
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
            <div className="rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium text-muted-foreground">Wczoraj ({yesterdayStr})</p>
              {yesterdayKpi ? (
                <>
                  <p className="mt-1 text-2xl font-semibold">{yesterdayKpi.occupancyPercent}% obłożenie</p>
                  <p className="text-sm text-muted-foreground">
                    ADR: {yesterdayKpi.adr != null ? `${yesterdayKpi.adr.toFixed(2)} PLN` : "—"} · RevPAR: {yesterdayKpi.revPar != null ? `${yesterdayKpi.revPar.toFixed(2)} PLN` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Przychód noclegowy: {yesterdayKpi.roomRevenue.toFixed(2)} PLN
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
            <div className="rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium text-muted-foreground">Tydzień temu ({weekAgoStr})</p>
              {weekAgoKpi ? (
                <>
                  <p className="mt-1 text-2xl font-semibold">{weekAgoKpi.occupancyPercent}% obłożenie</p>
                  <p className="text-sm text-muted-foreground">
                    ADR: {weekAgoKpi.adr != null ? `${weekAgoKpi.adr.toFixed(2)} PLN` : "—"} · RevPAR: {weekAgoKpi.revPar != null ? `${weekAgoKpi.revPar.toFixed(2)} PLN` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Przychód noclegowy: {weekAgoKpi.roomRevenue.toFixed(2)} PLN
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Wykresy obłożenie + przychody */}
      {occupancyReport && revParReport && (
        <DashboardCharts
          occupancyDays={occupancyReport.days.map((d) => ({
            date: d.date,
            occupancyPercent: d.occupancyPercent,
            occupiedRooms: d.occupiedRooms,
            totalRooms: d.totalRooms,
          }))}
          revenueDays={revParReport.days.map((d) => ({
            date: d.date,
            roomRevenue: d.roomRevenue,
            revPar: d.revPar,
          }))}
          from={occupancyReport.from}
          to={occupancyReport.to}
        />
      )}

      {/* KPI – ostatnie 30 dni */}
      {kpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            KPI ({kpi.from} – {kpi.to})
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium text-muted-foreground">Obłożenie (Occupancy)</p>
              <p className="text-2xl font-semibold">{kpi.occupancyPercent}%</p>
              <p className="text-xs text-muted-foreground">
                {kpi.soldRoomNights} / {kpi.availableRoomNights} pokojoenoc
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium text-muted-foreground">ADR (śr. cena za noc)</p>
              <p className="text-2xl font-semibold">
                {kpi.adr != null ? `${kpi.adr.toFixed(2)} PLN` : "—"}
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium text-muted-foreground">RevPAR</p>
              <p className="text-2xl font-semibold">
                {kpi.revPar != null ? `${kpi.revPar.toFixed(2)} PLN` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                Przychód noclegowy: {kpi.roomRevenue.toFixed(2)} PLN
              </p>
            </div>
          </div>
        </section>
      )}

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
          <h2 className="mb-4 flex flex-wrap items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="h-5 w-5" />
            Ostatnie zgłoszenia OOO
            {data.oooRooms.length > 0 && (
              <>
                <span
                  className="inline-flex items-center justify-center rounded-full bg-destructive/15 px-2.5 py-0.5 text-sm font-medium text-destructive"
                  aria-label={`Liczba pokoi OOO: ${data.oooRooms.length}`}
                >
                  {data.oooRooms.length}
                </span>
                {data.oooNewTodayCount > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({data.oooNewTodayCount} nowe dziś)
                  </span>
                )}
              </>
            )}
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
