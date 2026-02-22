"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "pms-onboarding-seen";

export function OnboardingGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setOpen(true);
  }, []);

  const handleClose = () => {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
      <DialogContent className="sm:max-w-md" aria-describedby="onboarding-description">
        <DialogHeader>
          <DialogTitle>Witaj w systemie Hotel Łabędź</DialogTitle>
        </DialogHeader>
        <div id="onboarding-description" className="space-y-3 text-sm text-muted-foreground">
          <p>Krótki przewodnik po systemie:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Panel</strong> – przegląd dnia, KPI, przyjazdy i wyjazdy.</li>
            <li><strong>Recepcja / Grafik</strong> – zarządzanie rezerwacjami w widoku kalendarza (tape chart). Kliknij w komórkę, aby dodać rezerwację.</li>
            <li><strong>Meldunek</strong> – szybki meldunek gościa.</li>
            <li><strong>Goście, Pokoje, Cennik</strong> – słowniki i ustawienia.</li>
            <li><strong>Finanse</strong> – transakcje, faktury, Night Audit.</li>
            <li><strong>Raporty</strong> – raporty dobowe, KPI, eksport do Excel.</li>
          </ul>
          <p>Użyj menu po lewej, aby przejść do wybranej sekcji. Powodzenia!</p>
        </div>
        <DialogFooter>
          <Button onClick={handleClose}>
            Rozumiem, rozpocznij
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
