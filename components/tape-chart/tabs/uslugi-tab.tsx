"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function UslugiTab() {
  return (
    <div className="space-y-4 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/5 p-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-2xl" aria-hidden>🚧</span>
        <span className="text-sm font-medium">W budowie</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Tutaj będzie lista usług dodatkowych (parking, spa, wypożyczenie roweru, itp.)
      </p>
      <Button type="button" variant="outline" size="sm" disabled>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Dodaj usługę
      </Button>
    </div>
  );
}
