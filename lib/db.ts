import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("mysql://")) {
    // Build-time / brak .env – dummy adapter (pierwsze zapytanie rzuci przy połączeniu)
    const adapter = new PrismaMariaDb({
      host: "localhost",
      port: 3306,
      user: "build",
      password: "build",
      database: "build",
      connectionLimit: 1,
    });
    return new PrismaClient({ adapter });
  }
  const u = new URL(url);
  const adapter = new PrismaMariaDb({
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1).split("?")[0] || undefined,
    connectionLimit: 5,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
