const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const rooms = await p.room.findMany({
    where: { number: { in: ['005', '006', '020', 'SI 020'] } },
    select: { number: true, type: true, price: true },
  });
  console.log('Rooms:', JSON.stringify(rooms, null, 2));

  const roomTypes = await p.roomType.findMany({
    select: { name: true, basePrice: true, rateCodeId: true },
    take: 10,
  });
  console.log('RoomTypes (sample):', JSON.stringify(roomTypes, null, 2));

  const rateCodes = await p.rateCode.findMany({
    select: { id: true, code: true, price: true, basePrice: true, pricePerPerson: true },
    take: 10,
  });
  console.log('RateCodes (sample):', JSON.stringify(rateCodes, null, 2));

  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
