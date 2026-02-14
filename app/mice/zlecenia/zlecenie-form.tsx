"use client";

import { useState, useMemo } from "react";
import { createEventOrder, updateEventOrder, deleteEventOrder, type EventType } from "@/app/actions/mice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

interface SalaRoom {
  id: string;
  number: string;
  type: string;
}

interface GroupQuoteOption {
  id: string;
  name: string;
}

interface EventOrderRow {
  id: string;
  name: string;
  eventType: string;
  quoteId: string;
  roomIds: string[];
  dateFrom: string;
  dateTo: string;
  status: string;
  notes: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  WEDDING: "Wesele",
  CONFERENCE: "Konferencja",
  BANQUET: "Bankiet",
  OTHER: "Inne",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Szkic",
  CONFIRMED: "Potwierdzone",
  DONE: "Wykonane",
  CANCELLED: "Anulowane",
};

export function ZlecenieForm({
  salaRooms,
  quotes,
  orders,
}: {
  salaRooms: SalaRoom[];
  quotes: GroupQuoteOption[];
  orders: EventOrderRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [eventType, setEventType] = useState<EventType>("OTHER");
  const [status, setStatus] = useState("DRAFT");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<EventOrderRow | null>(null);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const toggleRoom = (id: string) => {
    setSelectedRoomIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const [filterEventType, setFilterEventType] = useState("");
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filterEventType && o.eventType !== filterEventType) return false;
      if (filterStatus && o.status !== filterStatus) return false;
      if (filterDateFrom && o.dateTo < filterDateFrom) return false;
      if (filterDateTo && o.dateFrom > filterDateTo) return false;
      return true;
    });
  }, [orders, filterEventType, filterStatus, filterDateFrom, filterDateTo]);

  const startEdit = (o: EventOrderRow) => {
    setEditingOrder(o);
    setName(o.name);
    setEventType((o.eventType as EventType) || "OTHER");
    setQuoteId(o.quoteId || "");
    setSelectedRoomIds(o.roomIds || []);
    setDateFrom(o.dateFrom);
    setDateTo(o.dateTo);
    setStatus(o.status);
    setNotes(o.notes || "");
    setEditSheetOpen(true);
  };

  const closeEdit = () => {
    setEditSheetOpen(false);
    setEditingOrder(null);
    setName("");
    setEventType("OTHER");
    setQuoteId("");
    setSelectedRoomIds([]);
    setDateFrom("");
    setDateTo("");
    setStatus("DRAFT");
    setNotes("");
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder || !name.trim() || !dateFrom || !dateTo) return;
    setSubmitting(true);
    const r = await updateEventOrder(
      editingOrder.id,
      name.trim(),
      quoteId.trim() || null,
      selectedRoomIds,
      dateFrom,
      dateTo,
      status,
      notes.trim() || null,
      eventType
    );
    setSubmitting(false);
    if (r.success) {
      toast.success("Zlecenie zaktualizowane");
      router.refresh();
      closeEdit();
    } else {
      toast.error(r.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Czy na pewno usunąć to zlecenie?")) return;
    setSubmitting(true);
    const r = await deleteEventOrder(id);
    setSubmitting(false);
    if (r.success) {
      toast.success("Zlecenie usunięte");
      router.refresh();
      if (editingOrder?.id === id) closeEdit();
    } else {
      toast.error(r.error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nazwa zlecenia jest wymagana");
      return;
    }
    if (!dateFrom || !dateTo) {
      toast.error("Wybierz daty");
      return;
    }
    setSubmitting(true);
    const r = await createEventOrder(
      name.trim(),
      quoteId.trim() || null,
      selectedRoomIds,
      dateFrom,
      dateTo,
      status,
      notes.trim() || null,
      eventType
    );
    setSubmitting(false);
    if (r.success) {
      toast.success("Zlecenie utworzone");
      router.refresh();
      setName("");
      setQuoteId("");
      setSelectedRoomIds([]);
      setNotes("");
    } else {
      toast.error(r.error);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-lg border p-6 space-y-4 max-w-2xl">
        <h2 className="text-lg font-semibold">Nowe zlecenie realizacji</h2>

        <div>
          <Label htmlFor="order-name">Nazwa</Label>
          <Input
            id="order-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Sala A – 15.03.2026"
            required
            className="max-w-md"
          />
        </div>

        <div>
          <Label htmlFor="order-eventType">Typ eventu</Label>
          <select
            id="order-eventType"
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventType)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm max-w-md"
          >
            <option value="WEDDING">Wesele</option>
            <option value="CONFERENCE">Konferencja</option>
            <option value="BANQUET">Bankiet</option>
            <option value="OTHER">Inne</option>
          </select>
        </div>

        <div>
          <Label htmlFor="order-quote">Kosztorys (opcjonalnie)</Label>
          <select
            id="order-quote"
            value={quoteId}
            onChange={(e) => setQuoteId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm max-w-md w-full"
          >
            <option value="">— Brak —</option>
            {quotes.map((q) => (
              <option key={q.id} value={q.id}>{q.name}</option>
            ))}
          </select>
        </div>

        <div>
          <Label>Sale (wybierz z listy)</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {salaRooms.map((r) => (
              <label
                key={r.id}
                className="flex items-center gap-2 rounded border px-3 py-2 cursor-pointer hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  checked={selectedRoomIds.includes(r.id)}
                  onChange={() => toggleRoom(r.id)}
                  className="rounded"
                />
                <span className="text-sm">{r.number} ({r.type})</span>
              </label>
            ))}
          </div>
          {salaRooms.length === 0 && (
            <p className="text-sm text-muted-foreground">Brak pokoi typu Sala. Dodaj sale w module Pokoje.</p>
          )}
        </div>

        <div className="flex gap-4">
          <div>
            <Label htmlFor="order-dateFrom">Od</Label>
            <Input
              id="order-dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              required
              className="w-auto"
            />
          </div>
          <div>
            <Label htmlFor="order-dateTo">Do</Label>
            <Input
              id="order-dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              required
              className="w-auto"
            />
          </div>
          <div>
            <Label htmlFor="order-status">Status</Label>
            <select
              id="order-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="DRAFT">Szkic</option>
              <option value="CONFIRMED">Potwierdzone</option>
              <option value="DONE">Wykonane</option>
              <option value="CANCELLED">Anulowane</option>
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="order-notes">Uwagi (opcjonalnie)</Label>
          <textarea
            id="order-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Dodatkowe informacje…"
          />
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? "Zapisywanie…" : "Utwórz zlecenie"}
        </Button>
      </form>

      <div>
        <h3 className="text-sm font-medium mb-2">Lista zleceń</h3>
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="filter-dateFrom" className="text-xs">Data od</Label>
            <Input
              id="filter-dateFrom"
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-auto h-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="filter-dateTo" className="text-xs">Data do</Label>
            <Input
              id="filter-dateTo"
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-auto h-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="filter-eventType" className="text-xs">Typ eventu</Label>
            <select
              id="filter-eventType"
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value)}
              className="h-8 rounded border px-2 text-sm"
            >
              <option value="">Wszystkie</option>
              <option value="WEDDING">Wesele</option>
              <option value="CONFERENCE">Konferencja</option>
              <option value="BANQUET">Bankiet</option>
              <option value="OTHER">Inne</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="filter-status" className="text-xs">Status</Label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-8 rounded border px-2 text-sm"
            >
              <option value="">Wszystkie</option>
              <option value="DRAFT">Szkic</option>
              <option value="CONFIRMED">Potwierdzone</option>
              <option value="DONE">Wykonane</option>
              <option value="CANCELLED">Anulowane</option>
            </select>
          </div>
          {(filterDateFrom || filterDateTo || filterStatus || filterEventType) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterDateFrom("");
                setFilterDateTo("");
                setFilterStatus("");
                setFilterEventType("");
              }}
            >
              Wyczyść filtry
            </Button>
          )}
        </div>
        {filteredOrders.length === 0 ? (
          <p className="text-muted-foreground text-sm">Brak zleceń.</p>
        ) : (
          <ul className="space-y-2">
            {filteredOrders.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-4 rounded border px-4 py-3 text-sm"
              >
                <div className="flex-1">
                  <span className="font-medium">{o.name}</span>
                  <span className="ml-2 text-muted-foreground">
                    {o.dateFrom} – {o.dateTo} · {EVENT_TYPE_LABELS[o.eventType] ?? o.eventType} · {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(o)}
                    disabled={submitting}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(o.id)}
                    disabled={submitting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Sheet open={editSheetOpen} onOpenChange={(open) => !open && closeEdit()}>
        <SheetContent side="right" className="overflow-y-auto w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edytuj zlecenie</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleUpdate} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="edit-name">Nazwa</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-eventType">Typ eventu</Label>
              <select
                id="edit-eventType"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-full mt-1"
              >
                <option value="WEDDING">Wesele</option>
                <option value="CONFERENCE">Konferencja</option>
                <option value="BANQUET">Bankiet</option>
                <option value="OTHER">Inne</option>
              </select>
            </div>
            <div>
              <Label htmlFor="edit-quote">Kosztorys</Label>
              <select
                id="edit-quote"
                value={quoteId}
                onChange={(e) => setQuoteId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-full mt-1"
              >
                <option value="">— Brak —</option>
                {quotes.map((q) => (
                  <option key={q.id} value={q.id}>{q.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Sale</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {salaRooms.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={selectedRoomIds.includes(r.id)}
                      onChange={() => toggleRoom(r.id)}
                      className="rounded"
                    />
                    {r.number}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-4">
              <div>
                <Label htmlFor="edit-dateFrom">Od</Label>
                <Input
                  id="edit-dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  required
                  className="mt-1 w-auto"
                />
              </div>
              <div>
                <Label htmlFor="edit-dateTo">Do</Label>
                <Input
                  id="edit-dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  required
                  className="mt-1 w-auto"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <select
                id="edit-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm mt-1"
              >
                <option value="DRAFT">Szkic</option>
                <option value="CONFIRMED">Potwierdzone</option>
                <option value="DONE">Wykonane</option>
                <option value="CANCELLED">Anulowane</option>
              </select>
            </div>
            <div>
              <Label htmlFor="edit-notes">Uwagi</Label>
              <textarea
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Zapisywanie…" : "Zapisz"}
              </Button>
              <Button type="button" variant="outline" onClick={closeEdit}>
                Anuluj
              </Button>
              {editingOrder && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleDelete(editingOrder.id)}
                  disabled={submitting}
                >
                  Usuń
                </Button>
              )}
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
