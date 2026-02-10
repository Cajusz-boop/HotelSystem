"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createReservation, findGuestByNameOrMrz } from "@/app/actions/reservations";
import { getAvailableRoomsForDates } from "@/app/actions/rooms";
import { lookupCompanyByNip, createOrUpdateCompany, type CompanyFromNip } from "@/app/actions/companies";
import { parseMRZ } from "@/lib/mrz";
import { toast } from "sonner";
import { ScanLine, Upload, UserCheck, Building2, Search, Save } from "lucide-react";

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
  const [nipInput, setNipInput] = useState("");
  const [companyData, setCompanyData] = useState<CompanyFromNip | null>(null);
  const [nipLoading, setNipLoading] = useState(false);
  const [companySaveLoading, setCompanySaveLoading] = useState(false);
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

  const handleFetchCompany = async () => {
    const nip = nipInput.replace(/\D/g, "").trim();
    if (nip.length !== 10) {
      toast.error("Wprowadź prawidłowy NIP (10 cyfr).");
      return;
    }
    setNipLoading(true);
    const result = await lookupCompanyByNip(nip);
    setNipLoading(false);
    if (result.success && result.data) {
      setCompanyData(result.data);
      toast.success("Dane firmy wczytane z wykazu VAT.");
    } else {
      toast.error("error" in result ? result.error : "Błąd");
      setCompanyData(null);
    }
  };

  const handleSaveCompany = async () => {
    if (!companyData) return;
    const nip = companyData.nip.replace(/\D/g, "").slice(0, 10);
    if (nip.length !== 10) {
      toast.error("NIP musi mieć 10 cyfr.");
      return;
    }
    setCompanySaveLoading(true);
    const result = await createOrUpdateCompany({
      nip,
      name: companyData.name.trim(),
      address: companyData.address ?? undefined,
      postalCode: companyData.postalCode ?? undefined,
      city: companyData.city ?? undefined,
      country: companyData.country,
    });
    setCompanySaveLoading(false);
    if (result.success) {
      toast.success("Firma zapisana w bazie – przy kolejnym „Pobierz dane” dla tego NIP wczyta się pełna nazwa.");
    } else {
      toast.error("error" in result ? result.error : "Błąd");
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
      ...(companyData
        ? {
            companyData: {
              nip: companyData.nip.replace(/\D/g, "").slice(0, 10),
              name: companyData.name,
              address: companyData.address ?? undefined,
              postalCode: companyData.postalCode ?? undefined,
              city: companyData.city ?? undefined,
              country: companyData.country,
            },
          }
        : {}),
    });
    if (result.success) {
      toast.success("Rezerwacja utworzona.");
      setName("");
      setEmail("");
      setPhone("");
      setMrz("");
      setCompanyData(null);
      setNipInput("");
      setCheckInStr(toDateStr(new Date(Date.now() + 86400000)));
      setCheckOutStr(toDateStr(new Date(Date.now() + 2 * 86400000)));
    } else {
      toast.error("error" in result ? result.error : "Błąd");
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

      {/* Firma (do meldunku / faktury) – auto-uzupełnianie po NIP */}
      <div
        className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4"
        data-testid="check-in-company-section"
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Building2 className="h-4 w-4" />
          Firma (do meldunku / faktury)
        </h3>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1 space-y-1">
            <Label htmlFor="nip">NIP</Label>
            <Input
              id="nip"
              value={nipInput}
              onChange={(e) => setNipInput(e.target.value)}
              placeholder="np. 5261040828"
              maxLength={14}
              aria-label="NIP firmy"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleFetchCompany}
            disabled={nipLoading}
          >
            <Search className="mr-2 h-4 w-4" />
            {nipLoading ? "Pobieranie…" : "Pobierz dane"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Dane z Wykazu podatników VAT (Ministerstwo Finansów). Opcjonalnie – do faktury na POSNET.
        </p>
        {companyData && (
          <div className="grid gap-2 border-t border-border/50 pt-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="companyName">Nazwa firmy</Label>
              <Input
                id="companyName"
                value={companyData.name}
                onChange={(e) =>
                  setCompanyData((prev) => (prev ? { ...prev, name: e.target.value } : null))
                }
                placeholder="np. Karczma Łabędź Łukasz Wojenkowski"
                aria-describedby="companyNameHint"
              />
              <p id="companyNameHint" className="text-xs text-muted-foreground">
                Pole edytowalne – dopisz nazwę handlową (np. przed „PIOTR ZIELIŃSKI”). Zapisz firmę w bazie przyciskiem poniżej – przy kolejnym „Pobierz dane” dla tego NIP wczyta się pełna nazwa (działa tak samo jak dla Karczmy Łabędź).
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSaveCompany}
                disabled={companySaveLoading}
                className="mt-2"
              >
                <Save className="mr-2 h-4 w-4" />
                {companySaveLoading ? "Zapisywanie…" : "Zapisz firmę w bazie"}
              </Button>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="companyAddress">Adres</Label>
              <Input
                id="companyAddress"
                value={companyData.address ?? ""}
                onChange={(e) =>
                  setCompanyData((prev) =>
                    prev ? { ...prev, address: e.target.value || null } : null
                  )
                }
                placeholder="ulica, nr"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="companyPostalCode">Kod pocztowy</Label>
              <Input
                id="companyPostalCode"
                value={companyData.postalCode ?? ""}
                onChange={(e) =>
                  setCompanyData((prev) =>
                    prev ? { ...prev, postalCode: e.target.value || null } : null
                  )
                }
                placeholder="00-000"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="companyCity">Miasto</Label>
              <Input
                id="companyCity"
                value={companyData.city ?? ""}
                onChange={(e) =>
                  setCompanyData((prev) =>
                    prev ? { ...prev, city: e.target.value || null } : null
                  )
                }
                placeholder="Warszawa"
              />
            </div>
          </div>
        )}
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
