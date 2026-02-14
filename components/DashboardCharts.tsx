"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export type OccupancyDay = { date: string; occupancyPercent: number; occupiedRooms: number; totalRooms: number };
export type RevenueDay = { date: string; roomRevenue: number; revPar?: number };

export function DashboardCharts({
  occupancyDays,
  revenueDays,
  from,
  to,
}: {
  occupancyDays: OccupancyDay[];
  revenueDays: RevenueDay[];
  from: string;
  to: string;
}) {
  const occupancyData = occupancyDays.map((d) => ({
    date: d.date.slice(5),
    "Obłożenie %": d.occupancyPercent,
    Zajęte: d.occupiedRooms,
  }));
  const revenueData = revenueDays.map((d) => ({
    date: d.date.slice(5),
    "Przychód (PLN)": Math.round(d.roomRevenue * 100) / 100,
  }));

  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Wykresy – obłożenie i przychody ({from} – {to})</h2>
      <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={occupancyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickSuffix="%" />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: number) => [value, "Obłożenie %"]}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="Obłożenie %"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: number) => [`${value.toFixed(2)} PLN`, "Przychód"]}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <Legend />
              <Bar dataKey="Przychód (PLN)" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
