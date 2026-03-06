"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Calculator, Loader2 } from "lucide-react";

export default function FillRatePricesPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    updated: number;
    skipped: number;
    total: number;
    logs: string[];
  } | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/fill-rate-code-prices", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || data.detail || "Błąd wykonania");
        return;
      }
      setResult({
        updated: data.updated ?? 0,
        skipped: data.skipped ?? 0,
        total: data.total ?? 0,
        logs: data.logs ?? [],
      });
      toast.success(`Zaktualizowano ${data.updated ?? 0} rezerwacji. Odśwież strony (Front-office, Kontrahenci), aby zobaczyć ceny.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calculator className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Uzupełnij ceny rezerwacji</h1>
        </div>
        <Link href="/ustawienia">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Button>
        </Link>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Akcja zbiorcza: dla rezerwacji bez zapisanej ceny (rateCodePrice = null) pobiera cenę z cennika
        (RatePlan, cena pokoju, cena typu) i zapisuje ją w bazie. Po odświeżeniu strony ceny będą widoczne
        w dialogu edycji rezerwacji i u kontrahentów.
      </p>

      <p className="text-sm text-muted-foreground mb-6">
        Pomijane są rezerwacje, dla których nie ma ceny w cenniku (sprawdź, czy pokoje mają ustawioną cenę
        oraz czy plany cenowe obejmują daty rezerwacji).
      </p>

      <Button onClick={handleRun} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uzupełnianie…
          </>
        ) : (
          "Uruchom uzupełnianie cen"
        )}
      </Button>

      {result && (
        <div className="mt-6 p-4 border rounded-lg bg-muted/30">
          <h3 className="font-medium mb-2">Wynik</h3>
          <p className="text-sm mb-2">
            Zaktualizowano: <strong>{result.updated}</strong> | Pominięto (brak ceny): <strong>{result.skipped}</strong> | Łącznie: <strong>{result.total}</strong>
          </p>
          {result.logs.length > 0 && (
            <pre className="text-xs overflow-auto max-h-60 p-2 bg-background rounded border">
              {result.logs.join("\n")}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
