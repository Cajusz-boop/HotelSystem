"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createGroupReservation } from "@/app/actions/reservations";
import { getRoomGroups } from "@/app/actions/rooms";
import type { Reservation, Room } from "@/lib/tape-chart-types";
import { X, Users, Calendar, CopyCheck, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

const sectionHeader =
  "text-xs font-medium uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-1.5 mb-2";
const selectClass =
  "flex h-7 w-full rounded border border-input bg-background px-2 py-0.5 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const inputCompact = "h-7 text-xs";

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
  /** Wspólny okres – do „Zastosuj do wszystkich” */
  const [commonCheckIn, setCommonCheckIn] = useState(defaultDate);
  const [commonCheckOut, setCommonCheckOut] = useState(addDays(defaultDate, 1));
  /** Wspólny status – do „Zastosuj do wszystkich” */
  const [commonStatus, setCommonStatus] = useState<Reservation["status"]>("CONFIRMED");

  const defaultRooms = useMemo(() => rooms.slice(0, Math.min(rooms.length, 2)), [rooms]);
  const roomOptions = useMemo(() => rooms.map((r) => r.number), [rooms]);

  const roomGroupOptions = useMemo(
    () =>
      roomGroups.filter(
        (g) => g.roomNumbers.length >= 2 && g.roomNumbers.every((n) => roomOptions.includes(n))
      ),
    [roomGroups, roomOptions]
  );

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
        const first = initialRooms[0];
        if (first) {
          setCommonCheckIn(first.checkIn);
          setCommonCheckOut(first.checkOut);
        }
      } else if (defaultRooms.length > 0) {
        const date = defaultDate;
        setRows(defaultRooms.map((r) => makeRow(r.number, date)));
        setCommonCheckIn(date);
        setCommonCheckOut(addDays(date, 1));
      } else {
        setRows([makeRow(rooms[0]?.number ?? "", defaultDate)]);
        setCommonCheckIn(defaultDate);
        setCommonCheckOut(addDays(defaultDate, 1));
      }
      setGroupName("");
      setNote("");
      setSelectedGroupId("");
      setCommonStatus("CONFIRMED");
      setError(null);
    }
  }, [open, defaultRooms, defaultDate, rooms, initialRooms]);

  const applyRoomGroup = (group: { id: string; name: string; roomNumbers: string[] }) => {
    setGroupName(group.name);
    setRows(group.roomNumbers.map((roomNumber) => makeRow(roomNumber, defaultDate)));
    setSelectedGroupId(group.id);
    setCommonCheckIn(defaultDate);
    setCommonCheckOut(addDays(defaultDate, 1));
  };

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

  /** Zastosuj wspólny okres do wszystkich pokoi */
  const applyCommonDates = () => {
    if (!commonCheckIn || !commonCheckOut) return;
    setRows((prev) =>
      prev.map((row) => ({ ...row, checkIn: commonCheckIn, checkOut: commonCheckOut }))
    );
    toast.success("Wspólny okres zastosowany do wszystkich pokoi.");
  };

  /** Zastosuj wspólny status do wszystkich pokoi */
  const applyCommonStatus = () => {
    setRows((prev) => prev.map((row) => ({ ...row, status: commonStatus })));
    toast.success("Wspólny status zastosowany do wszystkich pokoi.");
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
      setError(
        "error" in result
          ? result.error ?? "Nie udało się utworzyć rezerwacji grupowej."
          : "Nie udało się utworzyć rezerwacji grupowej."
      );
      return;
    }
    toast.success("Rezerwacja grupowa utworzona.");
    onCreated?.(result.data!.reservations as Reservation[], {
      id: result.data!.group.id,
      name: result.data!.group.name,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-[1150px] min-w-[950px] max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            if (!saving) handleSubmit(e as unknown as React.FormEvent);
          }
        }}
      >
        <DialogHeader className="relative px-6 pt-6 pb-2 shrink-0 border-b flex flex-row items-center justify-between gap-2">
          <DialogTitle className="text-base font-semibold pr-8 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Rezerwacja grupowa
          </DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
              aria-label="Zamknij"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogClose>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* LEWA KOLUMNA (40%) – dane grupy i opcje wspólne */}
          <div className="w-[40%] min-w-0 overflow-y-auto bg-muted/30 border-r flex-shrink-0">
            <form id="group-reservation-form" onSubmit={handleSubmit} className="p-4 space-y-6">
              {/* 1. DANE GRUPY */}
              <section>
                <h3 className={sectionHeader}>👥 DANE GRUPY</h3>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Nazwa grupy (opcjonalnie)</Label>
                  <Input
                    id="group-name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="np. Grupa szkoleniowa / Firma XYZ"
                    className={inputCompact}
                  />
                  <Label className="text-xs text-muted-foreground">Uwagi / notatka</Label>
                  <textarea
                    id="group-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Uwagi dla recepcji…"
                    className="flex min-h-[60px] w-full rounded border border-input bg-background px-2 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                    rows={2}
                  />
                  {roomGroupOptions.length > 0 && (
                    <>
                      <Label className="text-xs text-muted-foreground">Wirtualny pokój (grupa)</Label>
                      <select
                        id="virtual-room"
                        value={selectedGroupId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelectedGroupId(id);
                          const g = roomGroups.find((x) => x.id === id);
                          if (g) applyRoomGroup(g);
                        }}
                        className={selectClass}
                      >
                        <option value="">— wybierz grupę (np. Apartament) —</option>
                        {roomGroupOptions.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name} ({g.roomNumbers.join(", ")})
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </section>

              {/* 2. WSPÓLNY OKRES POBYTU */}
              <section>
                <h3 className={sectionHeader}>📅 WSPÓLNY OKRES POBYTU</h3>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Ustaw daty i zastosuj do wszystkich pokoi w grupie.
                </p>
                <div className="grid grid-cols-[80px_1fr] items-center gap-x-2 gap-y-2">
                  <Label className="text-xs text-muted-foreground text-right">Zameld.</Label>
                  <Input
                    type="date"
                    value={commonCheckIn}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCommonCheckIn(v);
                      if (v) setCommonCheckOut(addDays(v, 1));
                    }}
                    className={inputCompact}
                  />
                  <Label className="text-xs text-muted-foreground text-right">Wymeld.</Label>
                  <Input
                    type="date"
                    value={commonCheckOut}
                    onChange={(e) => setCommonCheckOut(e.target.value)}
                    min={commonCheckIn ? addDays(commonCheckIn, 1) : undefined}
                    className={inputCompact}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-xs w-full"
                  onClick={applyCommonDates}
                >
                  <Calendar className="mr-1.5 h-3.5 w-3.5" />
                  Zastosuj okres do wszystkich pokoi
                </Button>
              </section>

              {/* 3. WSPÓLNY STATUS */}
              <section>
                <h3 className={sectionHeader}>📋 WSPÓLNY STATUS</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={commonStatus}
                    onChange={(e) => setCommonStatus(e.target.value as Reservation["status"])}
                    className={selectClass}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={applyCommonStatus}
                  >
                    <CopyCheck className="mr-1.5 h-3.5 w-3.5" />
                    Zastosuj do wszystkich
                  </Button>
                </div>
              </section>

              {error && (
                <p className="text-xs text-destructive" data-testid="group-reservation-error">
                  {error}
                </p>
              )}
            </form>
          </div>

          {/* PRAWA KOLUMNA (60%) – zakładka: Pokoje w grupie */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <Tabs defaultValue="pokoje" className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-full justify-start shrink-0 rounded-none border-b px-4 gap-0 h-9">
                <TabsTrigger
                  value="pokoje"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  Pokoje w grupie ({rows.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="pokoje"
                className="flex-1 min-h-0 overflow-y-auto mt-0 p-4"
              >
                <div className="space-y-4">
                  {rows.map((row, idx) => (
                    <div
                      key={row.id}
                      className="rounded-lg border bg-card p-4 space-y-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-muted-foreground">
                          Pokój {idx + 1}
                        </h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleRemoveRow(row.id)}
                          disabled={rows.length <= 2}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Usuń
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Gość</Label>
                          <Input
                            value={row.guestName}
                            onChange={(e) =>
                              handleRowChange(row.id, { guestName: e.target.value })
                            }
                            placeholder="Imię i nazwisko"
                            required
                            className={inputCompact}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Pokój</Label>
                          <select
                            value={row.roomNumber}
                            onChange={(e) =>
                              handleRowChange(row.id, { roomNumber: e.target.value })
                            }
                            className={cn(selectClass, "h-8")}
                          >
                            {roomOptions.map((roomNumber) => (
                              <option key={roomNumber} value={roomNumber}>
                                {roomNumber}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Zameld.</Label>
                          <Input
                            type="date"
                            value={row.checkIn}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleRowChange(row.id, {
                                checkIn: value,
                                checkOut: value ? addDays(value, 1) : row.checkOut,
                              });
                            }}
                            className={inputCompact}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Wymeld.</Label>
                          <Input
                            type="date"
                            value={row.checkOut}
                            onChange={(e) =>
                              handleRowChange(row.id, { checkOut: e.target.value })
                            }
                            min={addDays(row.checkIn, 1)}
                            className={inputCompact}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Status</Label>
                          <select
                            value={row.status}
                            onChange={(e) =>
                              handleRowChange(row.id, {
                                status: e.target.value as Reservation["status"],
                              })
                            }
                            className={cn(selectClass, "h-8")}
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Pax</Label>
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            value={row.pax ?? ""}
                            onChange={(e) =>
                              handleRowChange(row.id, { pax: e.target.value })
                            }
                            className={inputCompact}
                            placeholder="—"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={handleAddRow}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Dodaj pokój
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* FOOTER – ten sam styl co okno edycji rezerwacji */}
        <footer className="shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-3 flex items-center justify-end gap-2">
          <Button
            type="submit"
            form="group-reservation-form"
            size="sm"
            className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
            disabled={saving}
            title="Ctrl+Enter"
          >
            {saving ? "Zapisywanie…" : "💾 Zapisz grupę"}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
