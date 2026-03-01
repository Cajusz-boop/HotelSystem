import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL jest wymagany"),
  SESSION_SECRET: z
    .string()
    .min(16, "SESSION_SECRET musi mieć min 16 znaków")
    .optional()
    .transform((val) => val || "dev-secret-change-in-production"),
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().default(30),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Błąd konfiguracji środowiska:");
    parsed.error.issues.forEach((issue) => {
      console.error(`   ${issue.path.join(".")}: ${issue.message}`);
    });

    if (process.env.NODE_ENV === "production") {
      throw new Error("Nieprawidłowa konfiguracja środowiska");
    }
  }

  return parsed.success ? parsed.data : undefined;
}

export const env = validateEnv();
