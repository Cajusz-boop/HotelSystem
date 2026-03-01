import "dotenv/config";
import "@/lib/env"; // Walidacja env vars przy starcie
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  keepAliveTimer: ReturnType<typeof setInterval> | undefined;
};

/**
 * Normalizuje URL bazy pod driver MariaDB:
 * - usuwa spację między : a @ (root: @ → root:@)
 * - przy pustym haśle zamienia user:@ na user@, bo regex MariaDB nie akceptuje pustego hasła w URL
 */
function normalizeDatabaseUrl(url: string): string {
  let u = url.trim().replace(/:\s+@/, ":@");
  // Driver mariadb w connection-options.js nie dopuszcza pustego hasła (grupa (:([^/]+))? wymaga znaków). Format user:@ → user@
  u = u.replace(/^(\w+:\/\/[^:]+):@/, "$1@");
  return u;
}

function createPrisma(): PrismaClient {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "Brak DATABASE_URL w .env. Dla lokalnej bazy ustaw np.: DATABASE_URL=\"mysql://USER:HASLO@localhost:3306/hotel_pms\""
    );
  }
  const url = normalizeDatabaseUrl(raw);
  const adapter = new PrismaMariaDb(url);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

// Singleton w KAŻDYM środowisku (dev + production) – zapobiega tworzeniu nowych klientów i połączeń przy każdym renderze
globalForPrisma.prisma = prisma;

/**
 * Keep-alive: co 4 minuty lekkie zapytanie `SELECT 1`, żeby MariaDB nie zamykała
 * połączenia po wait_timeout. Timer jest jeden na proces (globalThis).
 */
if (!globalForPrisma.keepAliveTimer) {
  const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000; // 4 minuty
  globalForPrisma.keepAliveTimer = setInterval(async () => {
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
    } catch {
      // Ignoruj – następne zapytanie biznesowe odtworzy połączenie
    }
  }, KEEP_ALIVE_INTERVAL_MS);

  // Nie blokuj zamknięcia procesu Node
  if (globalForPrisma.keepAliveTimer?.unref) {
    globalForPrisma.keepAliveTimer.unref();
  }
}
