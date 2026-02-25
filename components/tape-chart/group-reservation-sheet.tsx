"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createGroupReservation } from "@/app/actions/reservations";
import { getRoomGroups } from "@/app/actions/rooms";
import type { Reservation, Room } from "@/lib/tape-chart-types";

const STATUS_OPTIONS: { value: Reservation["status"]; label: string }[] = [
  { value: "CONFIRMED", label: "Potwierdzona" },
  { value: "CHECKED_IN", label: "Zameldowany" },
  { value: "CHECKED_OUT", label: "Wymeldowany" },
  { value: "CANCELLED", label: "Anulowana" },
  { value: "NO_SHOW", label: "No-show" },
];

interface GroupReservationRow {
  id: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: Reservation["status"];
  pax?: string;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeRow(roomNumber: string, date: string): GroupReservationRow {
  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    guestName: "",
    roomNumber,
    checkIn: date,
    checkOut: addDays(date, 1),
    status: "CONFIRMED",
    pax: "",
  };
}

export interface InitialRoomData {
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  nights: number;
}

export interface GroupReservationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  defaultDate: string;
  /** Pre-wypełnione pokoje i daty (np. z zaznaczenia komórek na Tape Chart) */
  initialRooms?: InitialRoomData[];
  /** Tryb edycji – załaduj grupę o podanym id (w przygotowaniu) */
  editGroupId?: string | null;
  onCreated?: (reservations: Reservation[], group: { id: string; name?: string }) => void;
}

export function GroupReservationSheet({
  open,
  onOpenChange,
  rooms,
  defaultDate,
  initialRooms,
  editGroupId,
  onCreated,
}: GroupReservationSheetProps) {
  const [groupName, setGroupName] = useState("");
  const [rows, setRows] = useState<GroupReservationRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [roomGroups, setRoomGroups] = useState<Array<{ id: string; name: string; roomNumbers: string[] }>>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");

  const defaultRooms = useMemo(() => rooms.slice(0, Math.min(rooms.length, 2)), [rooms]);

  useEffect(() => {
    if (open) {
      getRoomGroups().then((r) => r.success && r.data && setRoomGroups(r.data));
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      if (initialRooms && initialRooms.length >= 2) {
        const rowsFromInitial = initialRooms.map((ir) => ({
          ...makeRow(ir.roomNumber, ir.checkIn),
          checkIn: ir.checkIn,
          checkOut: ir.checkOut,
        }));
        setRows(rowsFromInitial);
      } else if (defaultRooms.length > 0) {
        setRows(defaultRooms.map((r) => makeRow(r.number, defaultDate)));
      } else {
        setRows([makeRow(rooms[0]?.number ?? "", defaultDate)]);
      }
      setGroupName("");
      setNote("");
      setSelectedGroupId("");
      setError(null);
    }
  }, [open, defaultRooms, defaultDate, rooms, initialRooms]);

  const applyRoomGroup = (group: { id: string; name: string; roomNumbers: string[] }) => {
    setGroupName(group.name);
    setRows(group.roomNumbers.map((roomNumber) => makeRow(roomNumber, defaultDate)));
    setSelectedGroupId(group.id);
  };

  const roomOptions = useMemo(() => rooms.map((r) => r.number), [rooms]);

  const roomGroupOptions = useMemo(
    () =>
      roomGroups.filter((g) => g.roomNumbers.length >= 2 && g.roomNumbers.every((n) => roomOptions.includes(n))),
    [roomGroups, roomOptions]
  );

  const handleRowChange = (id: string, patch: Partial<GroupReservationRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleAddRow = () => {
    const fallbackRoom = roomOptions[0] ?? "";
    setRows((prev) => [...prev, makeRow(fallbackRoom, defaultDate)]);
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => (prev.length <= 2 ? prev : prev.filter((row) => row.id !== id)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rows.length < 2) {
      setError("Dodaj co najmniej dwa pokoje do rezerwacji grupowej.");
      return;
    }
    if (rows.some((row) => !row.guestName.trim() || !row.roomNumber.trim())) {
      setError("Uzupełnij imię gościa i numer pokoju dla każdego wpisu.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      groupName: groupName.trim() || undefined,
      note: note.trim() || undefined,
      reservations: rows.map((row) => ({
        guestName: row.guestName.trim(),
        room: row.roomNumber.trim(),
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        status: row.status,
        pax: row.pax && row.pax !== "" ? Number(row.pax) : undefined,
      })),
    };
    const result = await createGroupReservation(payload);
    setSaving(false);
    if (!result.success) {
      setError("error" in result ? (result.error ?? "Nie udało się utworzyć rezerwacji grupowej.") : "Nie udało się utworzyć rezerwacji grupowej.");
      return;
    }
    toast.success("Rezerwacja grupowa utworzona.");
    onCreated?.(
      result.data!.reservations as Reservation[],
      { id: result.data!.group.id, name: result.data!.group.name }
    );
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Rezerwacja grupowa</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="group-name">Nazwa grupy (opcjonalnie)</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Grupa szkoleniowa / Firma"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-note">Notatka (opcjonalnie)</Label>
            <Input
              id="group-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Uwagi dla recepcji"
            />
          </div>
          {roomGroupOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="virtual-room">Wirtualny pokój (grupa)</Label>
              <select
                id="virtual-room"
                value={selectedGroupId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedGroupId(id);
                  const g = roomGroupOptions.find((x) => x.id === id);
                  if (g) applyRoomGroup(g);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— wybierz grupę (np. Apartament) —</option>
                {roomGroupOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.roomNumbers.join(", ")})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-4">
            {rows.map((row, idx) => (
              <div key={row.id} className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Pokój {idx + 1}</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveRow(row.id)}
                    disabled={rows.length <= 2}
                  >
                    Usuń
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Gość</Label>
                  <Input
                    value={row.guestName}
                    onChange={(e) => handleRowChange(row.id, { guestName: e.target.value })}
                    placeholder="Imię i nazwisko"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pokój</Label>
                    <select
                      value={row.roomNumber}
                      onChange={(e) => handleRowChange(row.id, { roomNumber: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {roomOptions.map((roomNumber) => (
                        <option key={roomNumber} value={roomNumber}>
                          {roomNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <select
                      value={row.status}
                      onChange={(e) =>
                        handleRowChange(row.id, { status: e.target.value as Reservation["status"] })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Przyjazd</Label>
                    <Input
                      type="date"
                      value={row.checkIn}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleRowChange(row.id, {
                          checkIn: value,
                          checkOut: addDays(value, 1),
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Wyjazd</Label>
                    <Input
                      type="date"
                      value={row.checkOut}
                      onChange={(e) => handleRowChange(row.id, { checkOut: e.target.value })}
                      min={addDays(row.checkIn, 1)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Liczba gości (opcjonalnie)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={row.pax ?? ""}
                    onChange={(e) => handleRowChange(row.id, { pax: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" onClick={handleAddRow}>
            Dodaj pokój
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Zapisywanie…" : "Zapisz grupę"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
