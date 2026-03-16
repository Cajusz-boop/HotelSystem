"use client";

import { useState, useCallback } from "react";
import { updateEventOrder } from "@/app/actions/mice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface EventReceiptSectionProps {
  eventId: string;
  name: string;
  quoteId: string | null;
  roomIds: string[];
  dateFrom: string;
  dateTo: string;
  status: string;
  notes: string | null;
  eventType?: string;
  receiptNumber: string | null;
  receiptDate: string | null;
  hasInvoice: boolean;
}

export function EventReceiptSection({
  eventId,
  name,
  quoteId,
  roomIds,
  dateFrom,
  dateTo,
  status,
  notes,
  eventType,
  receiptNumber,
  receiptDate,
  hasInvoice,
}: EventReceiptSectionProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editNumber, setEditNumber] = useState(receiptNumber?.trim() ?? "");
  const [editDate, setEditDate] = useState(receiptDate ?? "");
  const [saving, setSaving] = useState(false);

  const hasReceipt = receiptNumber != null && String(receiptNumber).trim() !== "";

  const openForm = useCallback(() => {
    setEditNumber(receiptNumber?.trim() ?? "");
    setEditDate(receiptDate ?? "");
    setFormOpen(true);
  }, [receiptNumber, receiptDate]);

  const saveReceipt = useCallback(async () => {
    const num = editNumber.trim();
    if (!num) {
      toast.error("Podaj numer paragonu.");
      return;
    }
    setSaving(true);
    try {
      const res = await updateEventOrder(
        eventId,
        name,
        quoteId ?? null,
        roomIds,
        dateFrom,
        dateTo,
        status,
        notes ?? null,
        eventType as "WEDDING" | "CONFERENCE" | "BANQUET" | "OTHER" | undefined,
        num,
        editDate.trim() || null
      );
      if (res.success) {
        toast.success("Paragon zapisany.");
        setFormOpen(false);
        window.location.reload();
      } else {
        toast.error(res.error ?? "Błąd zapisu");
      }
    } finally {
      setSaving(false);
    }
  }, [eventId, name, quoteId, roomIds, dateFrom, dateTo, status, notes, eventType, editNumber, editDate]);

  const removeReceipt = useCallback(async () => {
    setSaving(true);
    try {
      const res = await updateEventOrder(
        eventId,
        name,
        quoteId ?? null,
        roomIds,
        dateFrom,
        dateTo,
        status,
        notes ?? null,
        eventType as "WEDDING" | "CONFERENCE" | "BANQUET" | "OTHER" | undefined,
        null,
        null
      );
      if (res.success) {
        toast.success("Paragon usunięty.");
        setFormOpen(false);
        window.location.reload();
      } else {
        toast.error(res.error ?? "Błąd zapisu");
      }
    } finally {
      setSaving(false);
    }
  }, [eventId, name, quoteId, roomIds, dateFrom, dateTo, status, notes, eventType]);

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Paragon fiskalny</p>
      {formOpen ? (
        <div className="rounded border bg-muted/20 p-3 space-y-3">
          <div>
            <Label htmlFor="event-receipt-number" className="text-xs">Numer paragonu</Label>
            <Input
              id="event-receipt-number"
              value={editNumber}
              onChange={(e) => setEditNumber(e.target.value)}
              placeholder="np. 123/2025"
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <Label htmlFor="event-receipt-date" className="text-xs">Data paragonu (opcjonalnie)</Label>
            <Input
              id="event-receipt-date"
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="h-8 text-xs" onClick={saveReceipt} disabled={saving}>
              {saving ? "Zapisywanie…" : "Zapisz"}
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => setFormOpen(false)} disabled={saving}>
              Anuluj
            </Button>
            {hasReceipt && (
              <Button type="button" size="sm" variant="destructive" className="h-8 text-xs" onClick={removeReceipt} disabled={saving}>
                Usuń paragon
              </Button>
            )}
          </div>
        </div>
      ) : hasReceipt ? (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="font-normal">
            Paragon nr {receiptNumber}
            {receiptDate ? ` · ${new Date(receiptDate).toLocaleDateString("pl-PL")}` : ""}
          </Badge>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={openForm}>
            Edytuj
          </Button>
        </div>
      ) : !hasInvoice ? (
        <p className="text-sm text-muted-foreground">Brak dokumentu finansowego.</p>
      ) : null}
      {!hasReceipt && !formOpen && !hasInvoice && (
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs mt-1" onClick={openForm}>
          Dodaj paragon
        </Button>
      )}
    </div>
  );
}
