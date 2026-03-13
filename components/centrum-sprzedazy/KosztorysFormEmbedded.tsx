"use client";

import { useState, useEffect, useCallback } from "react";
import {
  createGroupQuote,
  updateGroupQuote,
  type GroupQuoteItem,
  type GroupQuoteMeta,
} from "@/app/actions/mice";
import { recalcGroupQuoteItem } from "@/lib/mice-quote-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

const VAT_OPTS = [0, 5, 8, 23];

const emptyItem = (): GroupQuoteItem =>
  recalcGroupQuoteItem({
    name: "",
    unit: "szt",
    quantity: 1,
    unitPriceNet: 0,
    vatRate: 8,
  });

function migrateLegacyItem(raw: Record<string, unknown>): GroupQuoteItem {
  const qty = Number(raw.quantity ?? 1) || 0;
  const unitPriceNet = Number(raw.unitPriceNet ?? raw.unitPrice ?? 0) || 0;
  const vatRate = Number(raw.vatRate ?? 8) || 0;
  return recalcGroupQuoteItem({
    name: String(raw.name ?? ""),
    unit: String(raw.unit ?? "szt"),
    quantity: qty,
    unitPriceNet,
    vatRate,
  });
}

interface GroupQuoteForForm {
  id: string;
  name: string;
  validUntil: string | null;
  totalAmount: number | null;
  items: GroupQuoteItem[] | null;
  clientName?: string | null;
  clientNip?: string | null;
  eventDate?: string | null;
  depositAmount?: number | null;
  notes?: string | null;
}

function toGroupQuoteForForm(raw: Record<string, unknown>): GroupQuoteForForm {
  const rawItems = raw.items;
  let items: GroupQuoteItem[] | null = null;
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    items = (rawItems as Record<string, unknown>[]).map((it) => migrateLegacyItem(it));
  }
  const validUntil = raw.validUntil ? new Date(raw.validUntil as string).toISOString().slice(0, 10) : null;
  const eventDate = raw.eventDate ? new Date(raw.eventDate as string).toISOString().slice(0, 10) : null;
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    validUntil,
    totalAmount: raw.totalAmount != null ? Number(raw.totalAmount) : null,
    items,
    clientName: raw.clientName != null ? String(raw.clientName) : null,
    clientNip: raw.clientNip != null ? String(raw.clientNip) : null,
    eventDate,
    depositAmount: raw.depositAmount != null ? Number(raw.depositAmount) : null,
    notes: raw.notes != null ? String(raw.notes) : null,
  };
}

interface KosztorysFormEmbeddedProps {
  eventId: string;
  quoteId: string | null;
  eventDisplay: { client: string | null; date: string; type: string };
  availableQuotes: { id: string; name: string }[];
  defaultName: string;
  onSaved: () => void;
  showToast: (msg: string, type?: string) => void;
}

