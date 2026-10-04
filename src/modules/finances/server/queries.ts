import "server-only";
import { getDb } from "@/server/db/client";
import { requireDriveUser } from "@/modules/drive/server/context";

export async function getFinanceOverview() {
  const { organizationId } = await requireDriveUser();
  const db = getDb();
  const [events, transactions] = await Promise.all([
    db.event.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    db.transaction.findMany({
      where: { organizationId },
      orderBy: { bookedAt: "desc" },
      select: {
        id: true,
        eventId: true,
        direction: true,
        amount: true,
        currency: true,
        bookedAt: true,
        description: true,
        event: { select: { name: true } },
      },
    }),
  ]);
  const totals = new Map<string, { income: number; expense: number }>();
  for (const event of events) totals.set(event.id, { income: 0, expense: 0 });
  for (const transaction of transactions) {
    if (!transaction.eventId) continue;
    const total = totals.get(transaction.eventId);
    if (!total) continue;
    const amount = Number(transaction.amount);
    if (transaction.direction === "INCOME") total.income += amount;
    else total.expense += amount;
  }
  return {
    events,
    transactions,
    totals: events.map((event) => ({ event, ...totals.get(event.id)! })),
  };
}
