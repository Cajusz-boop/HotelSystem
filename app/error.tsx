"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-8 bg-background">
      <div className="max-w-md rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-destructive" />
        <h2 className="mb-2 text-lg font-semibold">Wystąpił błąd</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {error.message || "Coś poszło nie tak. Spróbuj odświeżyć stronę."}
        </p>
        <Button size="sm" onClick={() => reset()}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Spróbuj ponownie
        </Button>
      </div>
    </div>
  );
}
