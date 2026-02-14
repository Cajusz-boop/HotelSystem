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
import {
  getFormFieldsConfig,
  updateFormFieldsConfig,
  FORM_TYPE_LABELS,
  type FormFieldsConfig,
  type CustomFormField,
  type FormType,
  type CustomFormFieldType,
} from "@/app/actions/hotel-config";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, GripVertical, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const FIELD_TYPES: { value: CustomFormFieldType; label: string }[] = [
  { value: "text", label: "Tekst" },
  { value: "number", label: "Liczba" },
  { value: "date", label: "Data" },
  { value: "checkbox", label: "Checkbox" },
  { value: "select", label: "Lista (select)" },
];

function generateId(): string {
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function PolaFormularzyPage() {
  const [config, setConfig] = useState<FormFieldsConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeFormType, setActiveFormType] = useState<FormType>("CHECK_IN");

  const load = async () => {
    setLoading(true);
    try {
      const result = await getFormFieldsConfig();
      if (result.success && result.data) {
        setConfig(result.data);
      } else {
        toast.error(result.error || "Błąd ładowania konfiguracji");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const fields = config[activeFormType] ?? [];

  const setFields = (newFields: CustomFormField[]) => {
    setConfig((prev) => ({
      ...prev,
      [activeFormType]: newFields,
    }));
  };

  const addField = () => {
    const key = `pole_${fields.length + 1}`;
    setFields([
      ...fields,
      {
        id: generateId(),
        key,
        label: `Pole ${fields.length + 1}`,
        type: "text",
        required: false,
        order: fields.length,
        options: undefined,
      },
    ]);
  };

  const updateField = (index: number, patch: Partial<CustomFormField>) => {
    const next = [...fields];
    next[index] = { ...next[index]!, ...patch };
    setFields(next);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const next = [...fields];
    [next[index], next[newIndex]] = [next[newIndex]!, next[index]!];
    setFields(next.map((f, i) => ({ ...f, order: i })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateFormFieldsConfig(config);
      if (result.success) {
        toast.success("Konfiguracja zapisana");
      } else {
        toast.error(result.error || "Błąd zapisu");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Ładowanie…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/ustawienia">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Dodatkowe pola formularzy</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Zapisywanie…" : "Zapisz"}
        </Button>
      </div>

      <p className="text-muted-foreground mb-6">
        Definiuj dodatkowe pola wyświetlane w formularzach: meldunku, rezerwacji i karcie gościa. Klucz (key) służy do zapisu wartości (np. w metadanych rezerwacji).
      </p>

      <div className="flex gap-2 mb-4 border-b pb-2">
        {(Object.keys(FORM_TYPE_LABELS) as FormType[]).map((formType) => (
          <Button
            key={formType}
            variant={activeFormType === formType ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFormType(formType)}
          >
            {FORM_TYPE_LABELS[formType]}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="flex flex-wrap items-start gap-3 p-4 rounded-lg border bg-card"
          >
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => moveField(index, "up")}
                disabled={index === 0}
              >
                <GripVertical className="w-4 h-4 rotate-90" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => moveField(index, "down")}
                disabled={index === fields.length - 1}
              >
                <GripVertical className="w-4 h-4 -rotate-90" />
              </Button>
            </div>
            <div className="grid gap-2 flex-1 min-w-[200px]">
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Klucz (np. nr_dowodu)"
                  value={field.key}
                  onChange={(e) => updateField(index, { key: e.target.value })}
                  className="max-w-[180px]"
                />
                <Input
                  placeholder="Etykieta"
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  className="flex-1"
                />
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <Select
                  value={field.type}
                  onValueChange={(v) => updateField(index, { type: v as CustomFormFieldType })}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`req-${field.id}`}
                    checked={field.required}
                    onCheckedChange={(checked) => updateField(index, { required: checked })}
                  />
                  <Label htmlFor={`req-${field.id}`}>Wymagane</Label>
                </div>
                {field.type === "select" && (
                  <Input
                    placeholder="Opcje (oddzielone przecinkiem)"
                    value={field.options?.join(", ") ?? ""}
                    onChange={(e) =>
                      updateField(index, {
                        options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="min-w-[220px]"
                  />
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => removeField(index)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addField}>
          <Plus className="w-4 h-4 mr-2" />
          Dodaj pole
        </Button>
      </div>
    </div>
  );
}
