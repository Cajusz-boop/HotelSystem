import "dotenv/config";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";

const SNAPSHOT_PATH = join(__dirname, "config-snapshot.json");

type Snapshot = Record<string, unknown>;

function stripAutoFields(obj: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...obj };
  delete copy.id;
  delete copy.createdAt;
  delete copy.updatedAt;
  return copy;
}

async function upsertMany<T extends Record<string, unknown>>(
  label: string,
  rows: T[] | undefined,
  uniqueField: string,
  model: { upsert: (args: unknown) => Promise<unknown> },
) {
  if (!rows?.length) return;
  let count = 0;
  for (const row of rows) {
    const uniqueValue = row[uniqueField];
    const data = stripAutoFields(row);
    await model.upsert({
      where: { [uniqueField]: uniqueValue },
      update: data,
      create: row,
    });
    count++;
  }
  console.log(`  ${label}: ${count} rekordów`);
}

async function main() {
  if (!existsSync(SNAPSHOT_PATH)) {
    console.log("Brak pliku config-snapshot.json — pomijam import konfiguracji.");
    console.log("Aby wygenerować snapshot: npm run db:config:export");
    return;
  }

  console.log("Import konfiguracji z config-snapshot.json...");
  const snapshot: Snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8"));
  console.log(`Snapshot z: ${snapshot._exportedAt ?? "nieznana data"}`);

  // HotelConfig
  if (snapshot.hotelConfig) {
    const hc = snapshot.hotelConfig as Record<string, unknown>;
    await prisma.hotelConfig.upsert({
      where: { id: "default" },
      update: stripAutoFields(hc),
      create: hc as unknown as Prisma.HotelConfigCreateInput,
    });
    console.log("  HotelConfig: OK");
  }

  // CennikConfig
  if (snapshot.cennikConfig) {
    const cc = snapshot.cennikConfig as Record<string, unknown>;
    await prisma.cennikConfig.upsert({
      where: { id: "default" },
      update: stripAutoFields(cc),
      create: cc as unknown as Prisma.CennikConfigCreateInput,
    });
    console.log("  CennikConfig: OK");
  }

  // Property (default)
  if (snapshot.property) {
    const p = snapshot.property as Record<string, unknown>;
    await prisma.property.upsert({
      where: { code: "default" },
      update: p,
      create: { ...p, code: "default" } as unknown as Prisma.PropertyCreateInput,
    });
    console.log("  Property: OK");
  }

  // DocumentNumberingConfig
  await upsertMany(
    "DocumentNumberingConfig",
    snapshot.documentNumbering as Record<string, unknown>[] | undefined,
    "documentType",
    prisma.documentNumberingConfig as unknown as { upsert: (args: unknown) => Promise<unknown> },
  );

  // InvoiceTemplate
  await upsertMany(
    "InvoiceTemplate",
    snapshot.invoiceTemplates as Record<string, unknown>[] | undefined,
    "templateType",
    prisma.invoiceTemplate as unknown as { upsert: (args: unknown) => Promise<unknown> },
  );

  // DocumentTemplate
  await upsertMany(
    "DocumentTemplate",
    snapshot.documentTemplates as Record<string, unknown>[] | undefined,
    "templateType",
    prisma.documentTemplate as unknown as { upsert: (args: unknown) => Promise<unknown> },
  );

  // FiscalReceiptTemplate
  if ((snapshot.fiscalReceiptTemplate as unknown[])?.length) {
    for (const row of snapshot.fiscalReceiptTemplate as Record<string, unknown>[]) {
      await prisma.fiscalReceiptTemplate.upsert({
        where: { id: (row.id as string) ?? "default" },
        update: stripAutoFields(row),
        create: row as unknown as Prisma.FiscalReceiptTemplateCreateInput,
      });
    }
    console.log(`  FiscalReceiptTemplate: ${(snapshot.fiscalReceiptTemplate as unknown[]).length} rekordów`);
  }

  // EmailTemplate
  await upsertMany(
    "EmailTemplate",
    snapshot.emailTemplates as Record<string, unknown>[] | undefined,
    "type",
    prisma.emailTemplate as unknown as { upsert: (args: unknown) => Promise<unknown> },
  );

  // RoomType
  await upsertMany(
    "RoomType",
    snapshot.roomTypes as Record<string, unknown>[] | undefined,
    "name",
    prisma.roomType as unknown as { upsert: (args: unknown) => Promise<unknown> },
  );

  // RateCode
  await upsertMany(
    "RateCode",
    snapshot.rateCode as Record<string, unknown>[] | undefined,
    "code",
    prisma.rateCode as unknown as { upsert: (args: unknown) => Promise<unknown> },
  );

  // SurchargeType
  if ((snapshot.surchargeTypes as unknown[])?.length) {
    for (const row of snapshot.surchargeTypes as Record<string, unknown>[]) {
      const data = stripAutoFields(row);
      delete data.propertyId;
      const prop = await prisma.property.findFirst({ where: { code: "default" } });
      if (prop) {
        await prisma.surchargeType.upsert({
          where: { code: row.code as string },
          update: data,
          create: { ...data, code: row.code as string, propertyId: prop.id } as unknown as Prisma.SurchargeTypeCreateInput,
        });
      }
    }
    console.log(`  SurchargeType: ${(snapshot.surchargeTypes as unknown[]).length} rekordów`);
  }

  // Package
  if ((snapshot.packages as unknown[])?.length) {
    for (const row of snapshot.packages as Record<string, unknown>[]) {
      const data = stripAutoFields(row);
      delete data.propertyId;
      const prop = await prisma.property.findFirst({ where: { code: "default" } });
      if (prop) {
        await prisma.package.upsert({
          where: { code: row.code as string },
          update: data,
          create: { ...data, code: row.code as string, propertyId: prop.id } as unknown as Prisma.PackageCreateInput,
        });
      }
    }
    console.log(`  Package: ${(snapshot.packages as unknown[]).length} rekordów`);
  }

  // DerivedRateRule
  if ((snapshot.derivedRateRules as unknown[])?.length) {
    for (const row of snapshot.derivedRateRules as Record<string, unknown>[]) {
      await prisma.derivedRateRule.upsert({
        where: { id: row.id as string },
        update: stripAutoFields(row),
        create: row as unknown as Prisma.DerivedRateRuleCreateInput,
      });
    }
    console.log(`  DerivedRateRule: ${(snapshot.derivedRateRules as unknown[]).length} rekordów`);
  }

  // MinibarItem
  if ((snapshot.minibarItems as unknown[])?.length) {
    for (const row of snapshot.minibarItems as Record<string, unknown>[]) {
      await prisma.minibarItem.upsert({
        where: { id: row.id as string },
        update: stripAutoFields(row),
        create: row as unknown as Prisma.MinibarItemCreateInput,
      });
    }
    console.log(`  MinibarItem: ${(snapshot.minibarItems as unknown[]).length} rekordów`);
  }

  // Permission
  await upsertMany(
    "Permission",
    snapshot.permissions as Record<string, unknown>[] | undefined,
    "code",
    prisma.permission as unknown as { upsert: (args: unknown) => Promise<unknown> },
  );

  // RolePermission
  if ((snapshot.rolePermissions as unknown[])?.length) {
    for (const row of snapshot.rolePermissions as Record<string, unknown>[]) {
      await prisma.rolePermission.upsert({
        where: { id: row.id as string },
        update: stripAutoFields(row),
        create: row as unknown as Prisma.RolePermissionCreateInput,
      });
    }
    console.log(`  RolePermission: ${(snapshot.rolePermissions as unknown[]).length} rekordów`);
  }

  // RoleGroup
  await upsertMany(
    "RoleGroup",
    snapshot.roleGroups as Record<string, unknown>[] | undefined,
    "code",
    prisma.roleGroup as unknown as { upsert: (args: unknown) => Promise<unknown> },
  );

  // RoleGroupPermission
  if ((snapshot.roleGroupPermissions as unknown[])?.length) {
    for (const row of snapshot.roleGroupPermissions as Record<string, unknown>[]) {
      await prisma.roleGroupPermission.upsert({
        where: { id: row.id as string },
        update: stripAutoFields(row),
        create: row as unknown as Prisma.RoleGroupPermissionCreateInput,
      });
    }
    console.log(`  RoleGroupPermission: ${(snapshot.roleGroupPermissions as unknown[]).length} rekordów`);
  }

  // LoyaltyProgram
  if (snapshot.loyaltyProgram) {
    const lp = snapshot.loyaltyProgram as Record<string, unknown>;
    await prisma.loyaltyProgram.upsert({
      where: { id: "default" },
      update: stripAutoFields(lp),
      create: lp as unknown as Prisma.LoyaltyProgramCreateInput,
    });
    console.log("  LoyaltyProgram: OK");
  }

  // LoyaltyTier
  await upsertMany(
    "LoyaltyTier",
    snapshot.loyaltyTiers as Record<string, unknown>[] | undefined,
    "code",
    prisma.loyaltyTier as unknown as { upsert: (args: unknown) => Promise<unknown> },
  );

  // VoucherTemplate
  if ((snapshot.voucherTemplates as unknown[])?.length) {
    for (const row of snapshot.voucherTemplates as Record<string, unknown>[]) {
      await prisma.voucherTemplate.upsert({
        where: { id: row.id as string },
        update: stripAutoFields(row),
        create: row as unknown as Prisma.VoucherTemplateCreateInput,
      });
    }
    console.log(`  VoucherTemplate: ${(snapshot.voucherTemplates as unknown[]).length} rekordów`);
  }

  console.log("Import konfiguracji zakończony.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
