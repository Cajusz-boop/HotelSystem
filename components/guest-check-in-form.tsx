"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createReservation, findGuestByNameOrMrz } from "@/app/actions/reservations";
import { getAvailableRoomsForDates } from "@/app/actions/rooms";
import { parseMRZ } from "@/lib/mrz";
import { toast } from "sonner";
import { ScanLine, Upload, UserCheck } from "lucide-react";

/** Symulacja OCR: z pliku nie odczytujemy prawdziwych danych – wypełniamy mock i natychmiast usuwamy plik */
function simulateOcrFromFile(_file: File): Promise<{ name: string; mrz?: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        name: "Kowalski, Jan",
        mrz: "IDPOLKOWALSKI<<JAN<<<<<<<<<<<<<<<<<<<<<<<",
      });
    }, 300);
  });
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function GuestCheckInForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mrz, setMrz] = useState("");
  const [checkInStr, setCheckInStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toDateStr(d);
  });
  const [checkOutStr, setCheckOutStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return toDateStr(d);
  });
  const [room, setRoom] = useState("101");
  const [rooms, setRooms] = useState<Array<{ number: string; type: string; status: string }>>([]);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [existingGuestMatch, setExistingGuestMatch] = useState<{ name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAvailableRooms = useCallback(() => {
    getAvailableRoomsForDates(checkInStr, checkOutStr).then((r) => {
      if (r.success && r.data?.length) {
        setRooms(r.data);
        setRoom((prev) => (r.data!.some((x) => x.number === prev) ? prev : r.data![0].number));
      } else {
        setRooms([]);
        setRoom("");
      }
    });
  }, [checkInStr, checkOutStr]);

  useEffect(() => {
    loadAvailableRooms();
  }, [loadAvailableRooms]);

  useEffect(() => {
    if (!name.trim() && !mrz.trim()) {
      setExistingGuestMatch(null);
      return;
    }
    const t = setTimeout(() => {
      findGuestByNameOrMrz(name, mrz || undefined).then((res) => {
        if (res.success && res.data?.length) {
          setExistingGuestMatch({ name: res.data[0].name });
        } else {
          setExistingGuestMatch(null);
        }
      });
    }, 400);
    return () => clearTimeout(t);
  }, [name, mrz]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("processing");

    try {
      const parsed = await simulateOcrFromFile(file);
      setName(parsed.name);
      if (parsed.mrz) setMrz(parsed.mrz);
      setUploadStatus("done");
      toast.success("Dane z dokumentu wczytane (symulacja OCR). Plik nie został zapisany.");
    } catch {
      setUploadStatus("error");
      toast.error("Nie udało się odczytać dokumentu.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleMrzBlur = () => {
    if (!mrz.trim()) return;
    const parsed = parseMRZ(mrz);
    if (parsed && (parsed.surname || parsed.givenNames) && !name) {
      setName(parsed.givenNames ? `${parsed.surname}, ${parsed.givenNames}` : parsed.surname);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rooms.length === 0 || !room) {
      toast.error("Wybierz daty, w których są wolne pokoje.");
      return;
    }
    const result = await createReservation({
      guestName: name.trim(),
      room,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      status: "CONFIRMED",
      mrz: mrz.trim() || undefined,
    });
    if (result.success) {
      toast.success("Rezerwacja utworzona.");
      setName("");
      setEmail("");
      setPhone("");
      setMrz("");
      setCheckInStr(toDateStr(new Date(Date.now() + 86400000)));
      setCheckOutStr(toDateStr(new Date(Date.now() + 2 * 86400000)));
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-6">
      {/* Parse & Forget: upload zdjęcia dowodu */}
      <div className="space-y-2">
        <Label>Zdjęcie dowodu (Parse & Forget)</Label>
        <p className="text-xs text-muted-foreground">
          Opcjonalnie: wgraj zdjęcie dowodu. System symuluje OCR, wypełnia pola i
          natychmiast usuwa plik – nie zapisujemy go w bazie.
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Wybierz zdjęcie dowodu"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadStatus === "processing"}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploadStatus === "processing"
              ? "Przetwarzanie…"
              : "Wgraj zdjęcie dowodu"}
          </Button>
          {uploadStatus === "done" && (
            <span className="text-sm text-muted-foreground">Wczytano, plik usunięty</span>
          )}
        </div>
      </div>

      {/* Data zameldowania / wymeldowania (GAP 2.1) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="checkIn">Data zameldowania</Label>
          <Input
            id="checkIn"
            type="date"
            value={checkInStr}
            onChange={(e) => setCheckInStr(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkOut">Data wymeldowania</Label>
          <Input
            id="checkOut"
            type="date"
            value={checkOutStr}
            onChange={(e) => setCheckOutStr(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Wybór pokoju (GAP 2.1) – tylko wolne w danym terminie */}
      <div className="space-y-2">
        <Label htmlFor="room">Pokój (wolne w wybranym terminie)</Label>
        <select
          id="room"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Wybierz pokój"
          data-testid="check-in-room-select"
        >
          {rooms.length === 0 ? (
            <option value="">Brak wolnych pokoi w tym terminie</option>
          ) : (
            rooms.map((r) => (
              <option key={r.number} value={r.number}>
                {r.number} ({r.type})
              </option>
            ))
          )}
        </select>
        {rooms.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Lista pokoi wolnych w okresie {checkInStr} – {checkOutStr}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Imię i nazwisko</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nazwisko, Imię"
          required
          data-testid="check-in-guest-name"
        />
        {existingGuestMatch && (
          <p
            className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-500"
            role="status"
            data-testid="existing-guest-suggestion"
          >
            <UserCheck className="h-4 w-4 shrink-0" />
            Gość już w bazie: {existingGuestMatch.name} – rezerwacja zostanie powiązana z tym profilem.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="opcjonalnie"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Telefon</Label>
        <Input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="opcjonalnie"
        />
      </div>

      {/* Pole MRZ – pod skaner 2D */}
      <div className="space-y-2">
        <Label htmlFor="mrz">Kod MRZ (dowód – skaner 2D)</Label>
        <p className="text-xs text-muted-foreground">
          Wpisz lub zeskanuj kod MRZ z dowodu (2 lub 3 linie). Po opuszczeniu pola
          imię i nazwisko zostaną uzupełnione, jeśli to możliwe.
        </p>
        <textarea
          id="mrz"
          value={mrz}
          onChange={(e) => setMrz(e.target.value)}
          onBlur={handleMrzBlur}
          placeholder="np. IDPOLKOWALSKI<<JAN<<<<<<..."
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          maxLength={150}
        />
        <div className="flex items-center gap-1 text-muted-foreground">
          <ScanLine className="h-4 w-4" />
          <span className="text-xs">Przygotowane pod skaner 2D</span>
        </div>
      </div>

      <Button type="submit" disabled={rooms.length === 0}>
        Zapisz gościa / Utwórz rezerwację
      </Button>
    </form>
  );
}
