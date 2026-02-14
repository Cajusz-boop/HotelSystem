"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getHotelEvents,
  createHotelEvent,
  deleteHotelEvent,
  EVENT_TYPE_LABELS,
  type HotelEventEntry,
  type HotelEventType,
} from "@/app/actions/hotel-events";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, ChevronLeft, ChevronRight, Calendar } from "lucide-react";

function getMonthRange(year: number, month: number): { from: string; to: string } {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function WydarzeniaPage() {
  const [now] = useState(() => new Date());
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<HotelEventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [eventType, setEventType] = useState<HotelEventType>("OTHER");
  const [description, setDescription] = useState("");

  const { from, to } = getMonthRange(year, month);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getHotelEvents({ fromDate: from, toDate: to, limit: 100 });
      if (result.success && result.data) {
        setEvents(result.data);
      } else {
        toast.error(result.error || "Błąd ładowania");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [from, to]);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const monthName = new Date(year, month - 1, 1).toLocaleDateString("pl-PL", {
    month: "long",
    year: "numeric",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Podaj tytuł");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createHotelEvent({
        title: title.trim(),
        startDate: startDate || new Date().toISOString().slice(0, 10),
        endDate: endDate.trim() || null,
        eventType,
        description: description.trim() || null,
      });
      if (result.success && result.data) {
        toast.success("Wydarzenie dodane");
        setTitle("");
        setStartDate("");
        setEndDate("");
        setEventType("OTHER");
        setDescription("");
        setFormOpen(false);
        setEvents((prev) => [...prev, result.data!].sort((a, b) => a.startDate.localeCompare(b.startDate)));
      } else {
        toast.error(result.error || "Błąd zapisu");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Usunąć to wydarzenie?")) return;
    const result = await deleteHotelEvent(id);
    if (result.success) {
      toast.success("Wydarzenie usunięte");
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } else {
      toast.error(result.error || "Błąd usunięcia");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Kalendarz wydarzeń hotelowych</h1>
        </div>
        <Button onClick={() => setFormOpen((v) => !v)}>
          <Plus className="w-4 h-4 mr-2" />
          {formOpen ? "Anuluj" : "Dodaj wydarzenie"}
        </Button>
      </div>

      <p className="text-muted-foreground mb-6">
        Konferencje, wesela, konserwacja, święta – wydarzenia w kalendarzu obiektu.
      </p>

      {formOpen && (
        <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-4 mb-6 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Tytuł *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="np. Konferencja Q1" required />
            </div>
            <div className="space-y-1">
              <Label>Typ</Label>
              <Select value={eventType} onValueChange={(v) => setEventType(v as HotelEventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(EVENT_TYPE_LABELS) as [HotelEventType, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Data rozpoczęcia *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Data zakończenia (opcjonalnie)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Opis (opcjonalnie)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="resize-none" />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Zapisywanie…" : "Zapisz wydarzenie"}
          </Button>
        </form>
      )}

      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="flex items-center gap-2 font-semibold capitalize min-w-[200px] justify-center">
          <Calendar className="w-5 h-5" />
          {monthName}
        </h2>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Ładowanie…</p>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground">Brak wydarzeń w tym miesiącu.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
              <div>
                <span className="font-medium">{e.title}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {EVENT_TYPE_LABELS[e.eventType]} • {e.startDate}
                  {e.endDate && e.endDate !== e.startDate ? ` – ${e.endDate}` : ""}
                </span>
                {e.description && (
                  <p className="text-sm text-muted-foreground mt-1">{e.description}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(e.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
