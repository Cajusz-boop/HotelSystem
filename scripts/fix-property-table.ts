/**
 * Tworzy tabelę Property + domyślny obiekt (bez resetu bazy).
 * Obsługuje uszkodzony tablespace (błąd 1813).
 * Uruchom: npx tsx scripts/fix-property-table.ts
 */
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { prisma } from "../lib/db";

async function main() {

  const createTable = `
    CREATE TABLE \`PropertyNew\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`code\` VARCHAR(191) NOT NULL,
      \`reservationStatusColors\` JSON NULL,
      \`paymentStatusColors\` JSON NULL,
      \`statusCombinationColors\` JSON NULL,
      \`reservationStatusLabels\` JSON NULL,
      \`reservationStatusDescriptions\` JSON NULL,
      \`overbookingLimitPercent\` INTEGER NOT NULL DEFAULT 0,
      \`localTaxPerPersonPerNight\` DECIMAL(10, 2) NULL,
      \`mealPrices\` JSON NULL,
      \`ownerId\` VARCHAR(191) NULL,
      \`dunningConfig\` JSON NULL,
      \`housekeepingFloorAssignments\` JSON NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`PropertyNew_code_key\`(\`code\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `;

  const insertDefault = `
    INSERT IGNORE INTO \`PropertyNew\` (\`id\`, \`name\`, \`code\`, \`createdAt\`, \`updatedAt\`)
    VALUES ('prop_default_main', 'Obiekt główny', 'default', NOW(3), NOW(3))
  `;

  try {
    // 1. Usuń osierocone pliki .ibd (błąd 1813)
    const rows = (await prisma.$queryRawUnsafe(
      "SELECT @@datadir as datadir"
    )) as { datadir: string }[];
    const datadir = (rows[0]?.datadir ?? "").trim().replace(/\//g, path.sep);
    const dbDir = path.join(datadir, "hotelsystem");
    for (const name of ["property", "Property", "propertynew", "PropertyNew"]) {
      const p = path.join(dbDir, name + ".ibd");
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        console.log("Usunięto:", p);
      }
    }

    // 2. Usuń tabele
    await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS `Property`");
    await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS `PropertyNew`");
    console.log("Stare tabele usunięte.");

    // 3. Utwórz tymczasową tabelę
    await prisma.$executeRawUnsafe(createTable);
    console.log("Tabela PropertyNew utworzona.");

    await prisma.$executeRawUnsafe(insertDefault);
    console.log("Domyślny obiekt wstawiony.");

    // RENAME - jeśli nie zadziała, Property jest "ghost" i potrzebny jest restart MySQL
    try {
      await prisma.$executeRawUnsafe("RENAME TABLE `PropertyNew` TO `Property`");
      console.log("Zmieniono nazwę na Property.");
    } catch (e: unknown) {
      const code = (e as { meta?: { driverAdapterError?: { cause?: { code?: number } } } })?.meta?.driverAdapterError?.cause?.code;
      if (code === 1050) {
        console.error("\n*** Tabela Property jest w stanie 'ghost'. Zrestartuj serwer MySQL (XAMPP), potem uruchom skrypt ponownie. ***");
        process.exit(1);
      }
      throw e;
    }
  } catch (e) {
    console.error("Błąd:", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
