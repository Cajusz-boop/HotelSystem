"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Download, Copy, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Kt1ReportResponse } from "@/lib/kt1-report";

const MONTH_NAMES = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];

function canShowReport(permissions: string[] | null, code: string): boolean {
  if (!permissions || permissions.length === 0) return true;
  return permissions.includes(code);
}

export function Kt1ReportPageClient({
  permissions,
}: {
  permissions: string[] | null;
}) {
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<Kt1ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showOfficial = canShowReport(permissions, "reports.official");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reports/kt1?month=${month}&year=${year}`,
        { credentials: "include" }
      );
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        setError("Brak uprawnień do raportu KT-1.");
        return;
      }
      if (res.status === 404) {
        setError("Brak konfiguracji GUS (GusConfig).");
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Błąd pobierania danych.");
        return;
      }
      const json: Kt1ReportResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd połączenia.");
    } finally {
      setLoading(false);
    }
  }, [month, year, router]);

  useEffect(() => {
    if (!showOfficial) return;
    void fetchReport();
  }, [showOfficial, fetchReport]);

  const handleGenerujPdf = () => {
    window.open(
      `/api/reports/kt1/pdf?month=${month}&year=${year}`,
      "_blank",
      "noopener,noreferrer"
    );
    toast.success("Otwieranie PDF…");
  };

  const handleKopiujDane = async () => {
    if (!data) {
      toast.error("Brak danych do skopiowania.");
      return;
    }
    const lines: string[] = [
      "Raport KT-1 (GUS)",
      `Okres: ${MONTH_NAMES[data.meta.month - 1]} ${data.meta.year}`,
      "",
      "Dział 4:",
      `1. Liczba dni działalności: ${data.section4.daysActive}`,
      `2. Nominalna liczba miejsc: ${data.section4.nominalPlaces}`,
      `3. Nominalna liczba pokoi: ${data.section4.nominalRooms}`,
      `4. Osoby korzystające z noclegów (ogółem / zagraniczni): ${data.section4.guestsTotal} / ${data.section4.guestsForeign}`,
      `5. Udzielone noclegi (ogółem / zagraniczni): ${data.section4.personNightsTotal} / ${data.section4.personNightsForeign}`,
      `6. Wynajęte pokoje (ogółem / zagraniczni): ${data.section4.roomNightsTotal} / ${data.section4.roomNightsForeign}`,
      "",
      "Dział 5 (turyści zagraniczni):",
      "Kraj;Turyści;Udzielone noclegi",
      ...data.section5.map(
        (r) => `${r.countryLabel};${r.guests};${r.personNights}`
      ),
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Dane skopiowane do schowka.");
    } catch {
      toast.error("Nie udało się skopiować do schowka.");
    }
  };

  if (!showOfficial) {
    return (
      <div className="container max-w-4xl space-y-6 py-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Nie masz uprawnień do raportu KT-1 (GUS). Skontaktuj się z administratorem.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/reports">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Wróć do Raportów
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl space-y-6 py-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Raport KT-1 (GUS)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sprawozdanie o wykorzystaniu turystycznego obiektu noclegowego
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/reports">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Raporty
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wybierz okres</CardTitle>
          <div className="flex flex-wrap gap-4 pt-2">
            <div className="space-y-2">
              <Label>Miesiąc</Label>
              <Select
                value={String(month)}
                onValueChange={(v) => setMonth(parseInt(v, 10))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rok</Label>
              <Select
                value={String(year)}
                onValueChange={(v) => setYear(parseInt(v, 10))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(
                    { length: 6 },
                    (_, i) => new Date().getFullYear() - 2 + i
                  ).map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void fetchReport()}
                disabled={loading}
              >
                {loading ? "Ładowanie…" : "Odśwież"}
              </Button>
              <Button
                type="button"
                onClick={handleGenerujPdf}
                disabled={!data || loading}
              >
                <Download className="mr-2 h-4 w-4" />
                Generuj PDF
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleKopiujDane()}
                disabled={!data || loading}
              >
                <Copy className="mr-2 h-4 w-4" />
                Kopiuj dane
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {data && !error && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dział 1. Dane ogólne</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p><strong>Nazwa obiektu:</strong> {data.section1.objectName}</p>
              <p><strong>Adres:</strong> {data.section1.address ?? "—"} {data.section1.postalCode ?? ""} {data.section1.city ?? ""}</p>
              <p><strong>Gmina:</strong> {data.section1.gmina ?? "—"} &nbsp; <strong>Powiat:</strong> {data.section1.powiat ?? "—"} &nbsp; <strong>Województwo:</strong> {data.section1.voivodeship ?? "—"}</p>
              <p><strong>REGON:</strong> {data.section1.regon ?? "—"} &nbsp; Rodzaj: {data.section1.objectType} &nbsp; Kategoria: {data.section1.category} &nbsp; Całoroczny: {data.section1.isYearRound ? "tak" : "nie"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dział 4. Wykorzystanie obiektu w badanym miesiącu</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Pozycja</th>
                    <th className="text-right py-2">Ogółem</th>
                    <th className="text-right py-2">W tym turyści zagraniczni</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b"><td className="py-2 pr-4">1. Liczba dni działalności obiektu</td><td className="text-right">{data.section4.daysActive}</td><td className="text-right">—</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">2. Nominalna liczba miejsc noclegowych</td><td className="text-right">{data.section4.nominalPlaces}</td><td className="text-right">—</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">3. Nominalna liczba pokoi</td><td className="text-right">{data.section4.nominalRooms}</td><td className="text-right">—</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">4. Liczba osób korzystających z noclegów</td><td className="text-right">{data.section4.guestsTotal}</td><td className="text-right">{data.section4.guestsForeign}</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">5. Udzielone noclegi (osobonoce)</td><td className="text-right">{data.section4.personNightsTotal}</td><td className="text-right">{data.section4.personNightsForeign}</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">6. Liczba wynajętych pokoi (pokojo-dni)</td><td className="text-right">{data.section4.roomNightsTotal}</td><td className="text-right">{data.section4.roomNightsForeign}</td></tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dział 5. Turyści zagraniczni według kraju stałego zamieszkania</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Kraj</th>
                    <th className="text-right py-2">Turyści korzystający z noclegów</th>
                    <th className="text-right py-2">Udzielone noclegi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.section5.map((row) => (
                    <tr key={row.countryCode} className="border-b">
                      <td className="py-2 pr-4">{row.countryLabel}</td>
                      <td className="text-right">{row.guests}</td>
                      <td className="text-right">{row.personNights}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
