"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getInvoiceTemplate,
  updateInvoiceTemplate,
  removeInvoiceLogo,
  type InvoiceTemplateData,
} from "@/app/actions/finance";
import { toast } from "sonner";
import { FileText, ArrowLeft, Save, Upload, Trash2, Eye, RefreshCw } from "lucide-react";

export default function SzablonyPage() {
  const [template, setTemplate] = useState<InvoiceTemplateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState<Partial<InvoiceTemplateData>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getInvoiceTemplate("DEFAULT");
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
    field: keyof InvoiceTemplateData,
    value: string | number | null
  ) => {
    setEdited((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getValue = (field: keyof InvoiceTemplateData) => {
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
      const result = await updateInvoiceTemplate("DEFAULT", edited);
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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Walidacja typu pliku
    if (!file.type.startsWith("image/")) {
      toast.error("Wybierz plik graficzny (PNG, JPG, GIF)");
      return;
    }

    // Walidacja rozmiaru (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Maksymalny rozmiar logo to 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // Usuń prefix "data:image/png;base64," itp.
      const base64 = result.split(",")[1];
      handleFieldChange("logoBase64", base64);
      handleFieldChange("logoUrl", null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    setSaving(true);
    try {
      const result = await removeInvoiceLogo("DEFAULT");
      if (result.success) {
        toast.success("Logo usunięte");
        if (template) {
          setTemplate({ ...template, logoBase64: null, logoUrl: null });
        }
        setEdited((prev) => {
          const newEdited = { ...prev };
          delete newEdited.logoBase64;
          delete newEdited.logoUrl;
          return newEdited;
        });
      } else {
        toast.error("error" in result ? (result.error ?? "Błąd usuwania logo") : "Błąd usuwania logo");
      }
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(edited).length > 0;

  // Podgląd logo
  const logoPreviewSrc = edited.logoBase64 !== undefined
    ? (edited.logoBase64 ? `data:image/png;base64,${edited.logoBase64}` : null)
    : (template?.logoBase64 ? `data:image/png;base64,${template.logoBase64}` : template?.logoUrl);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Szablon faktury</h1>
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
          <FileText className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Szablon faktury</h1>
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
        Skonfiguruj wygląd faktur VAT, rachunków i innych dokumentów finansowych.
        Zmiany zostaną zastosowane do nowo generowanych dokumentów.
      </p>

      <div className="space-y-8">
        {/* Logo */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Logo</h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Logo firmy</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Prześlij logo w formacie PNG, JPG lub GIF (max 2MB).
              </p>
              
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Wybierz plik
                </Button>
                {logoPreviewSrc && (
                  <Button
                    variant="outline"
                    onClick={handleRemoveLogo}
                    disabled={saving}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Usuń logo
                  </Button>
                )}
              </div>
            </div>
            
            <div>
              {logoPreviewSrc && (
                <div className="border rounded-lg p-4 bg-white">
                  <p className="text-sm text-muted-foreground mb-2">Podgląd:</p>
                  {/* eslint-disable-next-line @next/next/no-img-element -- preview data URL */}
                  <img
                    src={logoPreviewSrc}
                    alt="Logo podgląd"
                    style={{ maxWidth: getValue("logoWidth") as number || 150, height: "auto" }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div>
              <Label htmlFor="logoWidth">Szerokość logo (px)</Label>
              <Input
                id="logoWidth"
                type="number"
                min={50}
                max={400}
                value={getValue("logoWidth") as number}
                onChange={(e) => handleFieldChange("logoWidth", parseInt(e.target.value, 10) || 150)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="logoPosition">Pozycja logo</Label>
              <Select
                value={getValue("logoPosition") as string}
                onValueChange={(value) => handleFieldChange("logoPosition", value)}
              >
                <SelectTrigger id="logoPosition" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Po lewej</SelectItem>
                  <SelectItem value="center">Wyśrodkowane</SelectItem>
                  <SelectItem value="right">Po prawej</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Dane sprzedawcy */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Dane sprzedawcy</h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="sellerName">Nazwa firmy</Label>
              <Input
                id="sellerName"
                value={getValue("sellerName") as string}
                onChange={(e) => handleFieldChange("sellerName", e.target.value)}
                placeholder="Nazwa hotelu / firmy"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sellerNip">NIP</Label>
              <Input
                id="sellerNip"
                value={getValue("sellerNip") as string}
                onChange={(e) => handleFieldChange("sellerNip", e.target.value)}
                placeholder="123-456-78-90"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sellerAddress">Adres (ulica i numer)</Label>
              <Input
                id="sellerAddress"
                value={getValue("sellerAddress") as string}
                onChange={(e) => handleFieldChange("sellerAddress", e.target.value)}
                placeholder="ul. Przykładowa 1"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="sellerPostalCode">Kod pocztowy</Label>
                <Input
                  id="sellerPostalCode"
                  value={getValue("sellerPostalCode") as string}
                  onChange={(e) => handleFieldChange("sellerPostalCode", e.target.value)}
                  placeholder="00-000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="sellerCity">Miasto</Label>
                <Input
                  id="sellerCity"
                  value={getValue("sellerCity") as string}
                  onChange={(e) => handleFieldChange("sellerCity", e.target.value)}
                  placeholder="Warszawa"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="sellerPhone">Telefon</Label>
              <Input
                id="sellerPhone"
                value={getValue("sellerPhone") as string}
                onChange={(e) => handleFieldChange("sellerPhone", e.target.value)}
                placeholder="+48 123 456 789"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sellerEmail">Email</Label>
              <Input
                id="sellerEmail"
                type="email"
                value={getValue("sellerEmail") as string}
                onChange={(e) => handleFieldChange("sellerEmail", e.target.value)}
                placeholder="kontakt@hotel.pl"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sellerWebsite">Strona WWW</Label>
              <Input
                id="sellerWebsite"
                value={getValue("sellerWebsite") as string}
                onChange={(e) => handleFieldChange("sellerWebsite", e.target.value)}
                placeholder="www.hotel.pl"
                className="mt-1"
              />
            </div>
          </div>
        </section>

        {/* Dane bankowe */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Dane bankowe</h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="sellerBankName">Nazwa banku</Label>
              <Input
                id="sellerBankName"
                value={getValue("sellerBankName") as string}
                onChange={(e) => handleFieldChange("sellerBankName", e.target.value)}
                placeholder="Bank XYZ"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sellerBankAccount">Numer konta (IBAN)</Label>
              <Input
                id="sellerBankAccount"
                value={getValue("sellerBankAccount") as string}
                onChange={(e) => handleFieldChange("sellerBankAccount", e.target.value)}
                placeholder="PL 12 3456 7890 1234 5678 9012 3456"
                className="mt-1"
              />
            </div>
          </div>
        </section>

        {/* Nazwy pozycji na fakturze */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Nazwy pozycji</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Określ, jak mają być nazywane produkty/usługi na fakturze. Puste pole = domyślna nazwa.
          </p>
          <div>
            <Label htmlFor="roomProductName">Nazwa usługi noclegowej</Label>
            <Input
              id="roomProductName"
              value={getValue("roomProductName") as string}
              onChange={(e) => handleFieldChange("roomProductName", e.target.value || null)}
              placeholder="Nocleg"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Domyślnie: „Nocleg”. Możesz np. zmienić na „Usługa noclegowa” albo własną nazwę.
            </p>
          </div>
        </section>

        {/* Nagłówek i stopka */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Nagłówek i stopka</h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="headerText">Tekst nagłówka (opcjonalny)</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Dodatkowy tekst wyświetlany nad tabelą pozycji.
              </p>
              <Textarea
                id="headerText"
                value={getValue("headerText") as string}
                onChange={(e) => handleFieldChange("headerText", e.target.value)}
                placeholder="Np. informacje dodatkowe, promocje..."
                rows={3}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="footerText">Tekst stopki</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Tekst wyświetlany pod dokumentem (np. informacje prawne).
              </p>
              <Textarea
                id="footerText"
                value={getValue("footerText") as string}
                onChange={(e) => handleFieldChange("footerText", e.target.value)}
                placeholder="Dziękujemy za skorzystanie z naszych usług."
                rows={3}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="thanksText">Podziękowanie</Label>
              <Input
                id="thanksText"
                value={getValue("thanksText") as string}
                onChange={(e) => handleFieldChange("thanksText", e.target.value)}
                placeholder="Zapraszamy ponownie!"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="paymentTermsText">Warunki płatności</Label>
              <Textarea
                id="paymentTermsText"
                value={getValue("paymentTermsText") as string}
                onChange={(e) => handleFieldChange("paymentTermsText", e.target.value)}
                placeholder="Termin płatności: 14 dni od daty wystawienia faktury."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
        </section>

        {/* Wygląd */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Wygląd</h2>
          
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="fontSize">Rozmiar czcionki (px)</Label>
              <Input
                id="fontSize"
                type="number"
                min={10}
                max={20}
                value={getValue("fontSize") as number}
                onChange={(e) => handleFieldChange("fontSize", parseInt(e.target.value, 10) || 14)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="primaryColor">Kolor tekstu</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="primaryColor"
                  type="color"
                  value={getValue("primaryColor") as string}
                  onChange={(e) => handleFieldChange("primaryColor", e.target.value)}
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={getValue("primaryColor") as string}
                  onChange={(e) => handleFieldChange("primaryColor", e.target.value)}
                  placeholder="#111111"
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="accentColor">Kolor akcentów</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="accentColor"
                  type="color"
                  value={getValue("accentColor") as string}
                  onChange={(e) => handleFieldChange("accentColor", e.target.value)}
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={getValue("accentColor") as string}
                  onChange={(e) => handleFieldChange("accentColor", e.target.value)}
                  placeholder="#2563eb"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Akcje */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => window.open("/api/finance/invoice/preview", "_blank")}
            disabled={!template}
          >
            <Eye className="w-4 h-4 mr-2" />
            Podgląd przykładowej faktury
          </Button>
          
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Zapisywanie..." : "Zapisz zmiany"}
          </Button>
        </div>
      </div>
    </div>
  );
}
