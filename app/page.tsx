import Link from "next/link";
import nextDynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Sparkles,
  Trash2,
  AlertTriangle,
  BarChart3,
  UtensilsCrossed,
  LogIn,
  LogOut,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { getDashboardData, getKpiReport, getOccupancyReport, getRevParReport } from "@/app/actions/dashboard";
import { getTodayRestaurantSummary } from "@/app/actions/gastronomy";
import { CheckInReminderNotification } from "@/components/check-in-reminder-notification";

const Dashboard = nextDynamic(() => import("@/components/Dashboard").then((m) => m.Dashboard), { ssr: false });
const DashboardCharts = nextDynamic(
  () => import("@/components/DashboardCharts").then((m) => m.DashboardCharts),
  { ssr: false }
);

export const dynamic = "force-dynamic";

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function TrendIndicator({ current, previous, suffix = "" }: { current: number | null; previous: number | null; suffix?: string }) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> bez zmian
      </span>
    );
  }
  const isUp = diff > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-emerald-600" : "text-red-500"}`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? "+" : ""}{diff.toFixed(suffix === "%" ? 0 : 2)}{suffix}
    </span>
  );
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

  const [data, kpiResult, occResult, revParResult, kpiToday, kpiYesterday, kpiWeekAgo, restaurantResult] = await Promise.all([
    getDashboardData(),
    getKpiReport(fromStr, todayStr),
    getOccupancyReport(fromStr, todayStr),
    getRevParReport(fromStr, todayStr),
    getKpiReport(todayStr, todayStr),
    getKpiReport(yesterdayStr, yesterdayStr),
    getKpiReport(weekAgoStr, weekAgoStr),
    getTodayRestaurantSummary(),
  ]);
  const kpi = kpiResult.success ? kpiResult.data : null;
  const occupancyReport = occResult.success ? occResult.data : null;
  const revParReport = revParResult.success ? revParResult.data : null;
  const todayKpi = kpiToday.success ? kpiToday.data : null;
  const yesterdayKpi = kpiYesterday.success ? kpiYesterday.data : null;
  const weekAgoKpi = kpiWeekAgo.success ? kpiWeekAgo.data : null;
  const restaurantSummary = restaurantResult.success ? restaurantResult.data : null;

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Centrum Dowodzenia</h1>
          <p className="text-sm text-muted-foreground">Dane na dzień {todayStr}</p>
        </div>
        <Button asChild>
          <Link href="/front-office">
            <Calendar className="mr-2 h-4 w-4" />
            Otwórz grafik
          </Link>
        </Button>
      </div>

      <CheckInReminderNotification count={data.todayCheckIns.length} />

      {/* ===== STREFA 1: KOMPAKTOWE KPI + ALERTY ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI: Obłożenie */}
        <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Obłożenie dziś</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{todayKpi?.occupancyPercent ?? "—"}%</span>
            <TrendIndicator current={todayKpi?.occupancyPercent ?? null} previous={yesterdayKpi?.occupancyPercent ?? null} suffix="%" />
          </div>
          {yesterdayKpi && (
            <p className="text-xs text-muted-foreground">
              wczoraj: {yesterdayKpi.occupancyPercent}% · tydz. temu: {weekAgoKpi?.occupancyPercent ?? "—"}%
            </p>
          )}
        </div>

        {/* KPI: ADR */}
        <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">ADR dziś</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{todayKpi?.adr != null ? `${todayKpi.adr.toFixed(0)} PLN` : "—"}</span>
            <TrendIndicator current={todayKpi?.adr ?? null} previous={yesterdayKpi?.adr ?? null} />
          </div>
          {yesterdayKpi && (
            <p className="text-xs text-muted-foreground">
              wczoraj: {yesterdayKpi.adr?.toFixed(0) ?? "—"} PLN
            </p>
          )}
        </div>

        {/* KPI: RevPAR */}
        <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">RevPAR dziś</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{todayKpi?.revPar != null ? `${todayKpi.revPar.toFixed(0)} PLN` : "—"}</span>
            <TrendIndicator current={todayKpi?.revPar ?? null} previous={yesterdayKpi?.revPar ?? null} />
          </div>
          {todayKpi && (
            <p className="text-xs text-muted-foreground">
              przychód: {todayKpi.roomRevenue.toFixed(0)} PLN
            </p>
          )}
        </div>

        {/* Alerty operacyjne */}
        <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sytuacja dnia</p>
          <div className="mt-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <LogIn className="h-3.5 w-3.5 text-blue-500" />
                Meldunki
              </span>
              <span className="font-semibold">{data.todayCheckIns.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <LogOut className="h-3.5 w-3.5 text-emerald-500" />
                Wyjazdy
              </span>
              <span className="font-semibold">{data.todayCheckOuts.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                VIP
              </span>
              <span className="font-semibold">{data.vipArrivals.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5 text-orange-500" />
                Do sprzątania
              </span>
              <span className="font-semibold">{data.dirtyRooms.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                OOO
              </span>
              <span className="font-semibold">
                {data.oooRooms.length}
                {data.oooNewTodayCount > 0 && (
                  <span className="ml-1 text-xs font-normal text-red-500">(+{data.oooNewTodayCount} nowe)</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== STREFA 2: MAPA FUNKCJI SYSTEMU ===== */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Mapa funkcji systemu</h2>
          <p className="text-sm text-muted-foreground">
            Wszystkie moduły i funkcje programu — kliknij kafelek, aby przejść
          </p>
        </div>
        <Dashboard />
      </section>

      {/* ===== STREFA 3: WYKRESY I SZCZEGÓŁY ===== */}

      {/* Wykresy obłożenia + przychody */}
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

      {/* Widgety szczegółowe: VIP, sprzątanie, OOO, meldunki, restauracja */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* VIP Arrival */}
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

        {/* OOO */}
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

      {/* Restauracja – dzisiejsze obciążenia z Bistro */}
      {restaurantSummary && restaurantSummary.count > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Restauracja – dzisiejsze obciążenia na pokój</h2>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-amber-900 dark:text-amber-200">{restaurantSummary.totalAmount.toFixed(2)} PLN</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">{restaurantSummary.count} {restaurantSummary.count === 1 ? "rachunek" : restaurantSummary.count < 5 ? "rachunki" : "rachunków"}</p>
            </div>
          </div>
          {restaurantSummary.recentCharges.length > 0 && (
            <div className="mt-3 divide-y divide-amber-200 dark:divide-amber-800">
              {restaurantSummary.recentCharges.slice(0, 5).map((charge, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-amber-900 dark:text-amber-200">Pok. {charge.roomNumber}</span>
                    <span className="text-amber-700 dark:text-amber-400">{charge.guestName}</span>
                  </div>
                  <span className="font-semibold text-amber-900 dark:text-amber-200">{charge.amount.toFixed(2)} PLN</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Dzisiejsze check-iny */}
      {data.todayCheckIns.length > 0 && (
        <section className="rounded-lg border bg-card p-6 shadow-sm" data-testid="checkin-section">
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

      {/* Dzisiejsze wyjazdy (check-out) */}
      {data.todayCheckOuts.length > 0 && (
        <section className="rounded-lg border bg-card p-6 shadow-sm" data-testid="checkout-section">
          <h2 className="mb-4 text-lg font-semibold">Dzisiejsze wyjazdy</h2>
          <ul className="space-y-2">
            {data.todayCheckOuts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="font-medium">{a.guestName}</span>
                <span className="text-muted-foreground">Pokój {a.room} · wyjazd {a.checkOut}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
