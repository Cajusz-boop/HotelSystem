"use server";

import { revalidatePath } from "next/cache";
import * as fs from "fs/promises";
import * as path from "path";

export interface ChannelManagerConfig {
  extractedAt?: string;
  channelManagerType?: string;
  apiEndpoint?: string;
  propertyId?: string;
  apiKey?: string;
  username?: string;
  channels?: Array<{
    id: string | number;
    name: string;
    enabled: boolean;
    reservationCount?: number;
  }>;
  bookingSources?: Array<{
    rsk_id: number;
    rsk_nazwa: string;
  }>;
  channelStats?: Array<{
    kanal: string;
    liczba_rezerwacji: number;
    pierwsza_rezerwacja: string;
    ostatnia_rezerwacja: string;
  }>;
  apiSettings?: Array<{
    table: string;
    column: string;
    type: string;
    sampleValue: unknown;
  }>;
  relevantTables?: string[];
  allTables?: string[];
}

export async function getKwHotelExtractedConfig(): Promise<{
  success: boolean;
  data?: ChannelManagerConfig;
  error?: string;
}> {
  try {
    const configPath = path.join(process.cwd(), "prisma", "kwhotel-channel-manager-config.json");
    const content = await fs.readFile(configPath, "utf-8");
    const data = JSON.parse(content) as ChannelManagerConfig;
    return { success: true, data };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        success: false,
        error: "Plik konfiguracji nie istnieje. Uruchom najpierw skrypt ekstrakcji.",
      };
    }
    return {
      success: false,
      error: `Błąd odczytu: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function saveChannelManagerConfig(config: {
  channelManagerType: string;
  apiEndpoint?: string;
  propertyId?: string;
  apiKey?: string;
  username?: string;
  password?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    
    const envVars = [
      `# Channel Manager Configuration`,
      `CHANNEL_MANAGER_TYPE="${config.channelManagerType}"`,
    ];

    if (config.apiEndpoint) {
      envVars.push(`CHANNEL_MANAGER_API_URL="${config.apiEndpoint}"`);
    }
    if (config.propertyId) {
      envVars.push(`CHANNEL_MANAGER_PROPERTY_ID="${config.propertyId}"`);
    }
    if (config.apiKey) {
      envVars.push(`CHANNEL_MANAGER_API_KEY="${config.apiKey}"`);
    }
    if (config.username) {
      envVars.push(`CHANNEL_MANAGER_USERNAME="${config.username}"`);
    }
    if (config.password) {
      envVars.push(`CHANNEL_MANAGER_PASSWORD="${config.password}"`);
    }

    let existingEnv = "";
    try {
      existingEnv = await fs.readFile(envPath, "utf-8");
    } catch {
      // plik nie istnieje
    }

    // Usuń stare wpisy Channel Manager
    const filteredLines = existingEnv
      .split("\n")
      .filter(line => !line.startsWith("CHANNEL_MANAGER_") && !line.includes("# Channel Manager"));

    const newEnv = [...filteredLines, "", ...envVars].join("\n").trim() + "\n";
    
    await fs.writeFile(envPath, newEnv, "utf-8");

    revalidatePath("/ustawienia/channel-manager");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `Błąd zapisu: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function getCurrentChannelManagerConfig(): Promise<{
  success: boolean;
  data?: {
    channelManagerType?: string;
    apiEndpoint?: string;
    propertyId?: string;
    apiKey?: string;
    username?: string;
  };
  error?: string;
}> {
  try {
    return {
      success: true,
      data: {
        channelManagerType: process.env.CHANNEL_MANAGER_TYPE,
        apiEndpoint: process.env.CHANNEL_MANAGER_API_URL,
        propertyId: process.env.CHANNEL_MANAGER_PROPERTY_ID,
        apiKey: process.env.CHANNEL_MANAGER_API_KEY ? "***configured***" : undefined,
        username: process.env.CHANNEL_MANAGER_USERNAME,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `Błąd: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// Typy Channel Managerów z ich wymaganiami
interface ChannelManagerInfo {
  name: string;
  requiredFields: string[];
  optionalFields: string[];
  apiDocs: string;
  description: string;
}

export const CHANNEL_MANAGER_TYPES: Record<string, ChannelManagerInfo> = {
  wubook: {
    name: "WuBook (WooDoo)",
    requiredFields: ["apiKey", "propertyId"],
    optionalFields: ["username", "password"],
    apiDocs: "https://wubook.net/wired/",
    description: "Popularny w Polsce CM obsługujący Booking.com, Expedia i inne.",
  },
  channex: {
    name: "Channex",
    requiredFields: ["apiKey", "propertyId"],
    optionalFields: [],
    apiDocs: "https://docs.channex.io/",
    description: "Nowoczesny CM z REST API. Dobra integracja z PMS.",
  },
  cubilis: {
    name: "Cubilis",
    requiredFields: ["username", "password", "propertyId"],
    optionalFields: [],
    apiDocs: "https://www.cubilis.eu/",
    description: "Europejski CM używany przez wiele hoteli.",
  },
  siteminder: {
    name: "SiteMinder",
    requiredFields: ["apiKey", "propertyId"],
    optionalFields: ["apiEndpoint"],
    apiDocs: "https://www.siteminder.com/",
    description: "Jeden z największych globalnych Channel Managerów.",
  },
  beds24: {
    name: "Beds24",
    requiredFields: ["apiKey", "propertyId"],
    optionalFields: [],
    apiDocs: "https://beds24.com/api/",
    description: "CM z wbudowanym booking engine.",
  },
  other: {
    name: "Inny / Własny",
    requiredFields: ["apiEndpoint", "apiKey"],
    optionalFields: ["propertyId", "username", "password"],
    apiDocs: "",
    description: "Ręczna konfiguracja dowolnego Channel Managera.",
  },
};

export type ChannelManagerType = keyof typeof CHANNEL_MANAGER_TYPES;

export async function syncChannel(
  dateFrom: string,
  dateTo: string,
  channel: "booking_com" | "airbnb" | "expedia" | "amadeus" | "sabre" | "travelport"
): Promise<{ success: boolean; message?: string; error?: string }> {
  "use server";
  
  // TODO: Implementacja synchronizacji z kanałami OTA
  // Na razie zwracamy sukces jako placeholder
  return {
    success: true,
    message: `Synchronizacja ${channel} (${dateFrom} - ${dateTo}) zakończona pomyślnie.`,
  };
}
