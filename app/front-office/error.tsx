"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function FrontOfficeErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[FrontOffice Error]", error);
  }, [error]);

  const isSessionExpired =
    error.message?.toLowerCase().includes("unauthorized") ||
    error.message?.toLowerCase().includes("session") ||
    error.message?.toLowerCase().includes("401");

  return (
    <div className="flex flex-col h-screen items-center justify-center p-8 bg-background">
      <div className="max-w-md rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-destructive" />
        <h2 className="mb-2 text-lg font-semibold">
          {isSessionExpired ? "Sesja wygasła" : "Wystąpił błąd"}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {isSessionExpired
            ? "Twoja sesja wygasła po dłuższej nieaktywności. Odśwież stronę aby kontynuować."
            : "Coś poszło nie tak. Spróbuj odświeżyć stronę."}
        </p>
        {error.digest && (
          <p className="mb-4 text-xs text-muted-foreground font-mono">
            Kod: {error.digest}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <Home className="mr-1 h-4 w-4" />
              Panel
            </Link>
          </Button>
          <Button size="sm" onClick={() => reset()}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Spróbuj ponownie
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.location.reload()}
          >
            Odśwież stronę
          </Button>
        </div>
      </div>
    </div>
  );
}
