import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

function normalizeUrl(u) {
  u = (u || '').trim().replace(/:\s+@/, ':@');
  u = u.replace(/^(\w+:\/\/[^:]+):@/, '$1@');
  return u;
}
const url = normalizeUrl(process.env.DATABASE_URL);
const adapter = new PrismaMariaDb(url);
const prisma = new PrismaClient({ adapter });

const id = process.argv[2] || 'cmmhlfh700003j8vzh4a3lav5';
const row = await prisma.eventOrder.findUnique({
  where: { id },
  select: { id: true, googleCalendarEventId: true, googleCalendarError: true, googleCalendarSynced: true },
});
console.log(JSON.stringify(row, null, 2));
await prisma.$disconnect();
