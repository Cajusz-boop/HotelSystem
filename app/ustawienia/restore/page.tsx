"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Database } from "lucide-react";

export default function RestorePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Wybierz plik SQL");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/restore?confirm=restore", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || data.detail || "Błąd przywracania");
        return;
      }
      toast.success("Przywracanie zakończone. Odśwież aplikację.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Przywracanie z kopii</h1>
        </div>
        <Link href="/ustawienia">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Button>
        </Link>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Przywrócenie bazy zastąpi bieżące dane zawartością pliku SQL. Wymaga klienta mysql w systemie. Użyj pliku wcześniej pobranego z „Kopia zapasowa bazy”.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Plik SQL</label>
          <input
            type="file"
            accept=".sql,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
        </div>
        <Button type="submit" variant="destructive" disabled={loading}>
          {loading ? "Przywracanie…" : "Przywróć bazę"}
        </Button>
      </form>
    </div>
  );
}
