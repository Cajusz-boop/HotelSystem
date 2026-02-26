"use client";

export function WlasneTab() {
  return (
    <div className="space-y-4 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/5 p-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-2xl" aria-hidden>🚧</span>
        <span className="text-sm font-medium">W budowie</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Pola definiowane przez użytkownika (np. VIP, Źródło kampanii, Notatka sprzedaży).
      </p>
    </div>
  );
}
