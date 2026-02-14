"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  getAllDocumentTemplates,
  updateDocumentTemplate,
  type DocumentTemplateData,
} from "@/app/actions/finance";
import { toast } from "sonner";
import { FileText, ArrowLeft, Save, Upload, Trash2, Eye, RefreshCw } from "lucide-react";

const TEMPLATE_LABELS: Record<string, string> = {
  CONFIRMATION: "Potwierdzenie rezerwacji",
  REGISTRATION_CARD: "Karta meldunkowa",
};

export default function DokumentyPage() {
  const [templates, setTemplates] = useState<DocumentTemplateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("CONFIRMATION");
  const [edited, setEdited] = useState<Record<string, Partial<DocumentTemplateData>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getAllDocumentTemplates();
      if (result.success && result.data) {
        setTemplates(result.data);
        setEdited({});
      } else {
        toast.error(result.error || "Błąd ładowania szablonów");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const getCurrentTemplate = () => {
    return templates.find((t) => t.templateType === activeTab);
  };

  const handleFieldChange = (
    field: keyof DocumentTemplateData,
    value: string | number | boolean | null
  ) => {
    setEdited((prev) => ({
      ...prev,
      [activeTab]: {
        ...(prev[activeTab] || {}),
        [field]: value,
      },
    }));
  };

  const getValue = (field: keyof DocumentTemplateData) => {
    const editedValue = edited[activeTab]?.[field];
    if (editedValue !== undefined) {
      return editedValue;
    }
    const template = getCurrentTemplate();
    return template?.[field] ?? "";
  };

  const handleSave = async () => {
    const editedForTab = edited[activeTab];
    if (!editedForTab || Object.keys(editedForTab).length === 0) {
      toast.info("Brak zmian do zapisania");
      return;
    }

    setSaving(true);
    try {
      const result = await updateDocumentTemplate(activeTab, editedForTab);
      if (result.success && result.data) {
        toast.success("Szablon zapisany");
        setTemplates((prev) =>
          prev.map((t) => (t.templateType === activeTab ? result.data! : t))
        );
        setEdited((prev) => {
          const newEdited = { ...prev };
          delete newEdited[activeTab];
          return newEdited;
        });
      } else {
        toast.error(result.error || "Błąd zapisu");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Wybierz plik graficzny (PNG, JPG, GIF)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Maksymalny rozmiar logo to 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const base64 = result.split(",")[1];
      handleFieldChange("logoBase64", base64);
      handleFieldChange("logoUrl", null);
      handleFieldChange("useInvoiceLogo", false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    handleFieldChange("logoBase64", null);
    handleFieldChange("logoUrl", null);
  };

  const hasChanges = !!edited[activeTab] && Object.keys(edited[activeTab]).length > 0;

  // Logo preview logic
  const template = getCurrentTemplate();
  const useInvoiceLogo = (edited[activeTab]?.useInvoiceLogo ?? template?.useInvoiceLogo) !== false;
  const logoBase64 = edited[activeTab]?.logoBase64 !== undefined
    ? edited[activeTab]?.logoBase64
    : template?.logoBase64;
  const logoUrl = edited[activeTab]?.logoUrl !== undefined
    ? edited[activeTab]?.logoUrl
    : template?.logoUrl;
  const logoPreviewSrc = !useInvoiceLogo
    ? (logoBase64 ? `data:image/png;base64,${logoBase64}` : logoUrl)
    : null;

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Szablony dokumentów</h1>
        </div>
        <p className="text-muted-foreground">Ładowanie...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Szablony dokumentów</h1>
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
        Konfiguruj wygląd potwierdzeń rezerwacji i kart meldunkowych.
        Możesz użyć logo i danych z szablonu faktury lub ustawić własne.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          {templates.map((t) => (
            <TabsTrigger key={t.templateType} value={t.templateType}>
              {TEMPLATE_LABELS[t.templateType] || t.templateType}
            </TabsTrigger>
          ))}
        </TabsList>

        {templates.map((t) => (
          <TabsContent key={t.templateType} value={t.templateType}>
            <div className="space-y-6">
              {/* Tytuł dokumentu */}
              <section className="rounded-lg border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Tytuł dokumentu</h2>
                <div>
                  <Label htmlFor="title">Tytuł</Label>
                  <Input
                    id="title"
                    value={getValue("title") as string}
                    onChange={(e) => handleFieldChange("title", e.target.value)}
                    placeholder={activeTab === "CONFIRMATION" ? "POTWIERDZENIE REZERWACJI" : "KARTA MELDUNKOWA"}
                    className="mt-1"
                  />
                </div>
              </section>

              {/* Logo */}
              <section className="rounded-lg border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Logo</h2>
                
                <div className="flex items-center gap-2 mb-4">
                  <Switch
                    id="useInvoiceLogo"
                    checked={getValue("useInvoiceLogo") as boolean}
                    onCheckedChange={(checked) => handleFieldChange("useInvoiceLogo", checked)}
                  />
                  <Label htmlFor="useInvoiceLogo">
                    Użyj logo z szablonu faktury
                  </Label>
                </div>

                {!getValue("useInvoiceLogo") && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Własne logo</Label>
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
                          <img
                            src={logoPreviewSrc}
                            alt="Logo podgląd"
                            style={{ maxWidth: getValue("logoWidth") as number || 150, height: "auto" }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
                      disabled={getValue("useInvoiceLogo") as boolean}
                    />
                    {getValue("useInvoiceLogo") && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Szerokość pobierana z szablonu faktury
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="logoPosition">Pozycja logo</Label>
                    <Select
                      value={getValue("logoPosition") as string}
                      onValueChange={(value) => handleFieldChange("logoPosition", value)}
                      disabled={getValue("useInvoiceLogo") as boolean}
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

              {/* Dane hotelu */}
              <section className="rounded-lg border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Dane hotelu</h2>
                
                <div className="flex items-center gap-2 mb-4">
                  <Switch
                    id="useInvoiceSeller"
                    checked={getValue("useInvoiceSeller") as boolean}
                    onCheckedChange={(checked) => handleFieldChange("useInvoiceSeller", checked)}
                  />
                  <Label htmlFor="useInvoiceSeller">
                    Użyj danych sprzedawcy z szablonu faktury
                  </Label>
                </div>

                {!getValue("useInvoiceSeller") && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="hotelName">Nazwa hotelu</Label>
                      <Input
                        id="hotelName"
                        value={getValue("hotelName") as string}
                        onChange={(e) => handleFieldChange("hotelName", e.target.value)}
                        placeholder="Hotel XYZ"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hotelAddress">Adres</Label>
                      <Input
                        id="hotelAddress"
                        value={getValue("hotelAddress") as string}
                        onChange={(e) => handleFieldChange("hotelAddress", e.target.value)}
                        placeholder="ul. Przykładowa 1"
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="hotelPostalCode">Kod pocztowy</Label>
                        <Input
                          id="hotelPostalCode"
                          value={getValue("hotelPostalCode") as string}
                          onChange={(e) => handleFieldChange("hotelPostalCode", e.target.value)}
                          placeholder="00-000"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="hotelCity">Miasto</Label>
                        <Input
                          id="hotelCity"
                          value={getValue("hotelCity") as string}
                          onChange={(e) => handleFieldChange("hotelCity", e.target.value)}
                          placeholder="Warszawa"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="hotelPhone">Telefon</Label>
                      <Input
                        id="hotelPhone"
                        value={getValue("hotelPhone") as string}
                        onChange={(e) => handleFieldChange("hotelPhone", e.target.value)}
                        placeholder="+48 123 456 789"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hotelEmail">Email</Label>
                      <Input
                        id="hotelEmail"
                        type="email"
                        value={getValue("hotelEmail") as string}
                        onChange={(e) => handleFieldChange("hotelEmail", e.target.value)}
                        placeholder="kontakt@hotel.pl"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hotelWebsite">Strona WWW</Label>
                      <Input
                        id="hotelWebsite"
                        value={getValue("hotelWebsite") as string}
                        onChange={(e) => handleFieldChange("hotelWebsite", e.target.value)}
                        placeholder="www.hotel.pl"
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* Treść dokumentu */}
              <section className="rounded-lg border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Treść dokumentu</h2>
                
                <div className="space-y-4">
                  {activeTab === "CONFIRMATION" && (
                    <div>
                      <Label htmlFor="welcomeText">Tekst powitalny</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        Wyświetlany pod nagłówkiem (np. podziękowanie za rezerwację).
                      </p>
                      <Textarea
                        id="welcomeText"
                        value={getValue("welcomeText") as string}
                        onChange={(e) => handleFieldChange("welcomeText", e.target.value)}
                        placeholder="Dziękujemy za dokonanie rezerwacji w naszym hotelu."
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="headerText">Tekst nagłówka (opcjonalny)</Label>
                    <Textarea
                      id="headerText"
                      value={getValue("headerText") as string}
                      onChange={(e) => handleFieldChange("headerText", e.target.value)}
                      placeholder="Dodatkowe informacje..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="termsText">Regulamin / warunki</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      {activeTab === "CONFIRMATION"
                        ? "Warunki rezerwacji (anulacja, polityka płatności)."
                        : "Regulamin obiektu wyświetlany na karcie meldunkowej."}
                    </p>
                    <Textarea
                      id="termsText"
                      value={getValue("termsText") as string}
                      onChange={(e) => handleFieldChange("termsText", e.target.value)}
                      placeholder="Rezerwacja może być anulowana bezpłatnie do 24h przed przyjazdem..."
                      rows={4}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="footerText">Tekst stopki</Label>
                    <Textarea
                      id="footerText"
                      value={getValue("footerText") as string}
                      onChange={(e) => handleFieldChange("footerText", e.target.value)}
                      placeholder="W razie pytań prosimy o kontakt. Do zobaczenia!"
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                </div>
              </section>

              {/* Opcje specyficzne dla karty meldunkowej */}
              {activeTab === "REGISTRATION_CARD" && (
                <section className="rounded-lg border bg-card p-6 shadow-sm">
                  <h2 className="text-lg font-semibold mb-4">Pola formularza</h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="showIdField"
                        checked={getValue("showIdField") as boolean}
                        onCheckedChange={(checked) => handleFieldChange("showIdField", checked)}
                      />
                      <Label htmlFor="showIdField">
                        Pokaż pole „Nr dowodu / paszportu"
                      </Label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        id="showVehicleField"
                        checked={getValue("showVehicleField") as boolean}
                        onCheckedChange={(checked) => handleFieldChange("showVehicleField", checked)}
                      />
                      <Label htmlFor="showVehicleField">
                        Pokaż pole „Nr rejestracyjny pojazdu"
                      </Label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        id="showSignatureField"
                        checked={getValue("showSignatureField") as boolean}
                        onCheckedChange={(checked) => handleFieldChange("showSignatureField", checked)}
                      />
                      <Label htmlFor="showSignatureField">
                        Pokaż sekcję z podpisem gościa
                      </Label>
                    </div>
                  </div>
                </section>
              )}

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
                  onClick={() => {
                    // Otwórz przykładowy podgląd - potrzebujemy rezerwacji do podglądu
                    toast.info("Aby zobaczyć podgląd, wejdź w szczegóły dowolnej rezerwacji i kliknij drukuj potwierdzenie/kartę meldunkową.");
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Informacje o podglądzie
                </Button>
                
                <Button onClick={handleSave} disabled={saving || !hasChanges}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Zapisywanie..." : "Zapisz zmiany"}
                </Button>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
