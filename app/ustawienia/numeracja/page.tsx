"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  getAllDocumentNumberingConfigs,
  updateDocumentNumberingConfig,
  getDocumentNumberCounters,
  type DocumentNumberingConfigData,
  type DocumentType,
} from "@/app/actions/finance";
import { toast } from "sonner";
import { FileText, ArrowLeft, Save, RefreshCw } from "lucide-react";

// Mapowanie typów dokumentów na czytelne nazwy
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  INVOICE: "Faktura VAT",
  CORRECTION: "Korekta faktury",
  CONSOLIDATED_INVOICE: "Faktura zbiorcza",
  RECEIPT: "Rachunek (nie-VAT)",
  ACCOUNTING_NOTE: "Nota księgowa",
  PROFORMA: "Proforma",
};

export default function NumeracjaPage() {
  const [configs, setConfigs] = useState<DocumentNumberingConfigData[]>([]);
  const [counters, setCounters] = useState<
    Array<{ documentType: string; year: number; lastSequence: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedConfigs, setEditedConfigs] = useState<
    Record<string, Partial<DocumentNumberingConfigData>>
  >({});

  const load = async () => {
    setLoading(true);
    try {
      const [configsResult, countersResult] = await Promise.all([
        getAllDocumentNumberingConfigs(),
        getDocumentNumberCounters(),
      ]);

      if (configsResult.success && configsResult.data) {
        setConfigs(configsResult.data);
      } else {
        toast.error(configsResult.error || "Błąd ładowania konfiguracji");
      }

      if (countersResult.success && countersResult.data) {
        setCounters(countersResult.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFieldChange = (
    documentType: string,
    field: keyof DocumentNumberingConfigData,
    value: string | number | boolean
  ) => {
    setEditedConfigs((prev) => ({
      ...prev,
      [documentType]: {
        ...prev[documentType],
        [field]: value,
      },
    }));
  };

  const handleSave = async (config: DocumentNumberingConfigData) => {
    const edited = editedConfigs[config.documentType];
    if (!edited || Object.keys(edited).length === 0) {
      toast.info("Brak zmian do zapisania");
      return;
    }

    setSaving(config.documentType);
    try {
      const result = await updateDocumentNumberingConfig(
        config.documentType as DocumentType,
        {
          prefix: edited.prefix as string | undefined,
          separator: edited.separator as string | undefined,
          yearFormat: edited.yearFormat as "YYYY" | "YY" | undefined,
          sequencePadding: edited.sequencePadding as number | undefined,
          resetYearly: edited.resetYearly as boolean | undefined,
        }
      );

      if (result.success && result.data) {
        toast.success("Konfiguracja zapisana");
        setConfigs((prev) =>
          prev.map((c) =>
            c.documentType === config.documentType ? result.data! : c
          )
        );
        setEditedConfigs((prev) => {
          const newState = { ...prev };
          delete newState[config.documentType];
          return newState;
        });
      } else {
        toast.error(result.error || "Błąd zapisu");
      }
    } finally {
      setSaving(null);
    }
  };

  const getConfigValue = (
    config: DocumentNumberingConfigData,
    field: keyof DocumentNumberingConfigData
  ) => {
    const edited = editedConfigs[config.documentType];
    if (edited && field in edited) {
      return edited[field];
    }
    return config[field];
  };

  const hasChanges = (documentType: string) => {
    const edited = editedConfigs[documentType];
    return edited && Object.keys(edited).length > 0;
  };

  // Generuj przykładowy numer na podstawie konfiguracji
  const generatePreview = (config: DocumentNumberingConfigData) => {
    const prefix = getConfigValue(config, "prefix") as string;
    const separator = getConfigValue(config, "separator") as string;
    const yearFormat = getConfigValue(config, "yearFormat") as string;
    const padding = getConfigValue(config, "sequencePadding") as number;

    const year = new Date().getFullYear();
    const yearStr = yearFormat === "YY" ? String(year).slice(-2) : String(year);
    const seqStr = "1".padStart(padding, "0");

    return `${prefix}${separator}${yearStr}${separator}${seqStr}`;
  };

  // Znajdź ostatni numer dla typu dokumentu
  const getLastNumber = (documentType: string) => {
    const counter = counters.find(
      (c) => c.documentType === documentType && c.year === new Date().getFullYear()
    );
    return counter?.lastSequence || 0;
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Numeracja dokumentów</h1>
        </div>
        <p className="text-muted-foreground">Ładowanie...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Numeracja dokumentów</h1>
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
        Konfiguruj format numeracji dla dokumentów finansowych. Zmiany wpłyną na nowo wystawiane
        dokumenty. Istniejące numery pozostaną bez zmian.
      </p>

      <div className="space-y-6">
        {configs.map((config) => (
          <div
            key={config.id}
            className="rounded-lg border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {DOCUMENT_TYPE_LABELS[config.documentType] || config.documentType}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {config.description}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Podgląd</p>
                <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                  {generatePreview(config)}
                </code>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
              {/* Prefix */}
              <div>
                <Label htmlFor={`prefix-${config.documentType}`}>Prefix</Label>
                <Input
                  id={`prefix-${config.documentType}`}
                  value={getConfigValue(config, "prefix") as string}
                  onChange={(e) =>
                    handleFieldChange(
                      config.documentType,
                      "prefix",
                      e.target.value.toUpperCase()
                    )
                  }
                  placeholder="FV"
                  className="mt-1"
                />
              </div>

              {/* Separator */}
              <div>
                <Label htmlFor={`separator-${config.documentType}`}>Separator</Label>
                <Select
                  value={getConfigValue(config, "separator") as string}
                  onValueChange={(value) =>
                    handleFieldChange(config.documentType, "separator", value)
                  }
                >
                  <SelectTrigger id={`separator-${config.documentType}`} className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="/">/</SelectItem>
                    <SelectItem value="-">-</SelectItem>
                    <SelectItem value="_">_</SelectItem>
                    <SelectItem value=".">.</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Format roku */}
              <div>
                <Label htmlFor={`yearFormat-${config.documentType}`}>Format roku</Label>
                <Select
                  value={getConfigValue(config, "yearFormat") as string}
                  onValueChange={(value) =>
                    handleFieldChange(config.documentType, "yearFormat", value)
                  }
                >
                  <SelectTrigger id={`yearFormat-${config.documentType}`} className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YYYY">YYYY (2026)</SelectItem>
                    <SelectItem value="YY">YY (26)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Długość sekwencji */}
              <div>
                <Label htmlFor={`padding-${config.documentType}`}>Długość numeru</Label>
                <Select
                  value={String(getConfigValue(config, "sequencePadding"))}
                  onValueChange={(value) =>
                    handleFieldChange(
                      config.documentType,
                      "sequencePadding",
                      parseInt(value, 10)
                    )
                  }
                >
                  <SelectTrigger id={`padding-${config.documentType}`} className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 (001)</SelectItem>
                    <SelectItem value="4">4 (0001)</SelectItem>
                    <SelectItem value="5">5 (00001)</SelectItem>
                    <SelectItem value="6">6 (000001)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reset roczny */}
              <div className="flex flex-col justify-end">
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    id={`reset-${config.documentType}`}
                    checked={getConfigValue(config, "resetYearly") as boolean}
                    onCheckedChange={(checked) =>
                      handleFieldChange(config.documentType, "resetYearly", checked)
                    }
                  />
                  <Label
                    htmlFor={`reset-${config.documentType}`}
                    className="text-sm cursor-pointer"
                  >
                    Reset roczny
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Ostatni numer w {new Date().getFullYear()}:{" "}
                <span className="font-medium">{getLastNumber(config.documentType)}</span>
              </div>
              <Button
                onClick={() => handleSave(config)}
                disabled={saving === config.documentType || !hasChanges(config.documentType)}
                size="sm"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving === config.documentType ? "Zapisywanie..." : "Zapisz zmiany"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
