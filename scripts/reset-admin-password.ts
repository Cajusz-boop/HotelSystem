/**
 * Reset hasła administratora (admin@hotel.local) na Admin1234#.
 * Uruchom gdy zapomnisz hasła: npx tsx scripts/reset-admin-password.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";

const ADMIN_EMAIL = "admin@hotel.local";
const NEW_PASSWORD = "Admin1234#";

async function main() {
  const user = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!user) {
    console.error("Nie znaleziono użytkownika:", ADMIN_EMAIL);
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);
  await prisma.user.update({
    where: { email: ADMIN_EMAIL },
    data: { passwordHash, passwordChangedAt: new Date() },
  });
  console.log("Hasło dla", ADMIN_EMAIL, "zostało zresetowane na:", NEW_PASSWORD);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
