"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { searchAvailableRooms, type RoomSearchResult } from "@/app/actions/rooms";
import { getRoomTypes } from "@/app/actions/rooms";
import { Search, Calendar, User, Baby, MapPin, Eye, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FEATURE_OPTIONS = ["TV", "Minibar", "Klimatyzacja", "Sejf", "Balkon", "Łazienka", "WiFi", "Suszarka", "Czajnik"];

export interface RoomSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string | null;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultAdults?: number;
  defaultChildren?: number;
  onCreateReservation?: (params: { roomNumber: string; checkIn: string; checkOut: string; adults: number; children: number }) => void;
  onShowOnChart?: (roomNumber: string) => void;
}

export function RoomSearchDialog({
  open,
  onOpenChange,
  propertyId,
  defaultCheckIn,
  defaultCheckOut,
  defaultAdults = 2,
  defaultChildren = 0,
  onCreateReservation,
  onShowOnChart,
}: RoomSearchDialogProps) {
  const [checkIn, setCheckIn] = useState(defaultCheckIn ?? "");
  const [checkOut, setCheckOut] = useState(defaultCheckOut ?? "");
  const [adults, setAdults] = useState(defaultAdults);
  const [children, setChildren] = useState(defaultChildren);
  const [roomTypeId, setRoomTypeId] = useState<string>("");
  const [floor, setFloor] = useState<string>("");
  const [view, setView] = useState<string>("");
  const [requiredFeatures, setRequiredFeatures] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [roomTypes, setRoomTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ available: RoomSearchResult[]; unavailable: RoomSearchResult[] } | null>(null);

  const loadRoomTypes = useCallback(async () => {
    const res = await getRoomTypes();
    if (res.success && res.data) {
      setRoomTypes(res.data.map((t) => ({ id: t.id, name: t.name })));
    }
  }, []);

  const toggleFeature = (f: string) => {
    setRequiredFeatures((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const handleSearch = async () => {
    if (!checkIn?.trim() || !checkOut?.trim()) {
      toast.error("Podaj daty check-in i check-out");
      return;
    }
    setLoading(true);
    setResults(null);
    try {
      const res = await searchAvailableRooms({
        propertyId,
        checkIn: checkIn.trim(),
        checkOut: checkOut.trim(),
        adults,
        children,
        roomTypeId: roomTypeId || null,
        floor: floor || null,
        view: view || null,
        requiredFeatures: requiredFeatures.length ? requiredFeatures : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) || undefined : undefined,
      });
      if (res.success && res.data) {
        setResults(res.data);
      } else if (!res.success) {
        toast.error(res.error ?? "Błąd wyszukiwania");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd wyszukiwania");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReservation = (r: RoomSearchResult) => {
    if (!r.isAvailable) return;
    onCreateReservation?.({
      roomNumber: r.roomNumber,
      checkIn,
      checkOut,
      adults,
      children,
    });
    onOpenChange(false);
  };

  const handleShowOnChart = (r: RoomSearchResult) => {
    onShowOnChart?.(r.roomNumber);
    onOpenChange(false);
  };

  useEffect(() => {
    if (open && roomTypes.length === 0) loadRoomTypes();
  }, [open, roomTypes.length, loadRoomTypes]);

  const totalAvailable = results ? results.available.length : 0;
  const totalUnavailable = results ? results.unavailable.length : 0;
  const totalMatching = totalAvailable + totalUnavailable;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Szukaj pokoju
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Check-in</Label>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Check-out</Label>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> Dorośli</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={adults}
                onChange={(e) => setAdults(parseInt(e.target.value, 10) || 1)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="flex items-center gap-1"><Baby className="h-3.5 w-3.5" /> Dzieci</Label>
              <Input
                type="number"
                min={0}
                max={20}
                value={children}
                onChange={(e) => setChildren(parseInt(e.target.value, 10) || 0)}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Typ pokoju</Label>
              <select
                className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={roomTypeId}
                onChange={(e) => setRoomTypeId(e.target.value)}
              >
                <option value="">Dowolny</option>
                {roomTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Piętro</Label>
              <Input
                placeholder="Dowolne"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> Widok</Label>
            <Input
              placeholder="Dowolny"
              value={view}
              onChange={(e) => setView(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Wyposażenie (zaznacz wymagane)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {FEATURE_OPTIONS.map((f) => (
                <label key={f} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiredFeatures.includes(f)}
                    onChange={() => toggleFeature(f)}
                    className="rounded border-input"
                  />
                  {f}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Cena max (PLN/dobę)</Label>
            <Input
              type="number"
              min={0}
              placeholder="Bez limitu"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="mt-1 w-32"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading} className="gap-2">
            <Search className="h-4 w-4" />
            {loading ? "Szukam…" : "Szukaj"}
          </Button>

          {results && (
            <div className="border rounded-lg p-3 space-y-2 max-h-80 overflow-y-auto">
              <p className="text-sm font-medium">
                Znaleziono: {totalAvailable} dostępnych z {totalMatching} pasujących
              </p>
              {[...results.available, ...results.unavailable].map((r) => (
                <div
                  key={r.roomId}
                  className={cn(
                    "rounded-lg border p-3 text-sm",
                    r.isAvailable ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" : "bg-muted/50 border-muted"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {r.isAvailable ? (
                        <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">
                          Pokój {r.roomNumber} ({r.roomTypeName}{r.floor ? `, p.${r.floor}` : ""})
                        </p>
                        <p className="text-muted-foreground text-xs truncate">
                          {r.features || "—"} {r.beds ? `· ${r.beds}` : ""}
                        </p>
                        <p className="text-xs mt-1">
                          Cena: {r.pricePerNight != null ? `${r.pricePerNight} PLN/dobę × ${r.nights} noce = ${r.totalPrice} PLN` : "—"}
                        </p>
                        {!r.isAvailable && r.conflictReason && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{r.conflictReason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {r.isAvailable && (
                        <>
                          <Button size="sm" variant="default" onClick={() => handleCreateReservation(r)}>
                            Utwórz rezerwację
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleShowOnChart(r)}>
                            Pokaż na grafiku
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {totalMatching === 0 && (
                <p className="text-sm text-muted-foreground">Brak pokoi spełniających kryteria.</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

