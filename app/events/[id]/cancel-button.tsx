"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CancelEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();

  const handleCancel = async () => {
    if (!confirm("Czy na pewno anulować tę imprezę?")) return;
    try {
      const res = await fetch(`/api/event-orders/${eventId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Błąd anulowania");
      }
      toast.success("Impreza anulowana");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd anulowania");
    }
  };

  return (
    <Button
      variant="outline"
      className="h-12 text-base border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
      onClick={handleCancel}
    >
      Anuluj imprezę
    </Button>
  );
}
