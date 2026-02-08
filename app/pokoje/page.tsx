"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getRoomsForManagement,
  createRoom,
  updateRoomActiveForSale,
  deleteRoom,
  getRoomTypes,
  ensureRoomTypes,
  type RoomForManagement,
  type RoomTypeForCennik,
} from "@/app/actions/rooms";
import { toast } from "sonner";
import { BedDouble, Plus, Ban, CheckCircle, Trash2 } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  CLEAN: "Czysty",
  DIRTY: "Do sprzątania",
  OOO: "OOO",
};

export default function PokojePage() {
  const [rooms, setRooms] = useState<RoomForManagement[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeForCennik[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNumber, setNewNumber] = useState("");
  const [newType, setNewType] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    await ensureRoomTypes();
    const [roomsRes, typesRes] = await Promise.all([
      getRoomsForManagement(),
      getRoomTypes(),
    ]);
    setLoading(false);
    if (roomsRes.success && roomsRes.data) setRooms(roomsRes.data);
    else toast.error(roomsRes.success ? undefined : roomsRes.error);
    if (typesRes.success && typesRes.data) setRoomTypes(typesRes.data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = newNumber.trim();
    const typ = newType.trim();
    if (!num || !typ) {
      toast.error("Wpisz numer i wybierz typ pokoju.");
      return;
    }
    setAdding(true);
    const result = await createRoom({
      number: num,
      type: typ,
      price: newPrice.trim() ? Number(newPrice) : undefined,
    });
    setAdding(false);
    if (result.success && result.data) {
      setRooms((prev) => [...prev, result.data!]);
      setNewNumber("");
      setNewType("");
      setNewPrice("");
      getRoomTypes().then((r) => r.success && r.data && setRoomTypes(r.data));
      toast.success(`Dodano pokój ${result.data.number}`);
    } else {
      toast.error(result.error);
    }
  };

  const handleToggleForSale = async (room: RoomForManagement) => {
    setTogglingId(room.id);
    const result = await updateRoomActiveForSale(room.id, !room.activeForSale);
    setTogglingId(null);
    if (result.success) {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === room.id ? { ...r, activeForSale: !r.activeForSale } : r
        )
      );
      toast.success(
        room.activeForSale
          ? "Pokój wycofany ze sprzedaży"
          : "Pokój przywrócony do sprzedaży"
      );
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async (room: RoomForManagement) => {
    if (!confirm(`Czy na pewno usunąć pokój ${room.number}? Operacja możliwa tylko gdy brak rezerwacji.`)) return;
    setDeletingId(room.id);
    const result = await deleteRoom(room.id);
    setDeletingId(null);
    if (result.success) {
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
      toast.success(`Usunięto pokój ${room.number}`);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 pl-[13rem]">
      <div className="flex items-center gap-2">
        <BedDouble className="h-8 w-8" />
        <h1 className="text-2xl font-semibold">Pokoje – zarządzanie</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        Dodawaj pokoje, wycofuj lub przywracaj je do sprzedaży. Pokoje wycofane nie pojawiają się na grafiku ani w dostępności do rezerwacji.
      </p>

      {/* Formularz: nowy pokój */}
      <form
        onSubmit={handleAddRoom}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="grid w-full max-w-xs gap-2">
          <Label htmlFor="new-number">Numer pokoju</Label>
          <Input
            id="new-number"
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            placeholder="np. 101"
            maxLength={20}
          />
        </div>
        <div className="grid w-full max-w-xs gap-2">
          <Label htmlFor="new-type">Typ pokoju</Label>
          {roomTypes.length > 0 ? (
            <select
              id="new-type"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">— wybierz —</option>
              {roomTypes.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id="new-type"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="np. Standard, Suite"
              maxLength={50}
            />
          )}
        </div>
        <div className="grid w-full max-w-[120px] gap-2">
          <Label htmlFor="new-price">Cena (opc.)</Label>
          <Input
            id="new-price"
            type="number"
            min={0}
            step={0.01}
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="—"
          />
        </div>
        <Button type="submit" disabled={adding}>
          <Plus className="mr-2 h-4 w-4" />
          {adding ? "Dodawanie…" : "Dodaj pokój"}
        </Button>
      </form>

      {/* Lista pokoi */}
      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Ładowanie…</div>
        ) : rooms.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Brak pokoi. Dodaj pierwszy pokój powyżej.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Numer</th>
                  <th className="px-4 py-3 text-left font-medium">Typ</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Cena</th>
                  <th className="px-4 py-3 text-left font-medium">Do sprzedaży</th>
                  <th className="px-4 py-3 text-right font-medium">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id} className="border-b border-border">
                    <td className="px-4 py-3 font-medium">{r.number}</td>
                    <td className="px-4 py-3">{r.type}</td>
                    <td className="px-4 py-3">{STATUS_LABELS[r.status] ?? r.status}</td>
                    <td className="px-4 py-3">{r.price != null ? `${r.price} PLN` : "—"}</td>
                    <td className="px-4 py-3">
                      {r.activeForSale ? (
                        <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-2 py-0.5 text-green-700 dark:text-green-400">
                          <CheckCircle className="h-3.5 w-3.5" /> Tak
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-400">
                          <Ban className="h-3.5 w-3.5" /> Wycofany
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={togglingId === r.id}
                          onClick={() => handleToggleForSale(r)}
                        >
                          {togglingId === r.id
                            ? "…"
                            : r.activeForSale
                              ? "Wycofaj ze sprzedaży"
                              : "Przywróć do sprzedaży"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deletingId === r.id}
                          onClick={() => handleDelete(r)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
