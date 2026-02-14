"use client";

import { useI18n } from "@/components/i18n-provider";
import type { Locale } from "@/lib/i18n/translations";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";

const localeLabels: Record<Locale, string> = {
  pl: "Polski",
  en: "English",
  de: "Deutsch",
};

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="flex items-center gap-1">
      <Languages className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <select
        aria-label={t("language")}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className={cn(
          "h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
      >
        {(Object.keys(localeLabels) as Locale[]).map((l) => (
          <option key={l} value={l}>
            {localeLabels[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
