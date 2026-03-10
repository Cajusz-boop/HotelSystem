/**
 * Synchronizuje paymentStatus rezerwacji na podstawie salda folio.
 * Użyj dla rezerwacji, gdzie wpłata jest zapisana, ale pasek na grafiku nadal jest fioletowy (nieopłacony).
 *
 * Uruchomienie: npx tsx scripts/sync-reservation-payment-status.ts
 * Lub z filtrem: npx tsx scripts/sync-reservation-payment-status.ts Ratajczak
 */
import { prisma } from "../lib/db";

async function getBalance(reservationId: string): Promise<{ balance: number; rawBalance: number; totalPayments: number } | null> {
  const txs = await prisma.transaction.findMany({
    where: { reservationId, status: "ACTIVE" },
    select: { type: true, amount: true },
  });
  let charges = 0;
  let discounts = 0;
  let payments = 0;
  for (const t of txs) {
    const amt = Number(t.amount);
    if (amt > 0) charges += amt;
    else if (t.type === "DISCOUNT") discounts += Math.abs(amt);
    else payments += Math.abs(amt);
  }
  const rawBalance = charges - discounts - payments;
  const balance = Math.round(rawBalance * 100) / 100;
  const totalPayments = Math.round(payments * 100) / 100;
  // Tolerancja 0.01 PLN – błędy zaokrągleń traktuj jak saldo zero
  const effectiveBalance = Math.abs(balance) < 0.01 ? 0 : balance;
  return { balance: effectiveBalance, rawBalance, totalPayments };
}

async function main() {
  const filter = process.argv[2]; // np. "Ratajczak"
  const roomFilter = process.argv[3]; // np. "001"
  const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      ...(filter
        ? { guest: { name: { contains: filter } } }
        : {}),
    },
    select: {
      id: true,
      confirmationNumber: true,
      paymentStatus: true,
      guest: { select: { name: true } },
      room: { select: { number: true } },
    },
    orderBy: { checkIn: "desc" },
    take: filter ? 50 : 100,
  });

  const filtered = roomFilter
    ? reservations.filter((r) => r.room.number === roomFilter || r.room.number === String(Number(roomFilter)))
    : reservations;

  console.log(`Znaleziono ${filtered.length} rezerwacji.`);

  for (const r of filtered) {
    const data = await getBalance(r.id);
    if (!data) continue;
    const { balance, rawBalance, totalPayments } = data;
    const newStatus =
      balance <= 0 ? "PAID" : totalPayments > 0 ? "PARTIAL" : "UNPAID";

    if (verbose || r.paymentStatus !== newStatus) {
      console.log(
        `  ${r.guest.name} pok.${r.room.number}: saldo=${rawBalance.toFixed(4)} effective=${balance} payments=${totalPayments} status=${r.paymentStatus ?? "NULL"} -> ${newStatus}`
      );
    }
    if (r.paymentStatus === newStatus) continue;

    await prisma.reservation.update({
      where: { id: r.id },
      data: { paymentStatus: newStatus },
    });
    console.log(
      `  [FIX] ${r.guest.name} pok.${r.room.number} ${r.paymentStatus ?? "NULL"} -> ${newStatus}`
    );
  }
  console.log("Gotowe.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
