"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importPhoneCalls } from "@/app/actions/telephony";
import { getEffectivePropertyId } from "@/app/actions/properties";
import { toast } from "sonner";
import { Phone, Download } from "lucide-react";

export default function CentralaPage() {
  const [cdrImportUrl, setCdrImportUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [importing, setImporting] = useState(false);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateFrom || !dateTo) {
      toast.error("Podaj zakres dat");
      return;
    }
    setImporting(true);
    try {
      const propertyId = await getEffectivePropertyId();
      const result = await importPhoneCalls(propertyId ?? null, dateFrom, dateTo, {
        cdrImportUrl: cdrImportUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      });
      if (result.success) {
        const { imported, skipped, charged, errors } = result.data;
        toast.success(`Import zakończony: ${imported} dodanych, ${skipped} pominiętych, ${charged} obciążonych do rachunku.${errors.length ? ` Błędy: ${errors.length}` : ""}`);
        if (errors.length > 0 && errors[0]) toast.error(errors[0]);
      } else {
        toast.error(result.error);
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex gap-2 text-sm text-muted-foreground">
        <Link href="/ustawienia" className="hover:text-foreground">Ustawienia</Link>
        <span>/</span>
        <span>Centrala telefoniczna</span>
      </div>
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-semibold">
        <Phone className="h-7 w-7" />
        Centrala telefoniczna
      </h1>

      <div className="max-w-xl space-y-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Konfiguracja API CDR</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Integracja z centralą (Asterisk, 3CX) – podaj endpoint zwracający CDR (Call Detail Records) dla zakresu dat. Endpoint powinien przyjmować parametry <code className="rounded bg-muted px-1">from</code> i <code className="rounded bg-muted px-1">to</code> (ISO 8601).
          </p>
          <form onSubmit={handleImport} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="cdr-url">URL API CDR</Label>
              <Input
                id="cdr-url"
                type="url"
                placeholder="https://centrala.example.com/api/cdr"
                value={cdrImportUrl}
                onChange={(e) => setCdrImportUrl(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="api-key">Klucz API (opcjonalnie)</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Bearer token lub klucz"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="date-from">Data od</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date-to">Data do</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={importing}>
              <Download className="mr-2 h-4 w-4" />
              {importing ? "Importowanie…" : "Importuj połączenia"}
            </Button>
          </form>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p>Jeśli nie podasz URL w formularzu, używana jest zmienna środowiskowa <code className="rounded bg-muted px-1">TELEPHONY_CDR_IMPORT_URL</code>. Opcjonalnie: <code className="rounded bg-muted px-1">TELEPHONY_CDR_API_KEY</code>.</p>
        </div>

        <Link href="/ustawienia" className="inline-block text-sm text-primary hover:underline">
          ← Powrót do ustawień
        </Link>
      </div>
    </div>
  );
}
