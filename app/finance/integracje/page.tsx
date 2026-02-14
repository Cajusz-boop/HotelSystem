"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  exportToOptimaAction,
  exportToSubiektAction,
  exportToWfirmaAction,
  exportToFakturowniaAction,
  exportToSymfoniaAction,
  exportToEnovaAction,
} from "@/app/actions/integrations";
import { toast } from "sonner";

type SystemId = "optima" | "subiekt" | "wfirma" | "fakturownia" | "symfonia" | "enova";

const SYSTEMS: { id: SystemId; name: string; desc: string }[] = [
  { id: "optima", name: "Optima", desc: "Eksport faktur do XML (Comarch ERP Optima)" },
  { id: "subiekt", name: "InsERT Subiekt", desc: "Eksport do InsERT Subiekt Nexo (XML)" },
  { id: "symfonia", name: "Symfonia", desc: "Eksport do Asseco Symfonia (CSV)" },
  { id: "enova", name: "enova", desc: "Eksport do enova 365 / Infor enova (CSV)" },
  { id: "wfirma", name: "wFirma", desc: "Eksport do wFirma / iFirma (API)" },
  { id: "fakturownia", name: "Fakturownia", desc: "Synchronizacja z Fakturownia.pl" },
];

export default function IntegracjePage() {
  const [system, setSystem] = useState<SystemId>("optima");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!dateFrom || !dateTo) {
      toast.error("Wybierz zakres dat");
      return;
    }
    setLoading(true);
    try {
      const propertyId: string | null = null;
      let result;
      if (system === "optima") {
        result = await exportToOptimaAction(propertyId, dateFrom, dateTo);
      } else if (system === "subiekt") {
        result = await exportToSubiektAction(propertyId, dateFrom, dateTo);
      } else if (system === "symfonia") {
        result = await exportToSymfoniaAction(propertyId, dateFrom, dateTo);
      } else if (system === "enova") {
        result = await exportToEnovaAction(propertyId, dateFrom, dateTo);
      } else if (system === "wfirma") {
        result = await exportToWfirmaAction(propertyId, dateFrom, dateTo);
      } else {
        result = await exportToFakturowniaAction(propertyId, dateFrom, dateTo);
      }
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const { content, filename, apiSent } = result.data;
      const mime =
        system === "optima" || system === "subiekt"
          ? "application/xml"
          : system === "symfonia" || system === "enova"
            ? "text/csv;charset=utf-8"
            : "application/json";
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      if (apiSent) {
        toast.success(`Eksport zapisany i wysłany do API (${filename})`);
      } else {
        toast.success(`Pobrano ${filename}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex gap-2 text-sm text-muted-foreground">
        <Link href="/finance" className="hover:text-foreground">Finanse</Link>
        <span>/</span>
        <span>Integracje księgowe</span>
      </div>
      <h1 className="text-2xl font-semibold mb-6">Integracje księgowe</h1>
      <p className="text-muted-foreground mb-6">
        Eksport faktur do systemów księgowych. Wybierz system, zakres dat i kliknij „Eksportuj”.
      </p>

      <div className="max-w-xl space-y-6 rounded-lg border bg-card p-6 shadow-sm">
        <div>
          <Label>System</Label>
          <select
            value={system}
            onChange={(e) => setSystem(e.target.value as SystemId)}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            {SYSTEMS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} – {s.desc}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dateFrom">Data od</Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="dateTo">Data do</Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <Button onClick={handleExport} disabled={loading}>
          {loading ? "Eksportowanie…" : "Eksportuj zakres dat"}
        </Button>
      </div>

      <div className="mt-8 max-w-xl rounded-lg border bg-muted/30 p-4 text-sm">
        <h2 className="font-semibold mb-2">Konfiguracja API (zmienne środowiskowe)</h2>
        <p className="text-muted-foreground mb-2">
          Opcjonalnie ustaw w pliku .env, aby wysyłać dane do API (inaczej tylko pobierany jest plik):
        </p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li><strong>wFirma:</strong> WFIRMA_API_KEY lub IFIRMA_API_KEY</li>
          <li><strong>Fakturownia:</strong> FAKTUROWNIA_API_TOKEN, FAKTUROWNIA_ACCOUNT_NAME (nazwa konta w adresie)</li>
        </ul>
      </div>
    </div>
  );
}
