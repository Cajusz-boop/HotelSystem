#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const all = await prisma.invoice.findMany({ select: { number: true } });
const parseSeq = (s) => {
  const p = s.split("/");
  const last = parseInt(p[p.length - 1], 10);
  return isNaN(last) ? 0 : last;
};
const bySeq = {};
all.forEach((i) => {
  const s = parseSeq(i.number);
  if ([9, 16, 18, 37].includes(s)) bySeq[s] = i.number;
});
console.log("Seq 9:", bySeq[9] || "BRAK");
console.log("Seq 16:", bySeq[16] || "BRAK");
console.log("Seq 18:", bySeq[18] || "BRAK");
console.log("Seq 37:", bySeq[37] || "BRAK");
await prisma.$disconnect();
