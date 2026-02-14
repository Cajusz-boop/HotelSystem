"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAllEmailTemplates,
  getEmailTemplateById,
  saveEmailTemplate,
  resetEmailTemplate,
  type EmailTemplateForList,
  type EmailTemplateDetails,
  type EmailTemplateType,
} from "@/app/actions/mailing";

const TEMPLATE_TYPES: Record<EmailTemplateType, string> = {
  CONFIRMATION: "Potwierdzenie rezerwacji",
  REMINDER: "Przypomnienie o rezerwacji",
  THANK_YOU: "Podziękowanie po pobycie",
  INVOICE: "Faktura",
  CANCELLATION: "Anulowanie rezerwacji",
  WEB_CHECK_IN: "Link do Web Check-in",
};

export default function SzablonyEmailPage() {
  const [templates, setTemplates] = useState<EmailTemplateForList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Edycja szablonu
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateDetails | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBodyHtml, setEditBodyHtml] = useState("");
  const [editBodyText, setEditBodyText] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getAllEmailTemplates();
    setLoading(false);
    if (res.success) {
      setTemplates(res.data);
    } else {
      setError(res.error ?? "Błąd ładowania szablonów");
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleSelectTemplate = async (templateId: string) => {
    setEditLoading(true);
    setSelectedTemplate(null);
    setSaveSuccess(null);
    setShowPreview(false);

    const res = await getEmailTemplateById(templateId);
    setEditLoading(false);

    if (res.success) {
      setSelectedTemplate(res.data);
      setEditName(res.data.name);
      setEditSubject(res.data.subject);
      setEditBodyHtml(res.data.bodyHtml);
      setEditBodyText(res.data.bodyText ?? "");
      setEditIsActive(res.data.isActive);
    } else {
      setError(res.error ?? "Błąd ładowania szablonu");
    }
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;

    setSaveLoading(true);
    setError(null);
    setSaveSuccess(null);

    const res = await saveEmailTemplate({
      type: selectedTemplate.type as EmailTemplateType,
      name: editName,
      subject: editSubject,
      bodyHtml: editBodyHtml,
      bodyText: editBodyText || null,
      isActive: editIsActive,
    });

    setSaveLoading(false);

    if (res.success) {
      setSaveSuccess("Szablon został zapisany");
      loadTemplates();
    } else {
      setError(res.error ?? "Błąd zapisywania");
    }
  };

  const handleReset = async () => {
    if (!selectedTemplate) return;
    if (!confirm("Czy na pewno chcesz przywrócić domyślny szablon? Zmiany zostaną utracone.")) {
      return;
    }

    const res = await resetEmailTemplate(selectedTemplate.type as EmailTemplateType);

    if (res.success) {
      // Załaduj ponownie szablon (domyślny)
      handleSelectTemplate(`default-${selectedTemplate.type}`);
      loadTemplates();
    } else {
      setError(res.error ?? "Błąd resetowania");
    }
  };

  // Przykładowe dane do podglądu
  const previewVariables: Record<string, string> = {
    guestName: "Jan Kowalski",
    roomNumber: "101",
    checkIn: "15.03.2026",
    checkOut: "18.03.2026",
    nights: "3",
    confirmationNumber: "RES2026031501",
    totalAmount: "1200.00",
    invoiceNumber: "FV/2026/0001",
    dueDate: "30.03.2026",
    companyName: "Przykładowa Firma Sp. z o.o.",
    companyNip: "1234567890",
    webCheckInUrl: "https://hotel.pl/check-in/abc123",
    expiresAt: "14.03.2026 12:00",
    cancellationReason: "Zmiana planów",
  };

  const renderPreview = (html: string) => {
    let result = html;
    for (const [key, value] of Object.entries(previewVariables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    // Usuń nieużyte zmienne
    result = result.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, "");
    // Obsłuż warunki
    result = result.replace(/\{\{#([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, varName, content) => {
      return previewVariables[varName] ? content : "";
    });
    return result;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Szablony e-mail</h1>
        <Link href="/ustawienia">
          <Button variant="outline">Powrót do ustawień</Button>
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Lista szablonów */}
        <div className="p-4 border rounded-lg bg-card">
          <h2 className="font-medium mb-4">Dostępne szablony</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Ładowanie...</p>
          ) : (
            <div className="space-y-2">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedTemplate?.type === tpl.type
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                  onClick={() => handleSelectTemplate(tpl.id)}
                >
                  <p className="font-medium">{TEMPLATE_TYPES[tpl.type as EmailTemplateType] ?? tpl.name}</p>
                  <p className={`text-xs ${selectedTemplate?.type === tpl.type ? "opacity-80" : "text-muted-foreground"}`}>
                    {tpl.type}
                  </p>
                  {!tpl.isActive && (
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded mt-1 inline-block">
                      Nieaktywny
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edytor szablonu */}
        <div className="md:col-span-2 p-4 border rounded-lg bg-card">
          {editLoading ? (
            <p className="text-sm text-muted-foreground">Ładowanie szablonu...</p>
          ) : selectedTemplate ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-lg">
                  {TEMPLATE_TYPES[selectedTemplate.type as EmailTemplateType]}
                </h2>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    {showPreview ? "Edycja" : "Podgląd"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleReset}>
                    Przywróć domyślny
                  </Button>
                </div>
              </div>

              {saveSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm">
                  {saveSuccess}
                </div>
              )}

              {showPreview ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Temat</p>
                    <p className="font-medium p-2 bg-muted rounded">
                      {renderPreview(editSubject)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Treść (HTML)</p>
                    <div
                      className="p-4 bg-white border rounded prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: renderPreview(editBodyHtml) }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="editName">Nazwa szablonu</Label>
                      <Input
                        id="editName"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editIsActive}
                          onChange={(e) => setEditIsActive(e.target.checked)}
                        />
                        <span>Szablon aktywny</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="editSubject">Temat e-maila</Label>
                    <Input
                      id="editSubject"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="mt-1"
                      placeholder="Temat może zawierać {{zmienne}}"
                    />
                  </div>

                  <div>
                    <Label htmlFor="editBodyHtml">Treść HTML</Label>
                    <textarea
                      id="editBodyHtml"
                      value={editBodyHtml}
                      onChange={(e) => setEditBodyHtml(e.target.value)}
                      rows={12}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      placeholder="<p>Treść e-maila w HTML...</p>"
                    />
                  </div>

                  <div>
                    <Label htmlFor="editBodyText">Treść tekstowa (opcjonalnie)</Label>
                    <textarea
                      id="editBodyText"
                      value={editBodyText}
                      onChange={(e) => setEditBodyText(e.target.value)}
                      rows={6}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      placeholder="Wersja tekstowa dla klientów bez HTML..."
                    />
                  </div>

                  {selectedTemplate.availableVariables && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Dostępne zmienne:</p>
                      <p className="text-sm font-mono">{selectedTemplate.availableVariables}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 border-t">
                    <Button onClick={handleSave} disabled={saveLoading}>
                      {saveLoading ? "Zapisywanie..." : "Zapisz zmiany"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Wybierz szablon z listy, aby go edytować.</p>
            </div>
          )}
        </div>
      </div>

      {/* Dokumentacja */}
      <div className="mt-6 p-4 border rounded-lg bg-muted/50">
        <h3 className="font-medium mb-2">Jak używać szablonów</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>Użyj <code className="bg-muted px-1 rounded">{"{{nazwa}}"}</code> aby wstawić zmienną (np. {"{{guestName}}"} dla imienia gościa).</li>
          <li>Użyj <code className="bg-muted px-1 rounded">{"{{#zmienna}}...{{/zmienna}}"}</code> aby wyświetlić fragment tylko gdy zmienna istnieje.</li>
          <li>Nieaktywne szablony nie będą używane do wysyłki (system użyje domyślnych).</li>
          <li>Przycisk "Przywróć domyślny" usuwa niestandardowe zmiany i przywraca oryginalny szablon.</li>
        </ul>
      </div>
    </div>
  );
}
