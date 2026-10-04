import Link from "next/link";
import { getDb } from "@/server/db/client";
import { requireDriveUser } from "@/modules/drive/server/context";
export const dynamic = "force-dynamic";
export default async function AnalyticsPage() {
  let rows: Awaited<ReturnType<typeof load>> = [];
  try {
    rows = await load();
  } catch {
    return (
      <main className="p-10">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="mt-3">Bitte anmelden und Daten erfassen.</p>
      </main>
    );
  }
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <nav className="flex gap-4 text-sm">
          <Link href="/events">Events</Link>
          <Link href="/finances">Finanzen</Link>
          <Link href="/documents">Documents</Link>
        </nav>
        <h1 className="text-4xl font-semibold">Analytics</h1>
        <p className="text-muted-foreground">
          Vergleich aus gepflegten Transaktionen. Besucher- und Ticketdaten
          folgen mit dem Ticketmodul.
        </p>
        <section className="bg-card rounded-xl border">
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.event.id} className="grid gap-3 p-5 md:grid-cols-4">
                <strong>{row.event.name}</strong>
                <span>Umsatz: {row.income.toFixed(2)} €</span>
                <span>Kosten: {row.expense.toFixed(2)} €</span>
                <span>Gewinn: {(row.income - row.expense).toFixed(2)} €</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
async function load() {
  const { organizationId } = await requireDriveUser();
  const events = await getDb().event.findMany({
    where: { organizationId },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const tx = await getDb().transaction.findMany({
    where: { organizationId },
    select: { eventId: true, direction: true, amount: true },
  });
  return events.map((event) => ({
    event,
    income: tx
      .filter((t) => t.eventId === event.id && t.direction === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0),
    expense: tx
      .filter((t) => t.eventId === event.id && t.direction === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0),
  }));
}
