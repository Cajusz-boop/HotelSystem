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
import { ScanLine, Upload, UserCheck, Search, Save } from "lucide-react";

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
      toast.success("Dane z dokumentu wczytane (OCR). Plik nie został zapisany.");
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

  const fetchCompanyByNip = useCallback(async (nipRaw: string) => {
    const nip = nipRaw.replace(/\D/g, "").trim();
    if (nip.length !== 10) return;
    setNipLoading(true);
    const result = await lookupCompanyByNip(nip);
    setNipLoading(false);
    if (result.success && result.data) {
      setCompanyData(result.data);
      toast.success("Dane firmy wczytane.");
    } else {
      setCompanyData(null);
      if ("error" in result) toast.error(result.error);
    }
  }, []);

  useEffect(() => {
    const nip = nipInput.replace(/\D/g, "").trim();
    if (nip.length !== 10 || !isValidNipChecksum(nip)) return;
    const t = setTimeout(() => fetchCompanyByNip(nip), 500);
    return () => clearTimeout(t);
  }, [nipInput, fetchCompanyByNip]);

  const handleFetchCompany = () => {
    const nip = nipInput.replace(/\D/g, "").trim();
    if (nip.length !== 10) { toast.error("NIP musi mieć 10 cyfr."); return; }
    if (!isValidNipChecksum(nip)) { toast.error("NIP ma błędną sumę kontrolną."); return; }
    fetchCompanyByNip(nip);
  };

  const handleSaveCompany = async () => {
    if (!companyData) return;
    const nip = companyData.nip.replace(/\D/g, "");
    if (nip.length !== 10) { toast.error("NIP musi mieć 10 cyfr."); return; }
    if (!isValidNipChecksum(nip)) { toast.error("NIP ma błędną sumę kontrolną."); return; }
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
    if (result.success) toast.success("Firma zapisana w bazie.");
    else toast.error("error" in result ? result.error : "Błąd");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rooms.length === 0 || !room) { toast.error("Wybierz daty, w których są wolne pokoje."); return; }
    const customFormData: Record<string, string | number | boolean> = {};
    customFormFields.forEach((f) => {
      const v = customFieldValues[f.key];
      if (v === undefined) return;
      if (f.type === "checkbox") { if (v) customFormData[f.key] = true; }
      else if (f.type === "number") { const n = typeof v === "number" ? v : Number(v); if (!Number.isNaN(n)) customFormData[f.key] = n; }
      else if (v !== "" && String(v).trim() !== "") customFormData[f.key] = String(v);
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
      ...(companyData ? {
        companyData: {
          nip: companyData.nip.replace(/\D/g, ""),
          name: companyData.name,
          address: companyData.address ?? undefined,
          postalCode: companyData.postalCode ?? undefined,
          city: companyData.city ?? undefined,
          country: companyData.country,
        },
      } : {}),
    });
    if (result.success) {
      toast.success("Rezerwacja utworzona.");
      setName(""); setEmail(""); setPhone(""); setDateOfBirth(""); setMrz("");
      setSelectedGuest(null); setCompanyData(null); setNipInput("");
      setCustomFieldValues((prev) => {
        const next = { ...prev };
        customFormFields.forEach((f) => { next[f.key] = f.type === "checkbox" ? false : ""; });
        return next;
      });
      setCheckInStr(toDateStr(new Date(Date.now() + 86400000)));
      setCheckOutStr(toDateStr(new Date(Date.now() + 2 * 86400000)));
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  };

  const selectCls = "flex h-7 w-full rounded border border-input bg-background px-2 py-0.5 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
  const inputCls = "h-7 text-xs";

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        {/* COL 1: Pokój i daty + OCR */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Dane pokoju</h3>
          <div className="grid grid-cols-[80px_1fr] items-center gap-x-2 gap-y-1">
            <Label className="text-xs text-right text-muted-foreground">🚪 Pokój</Label>
            <select id="room" value={room} onChange={(e) => setRoom(e.target.value)} className={selectCls} data-testid="check-in-room-select">
              {rooms.length === 0 ? (
                <option value="">Brak wolnych pokoi</option>
              ) : (
                rooms.map((r) => <option key={r.number} value={r.number}>{r.number} ({r.type})</option>)
              )}
            </select>

            <Label className="text-xs text-right text-muted-foreground">📅 Zameld.</Label>
            <Input id="checkIn" type="date" className={inputCls} value={checkInStr} onChange={(e) => setCheckInStr(e.target.value)} required />

            <Label className="text-xs text-right text-muted-foreground">📅 Wymeld.</Label>
            <Input id="checkOut" type="date" className={inputCls} value={checkOutStr} onChange={(e) => setCheckOutStr(e.target.value)} required />
          </div>
          {rooms.length > 0 && (
            <p className="text-[10px] text-muted-foreground">Wolne pokoje: {checkInStr} – {checkOutStr}</p>
          )}

          <div className="mt-2 space-y-1.5 border-t pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">📷 Skan dowodu</h3>
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploadStatus === "processing"}>
                <Upload className="mr-1 h-3 w-3" />
                {uploadStatus === "processing" ? "OCR…" : "Wgraj dowód"}
              </Button>
              {uploadStatus === "done" && <span className="text-[10px] text-emerald-600">✓ Wczytano</span>}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">📟 Kod MRZ (skaner 2D)</Label>
              <textarea id="mrz" value={mrz} onChange={(e) => setMrz(e.target.value)} onBlur={handleMrzBlur}
                placeholder="IDPOLKOWALSKI<<JAN<<<<<<..."
                rows={2}
                className="flex w-full rounded border border-input bg-background px-2 py-1 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                maxLength={150} />
              <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                <ScanLine className="h-3 w-3" />
                <span className="text-[10px]">Skaner 2D</span>
              </div>
            </div>
          </div>
        </div>

        {/* COL 2: Dane gościa */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Dane gościa</h3>
          <div className="space-y-1 relative">
            <Label className="text-xs text-muted-foreground">👤 Imię i nazwisko</Label>
            <Input id="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwisko, Imię" required data-testid="check-in-guest-name" />
            {selectedGuest && (
              <p className="flex items-center gap-1 text-[10px] text-emerald-600" role="status">
                <UserCheck className="h-3 w-3 shrink-0" />
                Gość z bazy: {selectedGuest.name}
              </p>
            )}
            {suggestionsOpen && guestSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded border border-border bg-popover py-1 shadow-xl" data-testid="guest-suggestions-dropdown" role="listbox">
                {guestSuggestions.map((g) => (
                  <button key={g.id} type="button" role="option"
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left text-xs hover:bg-accent focus:bg-accent focus:outline-none"
                    onClick={() => selectGuest(g)}>
                    <span className="font-medium">{g.name}</span>
                    {(g.email || g.phone) && <span className="text-[10px] text-muted-foreground">{[g.email, g.phone].filter(Boolean).join(" · ")}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">✉️ Email</Label>
            <Input id="email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="opcjonalnie" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">📞 Telefon</Label>
            <Input id="phone" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+48 600 123 456" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">🎂 Data urodzenia</Label>
            <Input id="dateOfBirth" type="date" className={inputCls} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
          </div>

          {customFormFields.length > 0 && (
            <div className="mt-1 space-y-1 border-t pt-1">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Dodatkowe pola</p>
              {customFormFields.map((f) => (
                <div key={f.id}>
                  {f.type === "checkbox" ? (
                    <div className="flex items-center gap-1.5">
                      <input type="checkbox" id={`ci-${f.key}`} checked={Boolean(customFieldValues[f.key])}
                        onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [f.key]: e.target.checked }))}
                        className="h-3.5 w-3.5 rounded border-input" />
                      <Label htmlFor={`ci-${f.key}`} className="text-xs">{f.label}</Label>
                    </div>
                  ) : f.type === "select" && f.options?.length ? (
                    <>
                      <Label htmlFor={`ci-${f.key}`} className="text-xs text-muted-foreground">{f.label}</Label>
                      <select id={`ci-${f.key}`} value={String(customFieldValues[f.key] ?? "")}
                        onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        required={f.required} className={selectCls}>
                        <option value="">— wybierz —</option>
                        {f.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </>
                  ) : (
                    <>
                      <Label htmlFor={`ci-${f.key}`} className="text-xs text-muted-foreground">{f.label}{f.required && " *"}</Label>
                      <Input id={`ci-${f.key}`} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                        className={inputCls} value={String(customFieldValues[f.key] ?? "")}
                        onChange={(e) => { const v = e.target.value; setCustomFieldValues((prev) => ({ ...prev, [f.key]: f.type === "number" ? (v === "" ? "" : Number(v)) : v })); }}
                        required={f.required} />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COL 3: Firma / NIP */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">🏢 Firma / Faktura</h3>
          <div>
            <Label className="text-xs text-muted-foreground">🏢 NIP</Label>
            <div className="flex gap-1">
              <Input id="nip" className={`${inputCls} flex-1`} value={nipInput} onChange={(e) => setNipInput(e.target.value)} placeholder="5261040828" maxLength={14} />
              <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] px-2 shrink-0" onClick={handleFetchCompany} disabled={nipLoading}>
                <Search className="mr-1 h-3 w-3" />
                {nipLoading ? "…" : "Sprawdź"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Opcjonalnie – dane z Wykazu VAT</p>
          </div>
          {companyData && (
            <div className="space-y-1 rounded border bg-muted/30 p-1.5">
              <div>
                <Label className="text-[10px] text-muted-foreground">Nazwa firmy</Label>
                <Input className="h-6 text-xs" value={companyData.name}
                  onChange={(e) => setCompanyData((prev) => (prev ? { ...prev, name: e.target.value } : null))} />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Adres</Label>
                <Input className="h-6 text-xs" value={companyData.address ?? ""}
                  onChange={(e) => setCompanyData((prev) => prev ? { ...prev, address: e.target.value || null } : null)} placeholder="ulica, nr" />
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-1">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Kod</Label>
                  <Input className="h-6 text-xs" value={companyData.postalCode ?? ""}
                    onChange={(e) => setCompanyData((prev) => prev ? { ...prev, postalCode: e.target.value || null } : null)} placeholder="00-000" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Miasto</Label>
                  <Input className="h-6 text-xs" value={companyData.city ?? ""}
                    onChange={(e) => setCompanyData((prev) => prev ? { ...prev, city: e.target.value || null } : null)} placeholder="Warszawa" />
                </div>
              </div>
              <Button type="button" variant="secondary" size="sm" className="h-6 text-[10px] mt-1" onClick={handleSaveCompany} disabled={companySaveLoading}>
                <Save className="mr-1 h-3 w-3" />
                {companySaveLoading ? "Zapisywanie…" : "Zapisz firmę w bazie"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2 border-t pt-3">
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={rooms.length === 0}>
          Zapisz gościa / Utwórz rezerwację
        </Button>
      </div>
    </form>
  );
}
