import "dotenv/config";
import { prisma } from "../lib/db";

/**
 * Nadaje roli MANAGER pełne uprawnienia admin (admin.users + admin.settings)
 * oraz wszystkie pozostałe uprawnienia z PERMISSION_CODES.
 */
async function main() {
  const ALL_PERMISSIONS = [
    "reservation.create",
    "reservation.edit",
    "reservation.cancel",
    "reservation.check_in",
    "reservation.check_out",
    "finance.view",
    "finance.post",
    "finance.void",
    "finance.refund",
    "rates.view",
    "rates.edit",
    "reports.view",
    "reports.export",
    "reports.management",
    "reports.kpi",
    "reports.meals",
    "reports.official",
    "housekeeping.view",
    "housekeeping.update_status",
    "admin.users",
    "admin.settings",
    "owner.portal",
    "module.dashboard",
    "module.front_office",
    "module.check_in",
    "module.guests",
    "module.companies",
    "module.travel_agents",
    "module.rooms",
    "module.rates",
    "module.housekeeping",
    "module.finance",
    "module.reports",
    "module.channel_manager",
    "module.parking",
    "module.mice",
  ];

  const role = "MANAGER";

  for (const code of ALL_PERMISSIONS) {
    // Upsert permission
    const perm = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: code,
      },
    });

    // Upsert role-permission link
    await prisma.rolePermission.upsert({
      where: {
        role_permissionId: {
          role,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        role,
        permissionId: perm.id,
      },
    });

    console.log(`✓ ${role} -> ${code}`);
  }

  console.log(`\nGotowe! Rola ${role} ma teraz ${ALL_PERMISSIONS.length} uprawnień.`);
  console.log("Wyloguj się i zaloguj ponownie, aby odświeżyć sesję.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
