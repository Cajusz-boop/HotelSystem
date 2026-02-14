"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  getCollectionCases,
  getDebtorsEligibleForCollection,
  createCollectionCase,
  markCollectionCasePaid,
  markCollectionCaseWrittenOff,
  updateCollectionCase,
  type CollectionCaseItem,
  type CollectionStatus,
} from "@/app/actions/collections";
import { COLLECTION_STATUSES } from "@/lib/collections-constants";
import { toast } from "sonner";
import { RefreshCw, Plus, Check, FileWarning } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUS_LABELS: Record<CollectionStatus, string> = {
  IN_COLLECTION: "W windykacji",
  HANDED_TO_AGENCY: "Przekazane do agencji",
  PAID: "Zapłacone",
  WRITTEN_OFF: "Umorzone",
};

export default function WindykacjaPage() {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<CollectionCaseItem[]>([]);
  const [eligible, setEligible] = useState<
    Array<{
      reservationId: string;
      guestName: string;
      roomNumber: string;
      balance: number;
      dueDate: Date;
      daysOverdue: number;
    }>
  >([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [writtenOffDialogOpen, setWrittenOffDialogOpen] = useState<string | null>(null);
  const [writtenOffReason, setWrittenOffReason] = useState("");
  const [statusEditId, setStatusEditId] = useState<string | null>(null);
  const [statusEditValue, setStatusEditValue] = useState<CollectionStatus | "">("");
  const [agencyEditId, setAgencyEditId] = useState<string | null>(null);
  const [agencyEditValue, setAgencyEditValue] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [casesRes, eligibleRes] = await Promise.all([
        getCollectionCases(null),
        getDebtorsEligibleForCollection(null),
      ]);
      if (casesRes.success) setCases(casesRes.data);
      else setCases([]);
      if (eligibleRes.success) setEligible(eligibleRes.data);
      else setEligible([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAddToCollection = async (reservationId: string) => {
    setActionLoading(reservationId);
    try {
      const res = await createCollectionCase(reservationId, null);
      if (res.success) {
        toast.success("Dodano do windykacji");
        setAddDialogOpen(false);
        await load();
      } else {
        toast.error(res.error);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPaid = async (caseId: string) => {
    setActionLoading(caseId);
    try {
      const res = await markCollectionCasePaid(caseId);
      if (res.success) {
        toast.success("Oznaczono jako zapłacone");
        await load();
      } else {
        toast.error(res.error);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkWrittenOff = async (caseId: string) => {
    setActionLoading(caseId);
    try {
      const res = await markCollectionCaseWrittenOff(caseId, writtenOffReason || undefined);
      if (res.success) {
        toast.success("Oznaczono jako umorzone");
        setWrittenOffDialogOpen(null);
        setWrittenOffReason("");
        await load();
      } else {
        toast.error(res.error);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (caseId: string, status: CollectionStatus) => {
    setActionLoading(caseId);
    try {
      const res = await updateCollectionCase(caseId, {
        status,
        ...(status === "HANDED_TO_AGENCY" && { handedOverAt: new Date() }),
      });
      if (res.success) {
        toast.success("Zaktualizowano status");
        setStatusEditId(null);
        await load();
      } else {
        toast.error(res.error);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleAgencySave = async (caseId: string) => {
    setActionLoading(caseId);
    try {
      const res = await updateCollectionCase(caseId, {
        agencyName: agencyEditValue || null,
        ...(agencyEditValue && { status: "HANDED_TO_AGENCY" as CollectionStatus, handedOverAt: new Date() }),
      });
      if (res.success) {
        toast.success("Zapisano agencję");
        setAgencyEditId(null);
        setAgencyEditValue("");
        await load();
      } else {
        toast.error(res.error);
      }
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex gap-2 text-sm text-muted-foreground">
        <Link href="/finance" className="hover:text-foreground">
          Finanse
        </Link>
        <span>/</span>
        <span>Windykacja</span>
      </div>
      <h1 className="text-2xl font-semibold mb-2">Moduł windykacji</h1>
      <p className="text-muted-foreground mb-6">
        Sprawy z zaległymi płatnościami przekazane do windykacji. Możesz dodawać dłużników z listy
        przypomnień, zmieniać status (w windykacji / przekazane do agencji / zapłacone / umorzone).
      </p>

      <div className="mb-4 flex items-center gap-4">
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Odśwież
        </Button>
        {eligible.length > 0 && (
          <Button onClick={() => setAddDialogOpen(true)} variant="default" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Dodaj do windykacji ({eligible.length})
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Ładowanie…</p>
      ) : cases.length === 0 ? (
        <p className="text-muted-foreground">Brak spraw windykacyjnych.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Gość</th>
                <th className="text-left p-3 font-medium">Pokój</th>
                <th className="text-right p-3 font-medium">Saldo (PLN)</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Agencja</th>
                <th className="text-left p-3 font-medium">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-3">{c.guestName}</td>
                  <td className="p-3">{c.roomNumber}</td>
                  <td className="p-3 text-right font-medium">{c.balance.toFixed(2)}</td>
                  <td className="p-3">
                    {statusEditId === c.id ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={statusEditValue}
                          onValueChange={(v) => setStatusEditValue(v as CollectionStatus)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            {COLLECTION_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {STATUS_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={!statusEditValue || actionLoading === c.id}
                          onClick={() =>
                            statusEditValue && handleStatusChange(c.id, statusEditValue)
                          }
                        >
                          Zapisz
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setStatusEditId(null);
                            setStatusEditValue("");
                          }}
                        >
                          Anuluj
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer underline"
                        onClick={() => {
                          setStatusEditId(c.id);
                          setStatusEditValue(c.status);
                        }}
                      >
                        {STATUS_LABELS[c.status]}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {agencyEditId === c.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          className="w-40"
                          value={agencyEditValue}
                          onChange={(e) => setAgencyEditValue(e.target.value)}
                          placeholder="Nazwa agencji"
                        />
                        <Button
                          size="sm"
                          disabled={actionLoading === c.id}
                          onClick={() => handleAgencySave(c.id)}
                        >
                          Zapisz
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAgencyEditId(null);
                            setAgencyEditValue("");
                          }}
                        >
                          Anuluj
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer underline text-muted-foreground"
                        onClick={() => {
                          setAgencyEditId(c.id);
                          setAgencyEditValue(c.agencyName ?? "");
                        }}
                      >
                        {c.agencyName ?? "(dodaj)"}
                      </span>
                    )}
                  </td>
                  <td className="p-3 flex items-center gap-2">
                    {c.status !== "PAID" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === c.id}
                        onClick={() => handleMarkPaid(c.id)}
                        title="Oznacz jako zapłacone"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    {c.status !== "WRITTEN_OFF" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === c.id}
                        onClick={() => setWrittenOffDialogOpen(c.id)}
                        title="Umorzenie"
                      >
                        <FileWarning className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj do windykacji</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Wybierz rezerwację z zaległym saldem (nie będącą jeszcze w windykacji):
          </p>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {eligible.map((e) => (
              <div
                key={e.reservationId}
                className="flex items-center justify-between rounded border p-3 text-sm"
              >
                <div>
                  <span className="font-medium">{e.guestName}</span> – pokój {e.roomNumber},{" "}
                  {e.balance.toFixed(2)} PLN (zaległość {e.daysOverdue} dni)
                </div>
                <Button
                  size="sm"
                  disabled={actionLoading === e.reservationId}
                  onClick={() => handleAddToCollection(e.reservationId)}
                >
                  Dodaj
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={writtenOffDialogOpen !== null}
        onOpenChange={(open) => !open && setWrittenOffDialogOpen(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Umorzenie należności</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Oznacz sprawę jako umorzoną (nieściągalną). Opcjonalnie podaj powód:
          </p>
          <Label htmlFor="written-off-reason">Powód (opcjonalnie)</Label>
          <Input
            id="written-off-reason"
            value={writtenOffReason}
            onChange={(e) => setWrittenOffReason(e.target.value)}
            placeholder="np. upadłość dłużnika, przedawnienie"
            className="mt-1 mb-4"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setWrittenOffDialogOpen(null)}>
              Anuluj
            </Button>
            <Button
              disabled={!writtenOffDialogOpen || actionLoading === writtenOffDialogOpen}
              onClick={() => writtenOffDialogOpen && handleMarkWrittenOff(writtenOffDialogOpen)}
            >
              Umorzenie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
