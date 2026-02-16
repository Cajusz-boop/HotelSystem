"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getFiscalReceiptTemplate,
  updateFiscalReceiptTemplate,
  type FiscalReceiptTemplateData,
} from "@/app/actions/finance";
import { toast } from "sonner";
import { Receipt, ArrowLeft, Save, RefreshCw } from "lucide-react";

export default function ParagonPage() {
  const [template, setTemplate] = useState<FiscalReceiptTemplateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState<Partial<FiscalReceiptTemplateData>>({});

  const load = async () => {
    setLoading(true);
    try {
      const result = await getFiscalReceiptTemplate();
      if (result.success && result.data) {
        setTemplate(result.data);
        setEdited({});
      } else {
        toast.error("error" in result ? (result.error ?? "Błąd ładowania szablonu") : "Błąd ładowania szablonu");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFieldChange = (
    field: keyof FiscalReceiptTemplateData,
    value: string | number | boolean | null
  ) => {
    setEdited((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getValue = (field: keyof FiscalReceiptTemplateData) => {
    if (field in edited) {
      return edited[field];
    }
    return template?.[field] ?? "";
  };

  const handleSave = async () => {
    if (!template || Object.keys(edited).length === 0) {
      toast.info("Brak zmian do zapisania");
      return;
    }

    setSaving(true);
    try {
      const result = await updateFiscalReceiptTemplate(edited);
      if (result.success && result.data) {
        toast.success("Szablon zapisany");
        setTemplate(result.data);
        setEdited({});
      } else {
        toast.error("error" in result ? (result.error ?? "Błąd zapisu") : "Błąd zapisu");
      }
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(edited).length > 0;

  // Podgląd przykładowego paragonu
  const previewItemName = () => {
    let name = getValue("itemNameRoom") as string || "Nocleg";
    if (getValue("includeRoomNumber")) {
      const format = (getValue("roomNumberFormat") as string) || "pok. {roomNumber}";
      name = `${name} ${format.replace("{roomNumber}", "101")}`;
    }
    return name;
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Receipt className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Szablon paragonu fiskalnego</h1>
        </div>
        <p className="text-muted-foreground">Ładowanie...</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-destructive">Nie udało się załadować szablonu.</p>
        <Button onClick={load} className="mt-4">Ponów</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Receipt className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Szablon paragonu fiskalnego</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Odśwież
          </Button>
          <Link href="/ustawienia">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Powrót
            </Button>
          </Link>
        </div>
      </div>

      <p className="mb-6 text-muted-foreground">
        Konfiguruj nagłówek, stopkę i nazwy pozycji drukowane na paragonach fiskalnych.
        Zmiany zostaną zastosowane do nowo drukowanych paragonów.
      </p>

      <div className="space-y-8">
        {/* Nagłówek */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Nagłówek paragonu</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Tekst drukowany na górze paragonu (maksymalnie 3 linie).
          </p>
          
          <div className="grid gap-4">
            <div>
              <Label htmlFor="headerLine1">Linia 1 (np. nazwa firmy)</Label>
              <Input
                id="headerLine1"
                value={getValue("headerLine1") as string}
                onChange={(e) => handleFieldChange("headerLine1", e.target.value || null)}
                placeholder="HOTEL ŁABĘDŹ"
                className="mt-1"
                maxLength={40}
              />
            </div>
            <div>
              <Label htmlFor="headerLine2">Linia 2 (np. adres)</Label>
              <Input
                id="headerLine2"
                value={getValue("headerLine2") as string}
                onChange={(e) => handleFieldChange("headerLine2", e.target.value || null)}
                placeholder="ul. Przykładowa 1, 00-000 Miasto"
                className="mt-1"
                maxLength={40}
              />
            </div>
            <div>
              <Label htmlFor="headerLine3">Linia 3 (np. NIP)</Label>
              <Input
                id="headerLine3"
                value={getValue("headerLine3") as string}
                onChange={(e) => handleFieldChange("headerLine3", e.target.value || null)}
                placeholder="NIP: 123-456-78-90"
                className="mt-1"
                maxLength={40}
              />
            </div>
          </div>
        </section>

        {/* Stopka */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Stopka paragonu</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Tekst drukowany na dole paragonu (maksymalnie 3 linie).
          </p>
          
          <div className="grid gap-4">
            <div>
              <Label htmlFor="footerLine1">Linia 1</Label>
              <Input
                id="footerLine1"
                value={getValue("footerLine1") as string}
                onChange={(e) => handleFieldChange("footerLine1", e.target.value || null)}
                placeholder="Dziękujemy za wizytę!"
                className="mt-1"
                maxLength={40}
              />
            </div>
            <div>
              <Label htmlFor="footerLine2">Linia 2</Label>
              <Input
                id="footerLine2"
                value={getValue("footerLine2") as string}
                onChange={(e) => handleFieldChange("footerLine2", e.target.value || null)}
                placeholder="Zapraszamy ponownie"
                className="mt-1"
                maxLength={40}
              />
            </div>
            <div>
              <Label htmlFor="footerLine3">Linia 3 (np. strona www)</Label>
              <Input
                id="footerLine3"
                value={getValue("footerLine3") as string}
                onChange={(e) => handleFieldChange("footerLine3", e.target.value || null)}
                placeholder="www.hotel.pl"
                className="mt-1"
                maxLength={40}
              />
            </div>
          </div>
        </section>

        {/* Nazwy pozycji */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Nazwy pozycji na paragonie</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Skonfiguruj jak nazywane są poszczególne typy usług na paragonie.
          </p>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="itemNameRoom">Nocleg</Label>
              <Input
                id="itemNameRoom"
                value={getValue("itemNameRoom") as string}
                onChange={(e) => handleFieldChange("itemNameRoom", e.target.value)}
                placeholder="Nocleg"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="itemNameDeposit">Zaliczka</Label>
              <Input
                id="itemNameDeposit"
                value={getValue("itemNameDeposit") as string}
                onChange={(e) => handleFieldChange("itemNameDeposit", e.target.value)}
                placeholder="Zaliczka"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="itemNameMinibar">Minibar</Label>
              <Input
                id="itemNameMinibar"
                value={getValue("itemNameMinibar") as string}
                onChange={(e) => handleFieldChange("itemNameMinibar", e.target.value)}
                placeholder="Minibar"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="itemNameLocalTax">Opłata miejscowa</Label>
              <Input
                id="itemNameLocalTax"
                value={getValue("itemNameLocalTax") as string}
                onChange={(e) => handleFieldChange("itemNameLocalTax", e.target.value)}
                placeholder="Opłata miejscowa"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="itemNameParking">Parking</Label>
              <Input
                id="itemNameParking"
                value={getValue("itemNameParking") as string}
                onChange={(e) => handleFieldChange("itemNameParking", e.target.value)}
                placeholder="Parking"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="itemNameService">Usługa (inne)</Label>
              <Input
                id="itemNameService"
                value={getValue("itemNameService") as string}
                onChange={(e) => handleFieldChange("itemNameService", e.target.value)}
                placeholder="Usługa"
                className="mt-1"
              />
            </div>
          </div>
        </section>

        {/* Opcje */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Opcje dodatkowe</h2>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="includeRoomNumber" className="text-base">
                  Dołącz numer pokoju
                </Label>
                <p className="text-sm text-muted-foreground">
                  Dodaje numer pokoju do nazwy pozycji (np. Nocleg pok. 101)
                </p>
              </div>
              <Switch
                id="includeRoomNumber"
                checked={getValue("includeRoomNumber") as boolean}
                onCheckedChange={(checked) => handleFieldChange("includeRoomNumber", checked)}
              />
            </div>

            {getValue("includeRoomNumber") && (
              <div>
                <Label htmlFor="roomNumberFormat">Format numeru pokoju</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Użyj {"{roomNumber}"} jako miejsca na numer pokoju.
                </p>
                <Input
                  id="roomNumberFormat"
                  value={getValue("roomNumberFormat") as string}
                  onChange={(e) => handleFieldChange("roomNumberFormat", e.target.value)}
                  placeholder="pok. {roomNumber}"
                  className="mt-1"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="includeStayDates" className="text-base">
                  Dołącz daty pobytu
                </Label>
                <p className="text-sm text-muted-foreground">
                  Dodaje zakres dat do nazwy pozycji (np. Nocleg (12.02-15.02))
                </p>
              </div>
              <Switch
                id="includeStayDates"
                checked={getValue("includeStayDates") as boolean}
                onCheckedChange={(checked) => handleFieldChange("includeStayDates", checked)}
              />
            </div>

            <div>
              <Label htmlFor="defaultVatRate">Domyślna stawka VAT (%)</Label>
              <Input
                id="defaultVatRate"
                type="number"
                min={0}
                max={23}
                value={getValue("defaultVatRate") as number}
                onChange={(e) => handleFieldChange("defaultVatRate", parseInt(e.target.value, 10) || 8)}
                className="mt-1 max-w-[120px]"
              />
            </div>
          </div>
        </section>

        {/* Podgląd */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Podgląd przykładowej pozycji</h2>
          <div className="bg-muted p-4 rounded font-mono text-sm">
            <div className="text-center mb-2">
              {getValue("headerLine1") && <div>{getValue("headerLine1")}</div>}
              {getValue("headerLine2") && <div>{getValue("headerLine2")}</div>}
              {getValue("headerLine3") && <div>{getValue("headerLine3")}</div>}
            </div>
            <div className="border-t border-dashed my-2" />
            <div className="flex justify-between">
              <span>{previewItemName()}</span>
              <span>150.00 PLN</span>
            </div>
            <div className="border-t border-dashed my-2" />
            <div className="flex justify-between font-bold">
              <span>SUMA</span>
              <span>150.00 PLN</span>
            </div>
            <div className="border-t border-dashed my-2" />
            <div className="text-center mt-2">
              {getValue("footerLine1") && <div>{getValue("footerLine1")}</div>}
              {getValue("footerLine2") && <div>{getValue("footerLine2")}</div>}
              {getValue("footerLine3") && <div>{getValue("footerLine3")}</div>}
            </div>
          </div>
        </section>

        {/* Akcje */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Zapisywanie..." : "Zapisz zmiany"}
          </Button>
        </div>
      </div>
    </div>
  );
}
