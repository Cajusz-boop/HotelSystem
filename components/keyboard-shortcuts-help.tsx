"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: "Ctrl+K / Cmd+K", description: "Paleta poleceń (szukaj gościa, pokoju, akcje)" },
  { keys: "N", description: "Nowa rezerwacja (na stronie Grafik)" },
  { keys: "Enter", description: "Otwórz rezerwację w zaznaczonej komórce lub nowa (Grafik)" },
  { keys: "I", description: "Zamelduj (check-in) w zaznaczonej komórce (Grafik)" },
  { keys: "O", description: "Wymelduj (check-out) w zaznaczonej komórce (Grafik)" },
  { keys: "?", description: "Pokaż skróty klawiszowe" },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
        if (!isInput) {
          e.preventDefault();
          setOpen((o) => !o);
        }
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md" aria-describedby="shortcuts-description">
        <DialogHeader>
          <DialogTitle>Skróty klawiszowe</DialogTitle>
        </DialogHeader>
        <div id="shortcuts-description" className="space-y-2">
          {SHORTCUTS.map(({ keys, description }) => (
            <div key={keys} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{description}</span>
              <kbd className="rounded border border-border bg-muted px-2 py-1 font-mono text-xs">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
