"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { setupTrainingDemo, cleanupTrainingDemo } from "@/app/actions/training-demo";
import { toast } from "sonner";
import {
  GraduationCap,
  Sparkles,
  Trash2,
  Calendar,
  Users,
  Banknote,
  LayoutDashboard,
  BedDouble,
  ClipboardList,
} from "lucide-react";

export default function TrainingPage() {
  const [loading, setLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [confirmSetupOpen, setConfirmSetupOpen] = useState(false);
  const [confirmCleanupOpen, setConfirmCleanupOpen] = useState(false);

  const handleSetup = async () => {
    setConfirmSetupOpen(false);
    setLoading(true);
    try {
      const result = await setupTrainingDemo();
      if (result.success) {
        toast.success(
          `Dane demo utworzone: ${result.created.guests} gości, ${result.created.reservations} rezerwacji, ${result.created.transactions} transakcji`
        );
      } else {
        toast.error(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    setConfirmCleanupOpen(false);
    setCleanupLoading(true);
    try {
      const result = await cleanupTrainingDemo();
      if (result.success) {
        toast.success(`Usunięto: ${result.removed.reservations} rezerwacji, ${result.removed.transactions} transakcji`);
      } else {
        toast.error(result.error);
      }
    } finally {
      setCleanupLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 bg-muted/30">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="flex items-center justify-center gap-2 text-2xl font-bold">
            <GraduationCap className="h-8 w-8 text-primary" />
            Tryb demo szkoleniowy
          </h1>
          <p className="text-muted-foreground">
            Przygotuj przykładowe dane do szkoleń i screenshotów. Utworzone zostaną goście, rezerwacje, statusy pokoi i płatności.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-6">
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Przygotuj dane szkoleniowe
          </h2>
          <p className="text-sm text-muted-foreground">
            Utworzy m.in.: 10 gości (w tym VIP i na czarnej liście), 12 rezerwacji z różnymi statusami (CONFIRMED, CHECKED_IN, CHECKED_OUT, PENDING, CANCELLED, NO_SHOW),
            zróżnicowane statusy pokoi (CLEAN, DIRTY, OOO, INSPECTION, MAINTENANCE) oraz przykładowe płatności.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => setConfirmSetupOpen(true)}
              disabled={loading}
            >
              {loading ? "Tworzenie…" : "Utwórz dane demo"}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-6">
          <h2 className="font-semibold flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            Usuń dane demo
          </h2>
          <p className="text-sm text-muted-foreground">
            Usuwa rezerwacje i transakcje oznaczone jako demo. Goście bez innych rezerwacji zostaną usunięci. Statusy pokoi (OOO, MAINTENANCE) z powodem „demo” zostaną przywrócone do CLEAN.
          </p>
          <Button
            variant="destructive"
            onClick={() => setConfirmCleanupOpen(true)}
            disabled={cleanupLoading}
          >
            {cleanupLoading ? "Usuwanie…" : "Usuń dane demo"}
          </Button>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4">Szybki dostęp — ekrany do screenshotów</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/front-office">
              <Button variant="outline" className="w-full justify-start gap-2">
                <BedDouble className="h-4 w-4" />
                Grafik rezerwacji (Tape Chart)
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full justify-start gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Link href="/kontrahenci?tab=goscie">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Users className="h-4 w-4" />
                Lista gości
              </Button>
            </Link>
            <Link href="/ksiega-meldunkowa">
              <Button variant="outline" className="w-full justify-start gap-2">
                <ClipboardList className="h-4 w-4" />
                Księga meldunkowa
              </Button>
            </Link>
            <Link href="/housekeeping">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Sparkles className="h-4 w-4" />
                Housekeeping
              </Button>
            </Link>
            <Link href="/finance">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Banknote className="h-4 w-4" />
                Finanse
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmSetupOpen} onOpenChange={setConfirmSetupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Utworzyć dane demo?</AlertDialogTitle>
            <AlertDialogDescription>
              Zostaną utworzone przykładowi goście, rezerwacje, transakcje oraz zmienione statusy części pokoi.
              Dane są oznaczone prefiksem [DEMO-SZKOLENIE] i można je później usunąć przyciskiem „Usuń dane demo”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleSetup}>Utwórz</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCleanupOpen} onOpenChange={setConfirmCleanupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć dane demo?</AlertDialogTitle>
            <AlertDialogDescription>
              Zostaną usunięte rezerwacje i transakcje oznaczone jako demo. Goście demo bez innych rezerwacji zostaną usunięci.
              Statusy pokoi (OOO, MAINTENANCE) z powodem „demo” zostaną przywrócone do CLEAN.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
