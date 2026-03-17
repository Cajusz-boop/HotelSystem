export interface GuestCountryOption {
  code: string;
  label: string;
  aliases: string[];
}

const OTHER_COUNTRY_CODE = "OTHER";

export const GUEST_COUNTRY_OPTIONS: GuestCountryOption[] = [
  { code: "PL", label: "Polska", aliases: ["PL", "POL", "POLSKA", "POLAND"] },
  { code: "DE", label: "Niemcy", aliases: ["DE", "DEU", "NIEMCY", "GERMANY", "DEUTSCHLAND"] },
  { code: "CZ", label: "Czechy", aliases: ["CZ", "CZE", "CZECHY", "CZECHIA", "CZECH REPUBLIC"] },
  { code: "SK", label: "Słowacja", aliases: ["SK", "SVK", "SLOWACJA", "SLOVAKIA"] },
  { code: "UA", label: "Ukraina", aliases: ["UA", "UKR", "UKRAINA", "UKRAINE"] },
  { code: "LT", label: "Litwa", aliases: ["LT", "LTU", "LITWA", "LITHUANIA"] },
  { code: "BY", label: "Białoruś", aliases: ["BY", "BLR", "BIALORUS", "BELARUS"] },
  { code: "RU", label: "Rosja", aliases: ["RU", "RUS", "ROSJA", "RUSSIA"] },
  {
    code: "GB",
    label: "Wielka Brytania",
    aliases: ["GB", "GBR", "UK", "WIELKA BRYTANIA", "UNITED KINGDOM", "GREAT BRITAIN"],
  },
  { code: "FR", label: "Francja", aliases: ["FR", "FRA", "FRANCJA", "FRANCE"] },
  { code: "IT", label: "Włochy", aliases: ["IT", "ITA", "WLOCHY", "ITALY"] },
  { code: "ES", label: "Hiszpania", aliases: ["ES", "ESP", "HISZPANIA", "SPAIN"] },
  { code: "NL", label: "Holandia", aliases: ["NL", "NLD", "HOLANDIA", "NETHERLANDS"] },
  { code: "SE", label: "Szwecja", aliases: ["SE", "SWE", "SZWECJA", "SWEDEN"] },
  { code: "DK", label: "Dania", aliases: ["DK", "DNK", "DANIA", "DENMARK"] },
  { code: "NO", label: "Norwegia", aliases: ["NO", "NOR", "NORWEGIA", "NORWAY"] },
  { code: "US", label: "USA", aliases: ["US", "USA", "STANY ZJEDNOCZONE", "UNITED STATES"] },
  { code: "IL", label: "Izrael", aliases: ["IL", "ISR", "IZRAEL", "ISRAEL"] },
  { code: "JP", label: "Japonia", aliases: ["JP", "JPN", "JAPONIA", "JAPAN"] },
  { code: OTHER_COUNTRY_CODE, label: "Inny", aliases: ["OTHER", "INNY", "INNE", "UNKNOWN"] },
];

const aliasToCode = new Map<string, string>();

for (const option of GUEST_COUNTRY_OPTIONS) {
  for (const alias of option.aliases) {
    aliasToCode.set(normalizeCountryLookupKey(alias), option.code);
  }
}

function normalizeCountryLookupKey(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function normalizeGuestCountryForStorage(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") return null;

  const normalized = normalizeCountryLookupKey(value);
  const mappedCode = aliasToCode.get(normalized);
  if (mappedCode) {
    return mappedCode;
  }

  if (/^[A-Z]{2}$/.test(normalized)) {
    return normalized;
  }

  return value.trim();
}

export function getKt1CountryCode(value: string | null | undefined): string {
  if (value == null || value.trim() === "") return "PL";

  const normalized = normalizeCountryLookupKey(value);
  const mappedCode = aliasToCode.get(normalized);
  if (mappedCode) {
    return mappedCode;
  }

  if (normalized === "POL") {
    return "PL";
  }

  if (/^[A-Z]{2}$/.test(normalized)) {
    return normalized;
  }

  return OTHER_COUNTRY_CODE;
}

export function isForeignCountry(value: string | null | undefined): boolean {
  return getKt1CountryCode(value) !== "PL";
}

export function getGuestCountryLabel(code: string): string {
  return GUEST_COUNTRY_OPTIONS.find((option) => option.code === code)?.label ?? code;
}
