import "dotenv/config";
import { writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../lib/db";

const SNAPSHOT_PATH = join(__dirname, "config-snapshot.json");

async function main() {
  console.log("Eksport konfiguracji z bazy...");

  const hotelConfig = await prisma.hotelConfig.findUnique({ where: { id: "default" } });
  const cennikConfig = await prisma.cennikConfig.findUnique({ where: { id: "default" } });
  const property = await prisma.property.findFirst({ where: { code: "default" } });
  const documentNumbering = await prisma.documentNumberingConfig.findMany();
  const invoiceTemplates = await prisma.invoiceTemplate.findMany();
  const documentTemplates = await prisma.documentTemplate.findMany();
  const fiscalReceiptTemplate = await prisma.fiscalReceiptTemplate.findMany();
  const emailTemplates = await prisma.emailTemplate.findMany();
  const roomTypes = await prisma.roomType.findMany();
  const rateCode = await prisma.rateCode.findMany();
  const surchargeTypes = await prisma.surchargeType.findMany();
  const packages = await prisma.package.findMany();
  const derivedRateRules = await prisma.derivedRateRule.findMany();
  const minibarItems = await prisma.minibarItem.findMany();
  const permissions = await prisma.permission.findMany();
  const rolePermissions = await prisma.rolePermission.findMany();
  const roleGroups = await prisma.roleGroup.findMany();
  const roleGroupPermissions = await prisma.roleGroupPermission.findMany();
  const loyaltyProgram = await prisma.loyaltyProgram.findUnique({ where: { id: "default" } });
  const loyaltyTiers = await prisma.loyaltyTier.findMany({ orderBy: { sortOrder: "asc" } });
  const voucherTemplates = await prisma.voucherTemplate.findMany();

  const snapshot = {
    _exportedAt: new Date().toISOString(),
    _description: "Snapshot konfiguracji bazy. Generowany przez: npm run db:config:export",
    hotelConfig,
    cennikConfig,
    property: property ? {
      name: property.name,
      code: property.code,
      reservationStatusColors: property.reservationStatusColors,
      overbookingLimitPercent: property.overbookingLimitPercent,
      localTaxPerPersonPerNight: property.localTaxPerPersonPerNight,
      mealPrices: property.mealPrices,
      dunningConfig: property.dunningConfig,
      housekeepingFloorAssignments: property.housekeepingFloorAssignments,
    } : null,
    documentNumbering,
    invoiceTemplates,
    documentTemplates,
    fiscalReceiptTemplate,
    emailTemplates,
    roomTypes,
    rateCode,
    surchargeTypes,
    packages,
    derivedRateRules,
    minibarItems,
    permissions,
    rolePermissions,
    roleGroups,
    roleGroupPermissions,
    loyaltyProgram,
    loyaltyTiers,
    voucherTemplates,
  };

  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf-8");
  console.log(`Zapisano snapshot: ${SNAPSHOT_PATH}`);
  console.log("Tabele wyeksportowane:", Object.keys(snapshot).filter(k => !k.startsWith("_")).length);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
