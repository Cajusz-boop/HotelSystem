"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  getStaffAnnouncements,
  createStaffAnnouncement,
  deleteStaffAnnouncement,
  getCanManageAnnouncements,
  type StaffAnnouncementEntry,
} from "@/app/actions/staff-announcements";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Pin } from "lucide-react";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
}

export default function OgloszeniaPage() {
  const [list, setList] = useState<StaffAnnouncementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [isPinned, setIsPinned] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [listRes, permRes] = await Promise.all([
        getStaffAnnouncements({ limit: 50, onlyValid: true }),
        getCanManageAnnouncements(),
      ]);
      if (listRes.success && listRes.data) setList(listRes.data);
      else toast.error(listRes.error || "Błąd ładowania");
      if (permRes.success) setCanManage(permRes.canManage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Tytuł i treść są wymagane");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createStaffAnnouncement({
        title: title.trim(),
        body: body.trim(),
        validUntil: validUntil.trim() || null,
        isPinned,
      });
      if (result.success && result.data) {
        toast.success("Ogłoszenie dodane");
        setTitle("");
        setBody("");
        setValidUntil("");
        setIsPinned(false);
        setFormOpen(false);
        setList((prev) => [result.data!, ...prev]);
      } else {
        toast.error(result.error || "Błąd zapisu");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Usunąć to ogłoszenie?")) return;
    const result = await deleteStaffAnnouncement(id);
    if (result.success) {
      toast.success("Ogłoszenie usunięte");
      setList((prev) => prev.filter((a) => a.id !== id));
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
          <h1 className="text-2xl font-bold">Ogłoszenia wewnętrzne</h1>
        </div>
        {canManage && (
          <Button onClick={() => setFormOpen((v) => !v)}>
            <Plus className="w-4 h-4 mr-2" />
            {formOpen ? "Anuluj" : "Nowe ogłoszenie"}
          </Button>
        )}
      </div>

      <p className="text-muted-foreground mb-6">
        Ogłoszenia dla personelu – informacje, przypomnienia, zmiany.
      </p>

      {formOpen && canManage && (
        <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-4 mb-6 space-y-3">
          <div>
            <Label>Tytuł *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tytuł ogłoszenia" required />
          </div>
          <div>
            <Label>Treść *</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Treść..." rows={4} required className="resize-none" />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-1">
              <Label>Ważne do (opcjonalnie)</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="max-w-[180px]" />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="pinned" checked={isPinned} onCheckedChange={setIsPinned} />
              <Label htmlFor="pinned">Przypięte (na górze)</Label>
            </div>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Zapisywanie…" : "Opublikuj"}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="text-muted-foreground">Ładowanie…</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground">Brak ogłoszeń.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((a) => (
            <li key={a.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {a.isPinned && <Pin className="w-4 h-4 text-amber-500 shrink-0" />}
                    <h2 className="font-semibold">{a.title}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(a.createdAt)}
                    {a.authorName && ` • ${a.authorName}`}
                    {a.validUntil && ` • ważne do ${a.validUntil}`}
                  </p>
                  <div className="mt-2 whitespace-pre-wrap text-sm">{a.body}</div>
                </div>
                {canManage && (
                  <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
