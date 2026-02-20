"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createRoomBlock, deleteRoomBlock } from "@/app/actions/rooms";
import type { Room, RoomBlock } from "@/lib/tape-chart-types";

export interface RoomBlockSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  /** Pokój do wstępnego wyboru (np. z menu kontekstowego) */
  initialRoomNumber?: string | null;
  onCreated?: (block: RoomBlock) => void;
  onDeleted?: (blockId: string) => void;
}

export function RoomBlockSheet({
  open,
  onOpenChange,
  rooms,
  initialRoomNumber,
  onCreated,
  onDeleted,
}: RoomBlockSheetProps) {
  const [roomNumber, setRoomNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const preferred = initialRoomNumber && rooms.some((r) => r.number === initialRoomNumber)
        ? initialRoomNumber
        : rooms[0]?.number ?? "";
      setRoomNumber(preferred);
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      setStartDate(todayStr);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      setEndDate(tomorrow.toISOString().slice(0, 10));
      setReason("");
      setDeleteId(null);
      setError(null);
    }
  }, [open, rooms, initialRoomNumber]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await createRoomBlock({
      roomNumber: roomNumber.trim(),
      startDate,
      endDate,
      reason: reason.trim() || undefined,
    });
    setSaving(false);
    if (!result.success) {
      setError("error" in result ? (result.error ?? "Nie udało się dodać blokady.") : "Nie udało się dodać blokady.");
      return;
    }
    toast.success("Pokój zablokowany w wybranym okresie.");
    onCreated?.({
      id: result.data!.id,
      roomNumber: result.data!.roomNumber,
      startDate: result.data!.startDate,
      endDate: result.data!.endDate,
      reason: result.data!.reason,
    });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    const result = await deleteRoomBlock(deleteId);
    setSaving(false);
    if (!result.success) {
      toast.error("error" in result ? (result.error ?? "Nie udało się usunąć blokady.") : "Nie udało się usunąć blokady.");
      return;
    }
    toast.success("Blokada usunięta.");
    onDeleted?.(deleteId);
    setDeleteId(null);
  };

  const selectedRoom = rooms.find((r) => r.number === roomNumber);
  const existingBlocks = selectedRoom?.blocks ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px]">
        <SheetHeader>
          <SheetTitle>Wyłącz pokój (OOO)</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleCreate} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>Pokój</Label>
            <select
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {rooms.map((room) => (
                <option key={room.number} value={room.number}>
                  {room.number} · {room.type}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Od</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Do</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Powód (opcjonalnie)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Remont / awaria" />
          </div>
          {existingBlocks.length > 0 && (
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <p className="text-sm font-medium">Istniejące blokady</p>
              <ul className="space-y-1 text-sm">
                {existingBlocks.map((block) => (
                  <li key={block.id} className="flex items-center justify-between gap-2">
                    <span>
                      {block.startDate} – {block.endDate}
                      {block.reason ? ` · ${block.reason}` : ""}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteId(block.id)}
                    >
                      Usuń
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="flex flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Zamknij
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Zapisywanie…" : "Zablokuj pokój"}
            </Button>
          </SheetFooter>
          {deleteId && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="text-sm">
                Czy na pewno chcesz usunąć blokadę?
              </p>
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
                  Usuń blokadę
                </Button>
                <Button type="button" variant="outline" onClick={() => setDeleteId(null)}>
                  Anuluj
                </Button>
              </div>
            </div>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