export function KosztorysFormEmbedded({
  eventId,
  quoteId,
  eventDisplay,
  availableQuotes,
  defaultName,
  onSaved,
  showToast,
}: KosztorysFormEmbeddedProps) {
  const [quote, setQuote] = useState<GroupQuoteForForm | null>(null);
  const [loading, setLoading] = useState(!!quoteId);
  const [name, setName] = useState(defaultName);
  const [validUntil, setValidUntil] = useState("");
  const [clientName, setClientName] = useState(eventDisplay.client ?? "");
  const [clientNip, setClientNip] = useState("");
  const [eventDate, setEventDate] = useState(eventDisplay.date ? eventDisplay.date.slice(0, 10) : "");
  const [depositAmount, setDepositAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<GroupQuoteItem[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");

  const loadQuote = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/mice/kosztorysy");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      const found = list.find((q: { id?: string }) => String(q?.id) === id);
      if (found) {
        const q = toGroupQuoteForForm(found);
        setQuote(q);
        setName(q.name);
        setValidUntil(q.validUntil ? q.validUntil : "");
        setClientName(q.clientName ?? eventDisplay.client ?? "");
        setClientNip(q.clientNip ?? "");
        setEventDate(q.eventDate ? q.eventDate : eventDisplay.date ? eventDisplay.date.slice(0, 10) : "");
        setDepositAmount(q.depositAmount != null ? String(q.depositAmount) : "");
        setNotes(q.notes ?? "");
        let parsedItems: GroupQuoteItem[] = [];
        if (Array.isArray(q.items) && q.items.length > 0) {
          parsedItems = q.items;
        }
        setItems(parsedItems.length > 0 ? parsedItems : [emptyItem()]);
      } else {
        setQuote(null);
      }
    } catch {
      showToast("Błąd ładowania kosztorysu", "err");
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [eventDisplay.client, eventDisplay.date, showToast]);

  useEffect(() => {
    if (quoteId) {
      loadQuote(quoteId);
    } else {
      setQuote(null);
      setName(defaultName);
      setValidUntil("");
      setClientName(eventDisplay.client ?? "");
      setClientNip("");
      setEventDate(eventDisplay.date ? eventDisplay.date.slice(0, 10) : "");
      setDepositAmount("");
      setNotes("");
      setItems([emptyItem()]);
      setLoading(false);
    }
  }, [quoteId, defaultName, eventDisplay.client, eventDisplay.date, loadQuote]);

  const updateItem = useCallback((index: number, field: keyof GroupQuoteItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const it = { ...next[index], [field]: value };
      const recalc = recalcGroupQuoteItem(it);
      next[index] = recalc;
      return next;
    });
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, emptyItem()]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const totals = items.reduce(
    (acc, it) => ({
      net: acc.net + it.netAmount,
      vat: acc.vat + it.vatAmount,
      gross: acc.gross + it.grossAmount,
    }),
    { net: 0, vat: 0, gross: 0 }
  );
  const deposit = parseFloat(depositAmount) || 0;
  const toPay = totals.gross - deposit;

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/mice/kosztorysy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: defaultName }),
      });
      if (!res.ok) throw new Error("Błąd tworzenia");
      const created = await res.json();
      const patchRes = await fetch(`/api/event-orders/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: created.id }),
      });
      if (!patchRes.ok) throw new Error("Błąd powiązania");
      onSaved();
      showToast("Kosztorys utworzony");
      const q = toGroupQuoteForForm(created);
      setQuote(q);
      setName(q.name);
      setValidUntil(q.validUntil ?? "");
      setClientName(q.clientName ?? eventDisplay.client ?? "");
      setClientNip(q.clientNip ?? "");
      setEventDate(q.eventDate ?? eventDisplay.date?.slice(0, 10) ?? "");
      setDepositAmount(q.depositAmount != null ? String(q.depositAmount) : "");
      setNotes(q.notes ?? "");
      setItems(q.items && q.items.length > 0 ? q.items : [emptyItem()]);
    } catch {
      showToast("Błąd tworzenia kosztorysu", "err");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLink = async () => {
    if (!selectedQuoteId) return;
    setSubmitting(true);
    try {
      const patchRes = await fetch(`/api/event-orders/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: selectedQuoteId }),
      });
      if (!patchRes.ok) throw new Error("Błąd powiązania");
      onSaved();
      showToast("Kosztorys powiązany");
      setSelectedQuoteId("");
    } catch {
      showToast("Błąd powiązania kosztorysu", "err");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm("Odłączyć kosztorys od imprezy?")) return;
    setSubmitting(true);
    try {
      const patchRes = await fetch(`/api/event-orders/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: null }),
      });
      if (!patchRes.ok) throw new Error("Błąd");
      onSaved();
      showToast("Kosztorys odłączony");
      setQuote(null);
      setName(defaultName);
      setValidUntil("");
      setClientName(eventDisplay.client ?? "");
      setClientNip("");
      setEventDate(eventDisplay.date ? eventDisplay.date.slice(0, 10) : "");
      setDepositAmount("");
      setNotes("");
      setItems([emptyItem()]);
    } catch {
      showToast("Błąd", "err");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote) return;
    const cleanItems = items
      .filter((it) => it.name.trim())
      .map((it) => recalcGroupQuoteItem(it));
    const itemsToSend = cleanItems.length > 0 ? cleanItems : null;
    const meta: GroupQuoteMeta = {
      clientName: clientName.trim() || null,
      clientNip: clientNip.trim() || null,
      eventDate: eventDate.trim() || null,
      depositAmount: parseFloat(depositAmount) || null,
      notes: notes.trim() || null,
    };
    setSubmitting(true);
    const r = await updateGroupQuote(quote.id, name.trim(), validUntil.trim() || null, itemsToSend, meta);
    setSubmitting(false);
    if (r.success) {
      showToast("Kosztorys zapisany");
      onSaved();
      setQuote((prev) => (prev ? { ...prev, name: name.trim(), items: itemsToSend, totalAmount: totals.gross } : null));
    } else {
      showToast(r.error ?? "Błąd zapisu", "err");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
        Ładowanie kosztorysu…
      </div>
    );
  }

  if (!quote) {
    return (
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ fontSize: "12px", fontWeight: 900, color: "#111827", letterSpacing: "2px", marginBottom: "4px" }}>KOSZTORYS</div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={handleCreate}
            disabled={submitting}
            style={{ background: "white", border: "1px solid #3b82f6", borderRadius: "6px", padding: "10px 18px", fontSize: "15px", fontWeight: 600, color: "#1e40af", cursor: submitting ? "not-allowed" : "pointer" }}
          >
            Utwórz kosztorys
          </button>
        </div>
        {availableQuotes.length > 0 && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "14px", color: "#64748b", fontWeight: 500 }}>Powiąż istniejący:</span>
            <select
              value={selectedQuoteId}
              onChange={(e) => setSelectedQuoteId(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "14px", minWidth: "240px" }}
            >
              <option value="">— wybierz kosztorys —</option>
              {availableQuotes.map((q) => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
            <button
              onClick={handleLink}
              disabled={!selectedQuoteId || submitting}
              style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", padding: "8px 18px", fontSize: "14px", fontWeight: 600, cursor: selectedQuoteId && !submitting ? "pointer" : "not-allowed", opacity: selectedQuoteId && !submitting ? 1 : 0.6 }}
            >
              Powiąż
            </button>
          </div>
        )}
        <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Utwórz nowy kosztorys lub powiąż istniejący z tą imprezą.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ fontSize: "12px", fontWeight: 900, color: "#1e40af", letterSpacing: "1px" }}>KOSZTORYS</div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={() => window.open(`/api/event-orders/${eventId}/rozliczenie`, "_blank")}
            style={{ background: "#1e40af", color: "white", border: "none", borderRadius: "6px", padding: "8px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
          >
            📋 Drukuj rozliczenie
          </button>
          <button
            onClick={handleUnlink}
            disabled={submitting}
            style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 14px", fontSize: "13px", color: "#64748b", cursor: submitting ? "not-allowed" : "pointer" }}
          >
            Odłącz od imprezy
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <Label htmlFor="q-name" style={{ fontSize: "12px", fontWeight: 600 }}>Nazwa kosztorysu</Label>
            <Input
              id="q-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Konferencja Q1"
              required
              className="h-9"
            />
          </div>
          <div>
            <Label htmlFor="q-valid" style={{ fontSize: "12px", fontWeight: 600 }}>Ważny do</Label>
            <Input id="q-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-9" />
          </div>
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", background: "#f9fafb" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "#374151" }}>Dane klienta</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <Label htmlFor="q-client" style={{ fontSize: "11px" }}>Nazwa</Label>
              <Input id="q-client" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="np. Firma XY" className="h-8 text-sm" />
            </div>
            <div>
              <Label htmlFor="q-nip" style={{ fontSize: "11px" }}>NIP</Label>
              <Input id="q-nip" value={clientNip} onChange={(e) => setClientNip(e.target.value)} placeholder="0000000000" className="h-8 text-sm" />
            </div>
            <div>
              <Label htmlFor="q-edate" style={{ fontSize: "11px" }}>Data imprezy</Label>
              <Input id="q-edate" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label htmlFor="q-dep" style={{ fontSize: "11px" }}>Zaliczka (PLN)</Label>
              <Input id="q-dep" type="number" min={0} step={0.01} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0" className="h-8 text-sm" />
            </div>
          </div>
          <div style={{ marginTop: "8px" }}>
            <Label htmlFor="q-notes" style={{ fontSize: "11px" }}>Uwagi</Label>
            <Textarea id="q-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="np. posiłki gratis" rows={2} className="text-sm min-h-[60px]" />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <Label style={{ fontSize: "12px", fontWeight: 600 }}>Pozycje</Label>
            <Button type="button" size="sm" variant="outline" onClick={addItem} className="h-8">
              <Plus className="h-3.5 w-3.5 mr-1" /> Dodaj
            </Button>
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "6px" }}>
            <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>Nazwa</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", width: 50 }}>Jedn.</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", width: 55 }}>Ilość</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", width: 75 }}>Cena netto</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", width: 55 }}>VAT %</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", width: 85 }}>Netto</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", width: 75 }}>VAT</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", width: 85, fontWeight: 600 }}>Brutto</th>
                  <th style={{ width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "4px" }}>
                      <Input placeholder="Nazwa" value={it.name} onChange={(e) => updateItem(i, "name", e.target.value)} className="h-7 text-xs border-0 bg-transparent focus-visible:ring-1" />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <Input placeholder="szt" value={it.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} className="h-7 text-xs w-full min-w-[40px]" />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <Input type="number" min={0} step={1} value={it.quantity || ""} onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)} className="h-7 text-xs text-right" />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <Input type="number" min={0} step={0.01} value={it.unitPriceNet || ""} onChange={(e) => updateItem(i, "unitPriceNet", parseFloat(e.target.value) || 0)} className="h-7 text-xs text-right" />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <select
                        value={it.vatRate}
                        onChange={(e) => updateItem(i, "vatRate", parseInt(e.target.value, 10) || 8)}
                        style={{ height: 28, width: "100%", fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 4 }}
                      >
                        {VAT_OPTS.map((v) => (
                          <option key={v} value={v}>{v}%</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{it.netAmount.toFixed(2)}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{it.vatAmount.toFixed(2)}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{it.grossAmount.toFixed(2)}</td>
                    <td style={{ padding: "4px" }}>
                      <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeItem(i)} disabled={items.length <= 1}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: "12px", padding: "10px 14px", background: "#f9fafb", borderRadius: "6px", display: "flex", flexDirection: "column", gap: "4px", maxWidth: 280, marginLeft: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#64748b" }}>Suma netto:</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{totals.net.toFixed(2)} PLN</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#64748b" }}>Suma VAT:</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{totals.vat.toFixed(2)} PLN</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
              <span>Suma brutto:</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{totals.gross.toFixed(2)} PLN</span>
            </div>
            {deposit > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderTop: "1px solid #e5e7eb", paddingTop: 6, marginTop: 4 }}>
                  <span style={{ color: "#64748b" }}>Zaliczka:</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>-{deposit.toFixed(2)} PLN</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                  <span>Do zapłaty:</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{toPay.toFixed(2)} PLN</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <Button type="submit" disabled={submitting || !name.trim()} size="sm">
            {submitting ? "Zapisywanie…" : "Zapisz kosztorys"}
          </Button>
        </div>
      </form>
    </div>
  );
}
