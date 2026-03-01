"use client";

import { useState, useEffect, useCallback } from "react";
import { getDocumentHistory } from "@/app/actions/finance";
import { Button } from "@/components/ui/button";
import { History, RefreshCw } from "lucide-react";

export type DocumentEntityType = "Invoice" | "Receipt";

interface DocumentHistoryPanelProps {
  entityType: DocumentEntityType;
  entityId: string;
  title?: string;
  className?: string;
}

export function DocumentHistoryPanel({
  entityType,
  entityId,
  title = "Historia dokumentu",
  className,
}: DocumentHistoryPanelProps) {
  const [entries, setEntries] = useState<
    Array<{
      id: string;
      timestamp: string;
      actionType: string;
      userId: string | null;
      oldValue: Record<string, unknown> | null;
      newValue: Record<string, unknown> | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getDocumentHistory(entityType, entityId);
      if (result.success && result.data) setEntries(result.data);
      else setError("error" in result ? (result.error ?? "Błąd ładowania") : "Błąd ładowania");
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  const actionLabel: Record<string, string> = {
    CREATE: "Utworzono",
    UPDATE: "Zaktualizowano",
    DELETE: "Usunięto",
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <History className="w-4 h-4" />
          {title}
        </h4>
        <Button type="button" variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      {loading && entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Ładowanie…</p>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Brak wpisów w historii.</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto text-xs">
          {entries.map((e) => (
            <li key={e.id} className="border-b border-border/50 pb-2 last:border-0">
              <span className="font-medium">{actionLabel[e.actionType] ?? e.actionType}</span>
              <span className="text-muted-foreground ml-1">
                {new Date(e.timestamp).toLocaleString("pl-PL")}
              </span>
              {e.userId && (
                <span className="text-muted-foreground ml-1">(użytkownik: {e.userId.slice(0, 8)}…)</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
