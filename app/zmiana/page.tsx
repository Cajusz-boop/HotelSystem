"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getShiftHandovers,
  createShiftHandover,
  type ShiftHandoverEntry,
} from "@/app/actions/shift-handover";
import { toast } from "sonner";
import { ArrowLeft, Send, RefreshCw } from "lucide-react";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function ZmianaPage() {
  const [list, setList] = useState<ShiftHandoverEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const [shiftDate, setShiftDate] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const result = await getShiftHandovers({ limit: 50 });
      if (result.success && result.data) {
        setList(result.data);
      } else {
        toast.error(result.error || "Błąd ładowania");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error("Wpisz treść przekazania");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createShiftHandover({
        content: content.trim(),
        shiftDate: shiftDate.trim() || null,
      });
      if (result.success && result.data) {
        toast.success("Przekazanie zapisane");
        setContent("");
        setShiftDate("");
        setList((prev) => [result.data!, ...prev]);
      } else {
        toast.error(result.error || "Błąd zapisu");
      }
    } finally {
      setSubmitting(false);
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
          <h1 className="text-2xl font-bold">Zmiana zmiany (shift handover)</h1>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Odśwież
        </Button>
      </div>

      <p className="text-muted-foreground mb-6">
        Notatki przekazywane z jednej zmiany na drugą: przyjazdy, wyjazdy, VIP, uwagi, problemy.
      </p>

      <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-4 mb-6 space-y-3">
        <div>
          <Label htmlFor="shiftDate">Data zmiany (opcjonalnie)</Label>
          <Input
            id="shiftDate"
            type="date"
            value={shiftDate}
            onChange={(e) => setShiftDate(e.target.value)}
            className="mt-1 max-w-[180px]"
          />
        </div>
        <div>
          <Label htmlFor="content">Treść przekazania *</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="np. VIP w 101, późne wymeldowanie 14:00. Pokój 205 – usterka klimatyzacji, serwis jutro. Przyjazdy: Kowalski 18:00."
            rows={5}
            required
            className="mt-1 resize-none"
          />
        </div>
        <Button type="submit" disabled={submitting || !content.trim()}>
          <Send className="w-4 h-4 mr-2" />
          {submitting ? "Zapisywanie…" : "Zapisz przekazanie"}
        </Button>
      </form>

      <div className="space-y-3">
        <h2 className="font-semibold">Ostatnie przekazania</h2>
        {loading ? (
          <p className="text-muted-foreground">Ładowanie…</p>
        ) : list.length === 0 ? (
          <p className="text-muted-foreground">Brak przekazań. Dodaj pierwsze.</p>
        ) : (
          <ul className="space-y-3">
            {list.map((h) => (
              <li
                key={h.id}
                className="rounded-lg border bg-card p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-2">
                  <span>{formatDateTime(h.createdAt)}</span>
                  {h.authorName && <span>• {h.authorName}</span>}
                  {h.shiftDate && <span>• zmiana: {h.shiftDate}</span>}
                </div>
                <div className="whitespace-pre-wrap text-sm">{h.content}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
