"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createReservation, findGuestsForCheckIn, type GuestCheckInSuggestion } from "@/app/actions/reservations";
import { getAvailableRoomsForDates } from "@/app/actions/rooms";
import { lookupCompanyByNip, createOrUpdateCompany, type CompanyFromNip } from "@/app/actions/companies";
import { getFormFieldsForForm } from "@/app/actions/hotel-config";
import type { CustomFormField } from "@/lib/hotel-config-types";
import { parseMRZ } from "@/lib/mrz";
import { isValidNipChecksum } from "@/lib/nip-checksum";
import { toast } from "sonner";
import { ScanLine, Upload, UserCheck, Building2, Search, Save } from "lucide-react";

/**
 * Odczyt MRZ/danych z pliku (zdjęcie dowodu/paszportu) przez Tesseract.js (OCR).
 * Zwraca imię i nazwisko oraz surowy MRZ (jeśli znaleziono).
 */
async function ocrFromFile(file: File): Promise<{ name: string; mrz?: string }> {
  const Tesseract = (await import("tesseract.js")).default;
  const {
    data: { text },
  } = await Tesseract.recognize(file, "eng", {
    logger: () => {},
  });
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const mrzLine =
    lines.find((l) => l.length >= 30 && /[0-9<]/.test(l) && l.replace(/</g, "").length > 5) ??
    lines.join("\n");
  const parsed = parseMRZ(mrzLine);
  if (parsed) {
    const name = `${parsed.surname}, ${parsed.givenNames}`.trim();
    return { name: name || "Nie odczytano nazwiska", mrz: mrzLine };
  }
  const firstLine = lines[0]?.slice(0, 80).trim();
  return {
    name: firstLine || "Nie odczytano tekstu",
    mrz: mrzLine.length >= 30 ? mrzLine : undefined,
  };
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
  const [dateOfBirth, setDateOfBirth] = useState("");
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
  const [guestSuggestions, setGuestSuggestions] = useState<GuestCheckInSuggestion[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestCheckInSuggestion | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [nipInput, setNipInput] = useState("");
  const [companyData, setCompanyData] = useState<CompanyFromNip | null>(null);
  const [nipLoading, setNipLoading] = useState(false);
  const [companySaveLoading, setCompanySaveLoading] = useState(false);
  const [customFormFields, setCustomFormFields] = useState<CustomFormField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number | boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const justSelectedRef = useRef(false);

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
    getFormFieldsForForm("CHECK_IN").then((fields) => {
      setCustomFormFields(fields);
      setCustomFieldValues((prev) => {
        const next = { ...prev };
        fields.forEach((f) => {
          if (next[f.key] === undefined) {
            next[f.key] = f.type === "checkbox" ? false : "";
          }
        });
        return next;
      });
    });
  }, []);

  /** Wyszukiwanie gości po imieniu, telefonie lub emailu – cross-field, min. 2 znaki */
  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    const q = name.trim() || phone.trim() || email.trim();
    if (q.length < 2) {
      setGuestSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }
    const t = setTimeout(() => {
      findGuestsForCheckIn(q).then((res) => {
        if (res.success && res.data?.length) {
          setGuestSuggestions(res.data);
          setSuggestionsOpen(true);
        } else {
          setGuestSuggestions([]);
          setSuggestionsOpen(false);
        }
      });
    }, 350);
    return () => clearTimeout(t);
  }, [name, phone, email]);

  const selectGuest = useCallback((g: GuestCheckInSuggestion) => {
    justSelectedRef.current = true;
    setName(g.name);
    setEmail(g.email ?? "");
    setPhone(g.phone ?? "");
    setDateOfBirth(g.dateOfBirth ?? "");
    setSelectedGuest(g);
    setGuestSuggestions([]);
    setSuggestionsOpen(false);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("processing");

    try {
      const parsed = await ocrFromFile(file);
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

  const fetchCompanyByNip = useCallback(
    async (nipRaw: string) => {
      const nip = nipRaw.replace(/\D/g, "").trim();
      if (nip.length !== 10) return;
      setNipLoading(true);
      const result = await lookupCompanyByNip(nip);
      setNipLoading(false);
      if (result.success && result.data) {
        setCompanyData(result.data);
        toast.success("Dane firmy wczytane (auto-uzupełnienie).");
      } else {
        setCompanyData(null);
        if ("error" in result) toast.error(result.error);
      }
    },
    []
  );

  /** Auto-uzupełnianie: gdy NIP ma 10 cyfr i poprawną sumę kontrolną – od razu pobierz dane firmy (debounce 500 ms) */
  useEffect(() => {
    const nip = nipInput.replace(/\D/g, "").trim();
    if (nip.length !== 10 || !isValidNipChecksum(nip)) return;
    const t = setTimeout(() => fetchCompanyByNip(nip), 500);
    return () => clearTimeout(t);
  }, [nipInput, fetchCompanyByNip]);

  const handleFetchCompany = () => {
    const nip = nipInput.replace(/\D/g, "").trim();
    if (nip.length !== 10) {
      toast.error("Wprowadź prawidłowy NIP (10 cyfr).");
      return;
    }
    if (!isValidNipChecksum(nip)) {
      toast.error("NIP ma błędną sumę kontrolną.");
      return;
    }
    fetchCompanyByNip(nip);
  };

  const handleSaveCompany = async () => {
    if (!companyData) return;
    const nip = companyData.nip.replace(/\D/g, "");
    if (nip.length !== 10) {
      toast.error("NIP musi mieć 10 cyfr.");
      return;
    }
    if (!isValidNipChecksum(nip)) {
      toast.error("NIP ma błędną sumę kontrolną.");
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
    const customFormData: Record<string, string | number | boolean> = {};
    customFormFields.forEach((f) => {
      const v = customFieldValues[f.key];
      if (v === undefined) return;
      if (f.type === "checkbox") {
        if (v) customFormData[f.key] = true;
      } else if (f.type === "number") {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isNaN(n)) customFormData[f.key] = n;
      } else if (v !== "" && String(v).trim() !== "") {
        customFormData[f.key] = String(v);
      }
    });

    const useSelectedGuest =
      selectedGuest &&
      name.trim() === selectedGuest.name &&
      (email.trim() || "") === (selectedGuest.email ?? "") &&
      (phone.trim() || "") === (selectedGuest.phone ?? "");

    const result = await createReservation({
      guestName: name.trim(),
      ...(useSelectedGuest ? { guestId: selectedGuest.id } : {}),
      guestEmail: email.trim() || undefined,
      guestPhone: phone.trim() || undefined,
      room,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      status: "CONFIRMED",
      mrz: mrz.trim() || undefined,
      guestDateOfBirth: dateOfBirth.trim() || undefined,
      ...(Object.keys(customFormData).length > 0 ? { customFormData } : {}),
      ...(companyData
        ? {
            companyData: {
              nip: companyData.nip.replace(/\D/g, ""),
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
      setDateOfBirth("");
      setMrz("");
      setSelectedGuest(null);
      setCompanyData(null);
      setNipInput("");
      setCustomFieldValues((prev) => {
        const next = { ...prev };
        customFormFields.forEach((f) => {
          next[f.key] = f.type === "checkbox" ? false : "";
        });
        return next;
      });
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

      <div className="relative space-y-3">
        <p className="text-xs text-muted-foreground">
          Wpisz imię, email lub telefon – pojawią się propozycje z bazy. Wybierz gościa, aby uzupełnić resztę pól.
        </p>
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="opcjonalnie – wpisz, aby wyszukać"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="opcjonalnie – wpisz, aby wyszukać"
          />
        </div>
        {selectedGuest && (
          <p className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-500" role="status">
            <UserCheck className="h-4 w-4 shrink-0" />
            Gość z bazy: {selectedGuest.name} – rezerwacja zostanie powiązana z tym profilem.
          </p>
        )}
        {suggestionsOpen && guestSuggestions.length > 0 && (
          <div
            className="z-10 max-h-48 overflow-auto rounded-md border border-border bg-popover py-1 shadow-md"
            data-testid="guest-suggestions-dropdown"
            role="listbox"
          >
            {guestSuggestions.map((g) => (
              <button
                key={g.id}
                type="button"
                role="option"
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                onClick={() => selectGuest(g)}
              >
                <span className="font-medium">{g.name}</span>
                {(g.email || g.phone) && (
                  <span className="text-xs text-muted-foreground">
                    {[g.email, g.phone].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="dateOfBirth">Data urodzenia</Label>
        <Input
          id="dateOfBirth"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
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

      {/* Dodatkowe pola z konfiguracji (Admin → Ustawienia → Dodatkowe pola formularzy) */}
      {customFormFields.length > 0 && (
        <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4">
          <h3 className="text-sm font-semibold">Dodatkowe pola</h3>
          <div className="space-y-3">
            {customFormFields.map((f) => (
              <div key={f.id} className="space-y-1">
                {f.type === "checkbox" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={f.key}
                      checked={Boolean(customFieldValues[f.key])}
                      onChange={(e) =>
                        setCustomFieldValues((prev) => ({ ...prev, [f.key]: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor={f.key}>{f.label}</Label>
                  </div>
                ) : f.type === "select" && f.options?.length ? (
                  <>
                    <Label htmlFor={f.key}>{f.label}</Label>
                    <select
                      id={f.key}
                      value={String(customFieldValues[f.key] ?? "")}
                      onChange={(e) =>
                        setCustomFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      required={f.required}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">— wybierz —</option>
                      {f.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <Label htmlFor={f.key}>
                      {f.label}
                      {f.required && " *"}
                    </Label>
                    <Input
                      id={f.key}
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={String(customFieldValues[f.key] ?? "")}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCustomFieldValues((prev) => ({
                          ...prev,
                          [f.key]: f.type === "number" ? (v === "" ? "" : Number(v)) : v,
                        }));
                      }}
                      required={f.required}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Button type="submit" disabled={rooms.length === 0}>
        Zapisz gościa / Utwórz rezerwację
      </Button>
    </form>
  );
}
