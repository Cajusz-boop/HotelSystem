"use client";

import { useState, useEffect } from "react";
import {
  getUnassignedGastronomyCharges,
  assignGastronomyChargeToReservation,
  cancelUnassignedGastronomyCharge,
} from "@/app/actions/gastronomy";
import { getActiveReservationsForCharge } from "@/app/actions/spa";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface UnassignedCharge {
  id: string;
  roomNumber: string;
  amount: number;
  description: string | null;
  posSystem: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: number }> | null;
  createdAt: string;
}

interface Reservation {
  id: string;
  guestName: string;
  roomNumber: string;
}

export function UnassignedChargesSection() {
  const [charges, setCharges] = useState<UnassignedCharge[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<UnassignedCharge | null>(null);
  const [selectedReservationId, setSelectedReservationId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    const [chargesRes, resRes] = await Promise.all([
      getUnassignedGastronomyCharges(),
      getActiveReservationsForCharge(),
    ]);
    if (chargesRes.success && chargesRes.data) {
      setCharges(chargesRes.data as UnassignedCharge[]);
    }
    if (resRes.success && resRes.data) {
      setReservations(
        resRes.data.map((r) => ({
          id: r.id,
          guestName: r.guestName,
          roomNumber: r.roomNumber,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAssign = (charge: UnassignedCharge) => {
    setSelectedCharge(charge);
    const matchingRes = reservations.find(
      (r) => r.roomNumber === charge.roomNumber
    );
    setSelectedReservationId(matchingRes?.id ?? "");
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedCharge || !selectedReservationId) return;
    setSubmitting(true);
    const r = await assignGastronomyChargeToReservation(
      selectedCharge.id,
      selectedReservationId
    );
    setSubmitting(false);
    if (r.success) {
      toast.success("Obciążenie przypisane do rezerwacji");
      setAssignDialogOpen(false);
      setSelectedCharge(null);
      loadData();
    } else {
      toast.error(r.error);
    }
  };

  const handleCancel = async (chargeId: string) => {
    if (!confirm("Czy na pewno anulować to obciążenie?")) return;
    const r = await cancelUnassignedGastronomyCharge(chargeId);
    if (r.success) {
      toast.success("Obciążenie anulowane");
      loadData();
    } else {
      toast.error(r.error);
    }
  };

  if (loading) return null;
  if (charges.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold">Nieprzypisane obciążenia z Bistro</h2>
        <Badge variant="destructive">{charges.length}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Te zamówienia z systemu gastronomicznego nie zostały automatycznie przypisane do
        rezerwacji (brak aktywnej rezerwacji w danym pokoju). Przypisz ręcznie lub anuluj.
      </p>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Pokój</th>
              <th className="text-left p-2">Kwota</th>
              <th className="text-left p-2">Pozycje</th>
              <th className="text-left p-2">Źródło</th>
              <th className="text-left p-2">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {charges.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2">
                  {new Date(c.createdAt).toLocaleString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="p-2 font-medium">{c.roomNumber}</td>
                <td className="p-2">{Number(c.amount).toFixed(2)} zł</td>
                <td className="p-2">
                  {c.items?.length ? (
                    <span className="text-xs text-muted-foreground">
                      {c.items.map((it) => `${it.name} x${it.quantity}`).join(", ")}
                    </span>
                  ) : (
                    c.description ?? "—"
                  )}
                </td>
                <td className="p-2 text-xs text-muted-foreground">
                  {c.posSystem ?? "POS"}
                </td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenAssign(c)}
                    >
                      Przypisz
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleCancel(c.id)}
                    >
                      Anuluj
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Przypisz obciążenie do rezerwacji</DialogTitle>
          </DialogHeader>
          {selectedCharge && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm">
                <p>
                  <strong>Pokój:</strong> {selectedCharge.roomNumber}
                </p>
                <p>
                  <strong>Kwota:</strong> {Number(selectedCharge.amount).toFixed(2)} zł
                </p>
                {selectedCharge.items?.length ? (
                  <p>
                    <strong>Pozycje:</strong>{" "}
                    {selectedCharge.items
                      .map((it) => `${it.name} x${it.quantity}`)
                      .join(", ")}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="text-sm font-medium">Wybierz rezerwację:</label>
                <select
                  value={selectedReservationId}
                  onChange={(e) => setSelectedReservationId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">— Wybierz —</option>
                  {reservations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomNumber} · {r.guestName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleAssign}
              disabled={submitting || !selectedReservationId}
            >
              {submitting ? "Przypisywanie…" : "Przypisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
