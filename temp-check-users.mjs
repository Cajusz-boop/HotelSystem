import { prisma } from './lib/db.ts';
const users = await prisma.user.findMany({ select: { name: true, email: true, role: true } });
console.log("Użytkownicy w bazie:");
console.log(JSON.stringify(users, null, 2));
process.exit(0);
