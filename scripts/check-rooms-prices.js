require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

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
const p = new PrismaClient({ adapter });

async function main() {
  const rooms = await p.room.findMany({
    where: { number: { in: ['005', '006', 'SI 020', 'SI 021'] } },
    select: { number: true, type: true, price: true },
  });
  console.log('=== Rooms (005, 006, SI 020, SI 021) ===');
  console.log(JSON.stringify(rooms, null, 2));

  const roomTypes = await p.roomType.findMany({
    select: { name: true, basePrice: true, rateCodeId: true },
  });
  console.log('\n=== Wszystkie RoomType (typ, basePrice, rateCodeId) ===');
  console.log(JSON.stringify(roomTypes, null, 2));

  const rateCodes = await p.rateCode.findMany({
    select: { id: true, code: true, price: true, basePrice: true, pricePerPerson: true },
  });
  console.log('\n=== Wszystkie RateCode ===');
  console.log(JSON.stringify(rateCodes, null, 2));

  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
