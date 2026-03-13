/**
 * Importuje legendę rezerwacji (kolory, etykiety) z pliku JSON do lokalnej bazy.
 * Uruchamiane przez sync-legend-from-production.ps1
 */
import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { prisma } from "../lib/db";

interface LegendData {
  reservationStatusColors?: Record<string, string> | null;
  statusCombinationColors?: Record<string, string> | null;
  reservationStatusLabels?: Record<string, string> | null;
  reservationStatusDescriptions?: Record<string, string> | null;
  paymentStatusColors?: Record<string, string> | null;
}

async function main() {
  const filePath = process.argv[2] ?? join(__dirname, ".legend-from-prod.json");
  if (!existsSync(filePath)) {
    console.error("[Błąd] Brak pliku:", filePath);
    process.exit(1);
  }

  const raw = readFileSync(filePath, "utf-8").trim();
  let data: LegendData;
  try {
    data = JSON.parse(raw) as LegendData;
  } catch (e) {
    console.error("[Błąd] Nieprawidłowy JSON:", (e as Error).message);
    process.exit(1);
  }

  const property = await prisma.property.findFirst({ orderBy: { code: "asc" } });
  if (!property) {
    console.error("[Błąd] Brak Property w lokalnej bazie.");
    process.exit(1);
  }

  const update: Record<string, unknown> = {};
  if (data.reservationStatusColors != null) update.reservationStatusColors = data.reservationStatusColors;
  if (data.statusCombinationColors != null) update.statusCombinationColors = data.statusCombinationColors;
  if (data.reservationStatusLabels != null) update.reservationStatusLabels = data.reservationStatusLabels;
  if (data.reservationStatusDescriptions != null)
    update.reservationStatusDescriptions = data.reservationStatusDescriptions;
  if (data.paymentStatusColors != null) update.paymentStatusColors = data.paymentStatusColors;

  if (Object.keys(update).length === 0) {
    console.log("Produkcja nie ma skonfigurowanych kolorów/etykiet (wszystkie null). Nic nie importowano.");
    return;
  }

  await prisma.property.update({
    where: { id: property.id },
    data: update,
  });

  console.log(
    "Zaktualizowano Property:",
    Object.keys(update).join(", ")
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
