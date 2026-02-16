"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  parseImportPmsFile,
  parseImportCsv,
  executeImportPms,
  type ImportPmsPayload,
  type ImportResult,
} from "@/app/actions/import-pms";
import { exportPmsData } from "@/app/actions/export-pms";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileJson, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EXAMPLE_JSON = `{
  "guests": [
    { "name": "Kowalski Jan", "email": "jan@example.com", "phone": "+48123456789" },
    { "name": "Nowak Anna" }
  ],
  "rooms": [
    { "number": "101", "type": "Standard", "status": "CLEAN" },
    { "number": "102", "type": "Standard", "price": 350 }
  ]
}
`;

export default function ImportPage() {
  const [jsonInput, setJsonInput] = useState("");
  const [preview, setPreview] = useState<ImportPmsPayload | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [exportGuests, setExportGuests] = useState(true);
  const [exportRooms, setExportRooms] = useState(true);
  const [exportReservations, setExportReservations] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importFormat, setImportFormat] = useState<"json" | "csv">("json");
  const [csvMode, setCsvMode] = useState<"guests" | "rooms" | "reservations">("guests");

  const handlePreview = async () => {
    setPreviewError(null);
    setPreview(null);
    setResult(null);
    const content = jsonInput.trim();
    if (!content) {
      setPreviewError(importFormat === "json" ? "Wklej JSON." : "Wklej CSV.");
      return;
    }
    if (importFormat === "json") {
      const parsed = await parseImportPmsFile(content);
      if (parsed.success) {
        setPreview(parsed.data);
        if (
          (!parsed.data.guests || parsed.data.guests.length === 0) &&
          (!parsed.data.rooms || parsed.data.rooms.length === 0) &&
          (!parsed.data.reservations || parsed.data.reservations.length === 0)
        ) {
          setPreviewError("Brak gości, pokoi ani rezerwacji do importu.");
        }
      } else {
        setPreviewError(parsed.error);
      }
    } else {
      const parsed = await parseImportCsv(content, csvMode);
      if (parsed.success) {
        setPreview(parsed.data);
        const hasAny =
          (parsed.data.guests?.length ?? 0) > 0 ||
          (parsed.data.rooms?.length ?? 0) > 0 ||
          (parsed.data.reservations?.length ?? 0) > 0;
        if (!hasAny) setPreviewError("Brak wierszy do importu (sprawdź nagłówki CSV).");
      } else {
        setPreviewError(parsed.error);
      }
    }
  };

  const handleImport = async () => {
    if (!preview) {
      toast.error("Najpierw wczytaj podgląd");
      return;
    }
    setImporting(true);
    setResult(null);
    try {
      const res = await executeImportPms(preview);
      if (res.success) {
        setResult(res.result);
        toast.success(
          `Import zakończony: ${res.result.guestsCreated} gości, ${res.result.roomsCreated} pokoi`
        );
        setPreview(null);
        setJsonInput("");
      } else {
        toast.error("error" in res ? res.error : "Błąd");
      }
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    if (!exportGuests && !exportRooms && !exportReservations) {
      toast.error("Zaznacz co najmniej jedną kategorię");
      return;
    }
    setExporting(true);
    try {
      const res = await exportPmsData({
        guests: exportGuests,
        rooms: exportRooms,
        reservations: exportReservations,
      });
      if (res.success && res.json) {
        const blob = new Blob([res.json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pms-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Eksport pobrany");
      } else {
        toast.error("error" in res ? (res.error ?? "Błąd eksportu") : "Błąd eksportu");
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/ustawienia">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Import / Eksport (migracja PMS)</h1>
      </div>

      <p className="text-muted-foreground mb-6">
        Eksport: pobierz dane w JSON. Import: wklej JSON z gośćmi i/lub pokojami. Goście: <code className="rounded bg-muted px-1">name</code> (wymagane),{" "}
        <code className="rounded bg-muted px-1">email</code>, <code className="rounded bg-muted px-1">phone</code>. Pokoje:{" "}
        <code className="rounded bg-muted px-1">number</code>, <code className="rounded bg-muted px-1">type</code> (nazwa typu pokoju), opcjonalnie{" "}
        <code className="rounded bg-muted px-1">status</code>, <code className="rounded bg-muted px-1">price</code>. Istniejący gość/pokój (po nazwie/numerze) zostanie pominięty.
      </p>

      <section className="rounded-lg border bg-card p-4 mb-6">
        <h2 className="font-semibold mb-3">Eksport danych (migracja do innego systemu)</h2>
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <div className="flex items-center gap-2">
            <Switch id="exp-guests" checked={exportGuests} onCheckedChange={setExportGuests} />
            <Label htmlFor="exp-guests">Goście</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="exp-rooms" checked={exportRooms} onCheckedChange={setExportRooms} />
            <Label htmlFor="exp-rooms">Pokoje</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="exp-res" checked={exportReservations} onCheckedChange={setExportReservations} />
            <Label htmlFor="exp-res">Rezerwacje (do 10 000)</Label>
          </div>
        </div>
        <Button onClick={handleExport} disabled={exporting}>
          <Download className="w-4 h-4 mr-2" />
          {exporting ? "Eksportowanie…" : "Pobierz JSON"}
        </Button>
      </section>

      <h2 className="font-semibold mb-2">Import z pliku (JSON lub CSV / Excel → CSV)</h2>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Label>Format</Label>
          <Select value={importFormat} onValueChange={(v: "json" | "csv") => setImportFormat(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {importFormat === "csv" && (
          <div className="flex items-center gap-2">
            <Label>Typ</Label>
            <Select value={csvMode} onValueChange={(v: "guests" | "rooms" | "reservations") => setCsvMode(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="guests">Goście</SelectItem>
                <SelectItem value="rooms">Pokoje</SelectItem>
                <SelectItem value="reservations">Rezerwacje</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="space-y-2 mb-4">
        <Label>{importFormat === "json" ? "Plik JSON" : "Zawartość CSV (nagłówek + wiersze)"}</Label>
        <Textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={EXAMPLE_JSON}
          rows={14}
          className="font-mono text-sm resize-none"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handlePreview}>
            <FileJson className="w-4 h-4 mr-2" />
            Podgląd
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setJsonInput(EXAMPLE_JSON);
              setPreviewError(null);
              setPreview(null);
            }}
          >
            Wstaw przykład
          </Button>
        </div>
      </div>

      {previewError && <p className="text-destructive text-sm mb-4">{previewError}</p>}

      {preview && (
        <div className="rounded-lg border bg-card p-4 mb-4">
          <h2 className="font-semibold mb-2">Podgląd importu</h2>
          {preview.guests && preview.guests.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Goście: <strong>{preview.guests.length}</strong>
            </p>
          )}
          {preview.rooms && preview.rooms.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Pokoje: <strong>{preview.rooms.length}</strong>
            </p>
          )}
          {preview.reservations && preview.reservations.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Rezerwacje: <strong>{preview.reservations.length}</strong>
            </p>
          )}
          <Button
            className="mt-2"
            disabled={importing}
            onClick={handleImport}
          >
            <Upload className="w-4 h-4 mr-2" />
            {importing ? "Importowanie…" : "Wykonaj import"}
          </Button>
        </div>
      )}

      {result && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold mb-2">Wynik importu</h2>
          <ul className="text-sm space-y-1">
            <li>Goście: utworzono {result.guestsCreated}, pominięto {result.guestsSkipped}</li>
            <li>Pokoje: utworzono {result.roomsCreated}, pominięto {result.roomsSkipped}</li>
            <li>Rezerwacje: utworzono {result.reservationsCreated}</li>
          </ul>
          {result.guestsErrors.length > 0 && (
            <div className="mt-2">
              <p className="font-medium text-destructive">Błędy gości:</p>
              <ul className="text-xs text-destructive list-disc list-inside">
                {result.guestsErrors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {result.guestsErrors.length > 10 && (
                  <li>… i {result.guestsErrors.length - 10} innych</li>
                )}
              </ul>
            </div>
          )}
          {result.roomsErrors.length > 0 && (
            <div className="mt-2">
              <p className="font-medium text-destructive">Błędy pokoi:</p>
              <ul className="text-xs text-destructive list-disc list-inside">
                {result.roomsErrors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {result.roomsErrors.length > 10 && (
                  <li>… i {result.roomsErrors.length - 10} innych</li>
                )}
              </ul>
            </div>
          )}
          {result.reservationsErrors.length > 0 && (
            <div className="mt-2">
              <p className="font-medium text-destructive">Błędy rezerwacji:</p>
              <ul className="text-xs text-destructive list-disc list-inside">
                {result.reservationsErrors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {result.reservationsErrors.length > 10 && (
                  <li>… i {result.reservationsErrors.length - 10} innych</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
