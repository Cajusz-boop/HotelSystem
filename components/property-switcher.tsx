"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { getProperties, getSelectedPropertyId, setSelectedProperty } from "@/app/actions/properties";

export function PropertySwitcher() {
  const router = useRouter();
  const [properties, setProperties] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getProperties(), getSelectedPropertyId()]).then(([propRes, selId]) => {
      if (propRes.success && propRes.data) setProperties(propRes.data);
      setSelectedId(selId);
    });
  }, []);

  if (properties.length < 2) return null;

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (!id) return;
    const result = await setSelectedProperty(id);
    if (result.success) {
      setSelectedId(id);
      router.refresh();
    }
  };

  return (
    <div className="mb-3 rounded-lg border border-border/50 bg-muted/30 p-2">
      <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
        Obiekt
      </label>
      <select
        value={selectedId ?? (properties[0]?.id ?? "")}
        onChange={handleChange}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Wybierz obiekt"
      >
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
