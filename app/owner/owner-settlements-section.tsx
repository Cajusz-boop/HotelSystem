"use client";

import { useState, useEffect } from "react";
import {
  getOwnerSettlements,
  generateOwnerSettlementDocument,
  markOwnerSettlementPaid,
  type OwnerSettlementItem,
} from "@/app/actions/owner-settlements";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function OwnerSettlementsSection({ ownerId }: { ownerId: string }) {
  const [settlements, setSettlements] = useState<OwnerSettlementItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await getOwnerSettlements(ownerId);
    setSettlements(r.success && r.data ? r.data : []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [ownerId]);

  const handleGenerate = async (
    propertyId: string,
    periodFrom: string,
    periodTo: string
  ) => {
    const r = await generateOwnerSettlementDocument(
      ownerId,
      propertyId,
      periodFrom,
      periodTo
    );
    if (r.success && r.data) {
      toast.success("Dokument wygenerowany");
      window.open(r.data.documentUrl, "_blank");
      load();
    } else {
      toast.error(r.error ?? "Błąd");
    }
  };

  const handleMarkPaid = async (id: string) => {
    if (!id) return;
    const r = await markOwnerSettlementPaid(id, ownerId);
    if (r.success) {
      toast.success("Oznaczono jako zapłacone");
      load();
    } else {
      toast.error(r.error ?? "Błąd");
    }
  };

  if (loading) return <p className="text-muted-foreground">Ładowanie…</p>;

  if (settlements.length === 0) {
    return (
      <section className="mb-8 rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Rozliczenia z właścicielami</h2>
        <p className="text-sm text-muted-foreground">Brak rozliczeń.</p>
      </section>
    );
  }

  return (
    <section className="mb-8 rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Rozliczenia z właścicielami</h2>
      <ul className="space-y-2 text-sm">
        {settlements.map((s) => (
          <li
            key={`${s.propertyId}-${s.period}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2"
          >
            <span>
              <strong>{s.propertyName}</strong> – {s.period}: {s.amount.toFixed(2)} {s.currency}
            </span>
            <span
              className={
                s.status === "ZAPLACONE"
                  ? "text-green-600 font-medium"
                  : "text-muted-foreground"
              }
            >
              {s.status === "ZAPLACONE" ? "Zapłacone" : "Do rozliczenia"}
            </span>
            <div className="flex gap-2">
              {s.documentUrl ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(s.documentUrl!, "_blank")}
                >
                  Otwórz PDF
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleGenerate(s.propertyId, s.periodFrom, s.periodTo)
                  }
                >
                  Generuj PDF
                </Button>
              )}
              {s.id && s.status !== "ZAPLACONE" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleMarkPaid(s.id)}
                >
                  Oznacz zapłacone
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
