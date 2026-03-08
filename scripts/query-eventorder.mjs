import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

function normalizeUrl(u) {
  u = (u || '').trim().replace(/:\s+@/, ':@');
  u = u.replace(/^(\w+:\/\/[^:]+):@/, '$1@');
  return u;
}
const url = normalizeUrl(process.env.DATABASE_URL);
if (!url) {
  console.error('Brak DATABASE_URL w .env');
  process.exit(1);
}
const adapter = new PrismaMariaDb(url);
const prisma = new PrismaClient({ adapter });

const row = await prisma.eventOrder.findFirst({
  where: { id: { startsWith: 'cmmhl5cs' } },
  orderBy: { id: 'desc' },
  select: {
    id: true,
    googleCalendarEventId: true,
    googleCalendarError: true,
    googleCalendarSynced: true,
  },
});

console.log(JSON.stringify(row, null, 2));
await prisma.$disconnect();
