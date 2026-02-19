"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFormFieldsForForm } from "@/app/actions/hotel-config";
import type { CustomFormField } from "@/lib/hotel-config-types";
import { parseMRZ } from "@/lib/mrz";
import { toast } from "sonner";
import { ScanLine, Upload } from "lucide-react";

async function ocrFromFile(file: File): Promise<{ name: string; mrz?: string }> {
  const Tesseract = (await import("tesseract.js")).default;
  const {
    data: { text },
  } = await Tesseract.recognize(file, "eng", {
    logger: () => {},
  });
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const mrzLine =
    lines.find((l) => l.length >= 30 && /[0-9<]/.test(l) && l.replace(/</g, "").length > 5) ??
    lines.join("\n");
  const parsed = parseMRZ(mrzLine);
  if (parsed) {
    const name = `${parsed.surname}, ${parsed.givenNames}`.trim();
    return { name: name || "Nie odczytano nazwiska", mrz: mrzLine };
  }
  const firstLine = lines[0]?.slice(0, 80).trim();
  return {
    name: firstLine || "Nie odczytano tekstu",
    mrz: mrzLine.length >= 30 ? mrzLine : undefined,
  };
}

interface CheckinTabProps {
  onGuestNameFromOcr?: (name: string) => void;
  onMrzParsed?: (mrz: string) => void;
}

export function CheckinTab({ onGuestNameFromOcr, onMrzParsed }: CheckinTabProps) {
  const [mrz, setMrz] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [customFormFields, setCustomFormFields] = useState<CustomFormField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number | boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getFormFieldsForForm("CHECK_IN").then((fields) => {
      setCustomFormFields(fields);
      setCustomFieldValues((prev) => {
        const next = { ...prev };
        fields.forEach((f) => {
          if (next[f.key] === undefined) {
            next[f.key] = f.type === "checkbox" ? false : "";
          }
        });
        return next;
      });
    });
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("processing");

    try {
      const parsed = await ocrFromFile(file);
      onGuestNameFromOcr?.(parsed.name);
      if (parsed.mrz) {
        setMrz(parsed.mrz);
        onMrzParsed?.(parsed.mrz);
      }
      setUploadStatus("done");
      toast.success("Dane z dokumentu wczytane (OCR). Plik nie został zapisany.");
    } catch {
      setUploadStatus("error");
      toast.error("Nie udało się odczytać dokumentu.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [onGuestNameFromOcr, onMrzParsed]);

  const handleMrzBlur = useCallback(() => {
    if (!mrz.trim()) return;
    const parsed = parseMRZ(mrz);
    if (parsed && (parsed.surname || parsed.givenNames)) {
      const name = parsed.givenNames ? `${parsed.surname}, ${parsed.givenNames}` : parsed.surname;
      onGuestNameFromOcr?.(name);
    }
  }, [mrz, onGuestNameFromOcr]);

  return (
    <div className="space-y-5">
      {/* Parse & Forget: upload zdjęcia dowodu */}
      <div className="space-y-2">
        <Label>Zdjęcie dowodu (Parse & Forget)</Label>
        <p className="text-xs text-muted-foreground">
          Opcjonalnie: wgraj zdjęcie dowodu. System symuluje OCR, wypełnia pola i
          natychmiast usuwa plik – nie zapisujemy go w bazie.
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Wybierz zdjęcie dowodu"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadStatus === "processing"}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploadStatus === "processing"
              ? "Przetwarzanie…"
              : "Wgraj zdjęcie dowodu"}
          </Button>
          {uploadStatus === "done" && (
            <span className="text-sm text-muted-foreground">Wczytano, plik usunięty</span>
          )}
        </div>
      </div>

      {/* Pole MRZ – pod skaner 2D */}
      <div className="space-y-2">
        <Label htmlFor="checkin-mrz">Kod MRZ (dowód – skaner 2D)</Label>
        <p className="text-xs text-muted-foreground">
          Wpisz lub zeskanuj kod MRZ z dowodu (2 lub 3 linie). Po opuszczeniu pola
          imię i nazwisko zostaną uzupełnione, jeśli to możliwe.
        </p>
        <textarea
          id="checkin-mrz"
          value={mrz}
          onChange={(e) => setMrz(e.target.value)}
          onBlur={handleMrzBlur}
          placeholder="np. IDPOLKOWALSKI<<JAN<<<<<<..."
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          maxLength={150}
        />
        <div className="flex items-center gap-1 text-muted-foreground">
          <ScanLine className="h-4 w-4" />
          <span className="text-xs">Przygotowane pod skaner 2D</span>
        </div>
      </div>

      {/* Dodatkowe pola z konfiguracji */}
      {customFormFields.length > 0 && (
        <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4">
          <h3 className="text-sm font-semibold">Dodatkowe pola</h3>
          <div className="space-y-3">
            {customFormFields.map((f) => (
              <div key={f.id} className="space-y-1">
                {f.type === "checkbox" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`checkin-${f.key}`}
                      checked={Boolean(customFieldValues[f.key])}
                      onChange={(e) =>
                        setCustomFieldValues((prev) => ({ ...prev, [f.key]: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor={`checkin-${f.key}`}>{f.label}</Label>
                  </div>
                ) : f.type === "select" && f.options?.length ? (
                  <>
                    <Label htmlFor={`checkin-${f.key}`}>{f.label}</Label>
                    <select
                      id={`checkin-${f.key}`}
                      value={String(customFieldValues[f.key] ?? "")}
                      onChange={(e) =>
                        setCustomFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      required={f.required}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">— wybierz —</option>
                      {f.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <Label htmlFor={`checkin-${f.key}`}>
                      {f.label}
                      {f.required && " *"}
                    </Label>
                    <Input
                      id={`checkin-${f.key}`}
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={String(customFieldValues[f.key] ?? "")}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCustomFieldValues((prev) => ({
                          ...prev,
                          [f.key]: f.type === "number" ? (v === "" ? "" : Number(v)) : v,
                        }));
                      }}
                      required={f.required}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
