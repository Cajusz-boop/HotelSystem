"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function FrontOfficeError({
  title,
  message,
  hint,
}: {
  title: string;
  message: string;
  hint?: string;
}) {
  return (
    <div className="max-w-md rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
      <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-destructive" />
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{message}</p>
      {hint && (
        <p className="mb-4 text-xs text-muted-foreground">{hint}</p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/">Panel</Link>
        </Button>
        <Button
          size="sm"
          onClick={() => typeof window !== "undefined" && window.location.reload()}
        >
          Odśwież stronę
        </Button>
      </div>
    </div>
  );
}
