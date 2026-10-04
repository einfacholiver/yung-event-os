import Link from "next/link";
import { getFinanceOverview } from "@/modules/finances/server/queries";
import { ApiForm } from "@/modules/workspace/components/api-form";

export const dynamic = "force-dynamic";
export default async function FinancesPage() {
  let data: Awaited<ReturnType<typeof getFinanceOverview>> | null = null;
  try {
    data = await getFinanceOverview();
  } catch {
    data = null;
  }
  if (!data)
    return (
      <main className="p-10">
        <h1 className="text-2xl font-semibold">Finanzen</h1>
        <p className="mt-3">Bitte Google Drive verbinden oder anmelden.</p>
      </main>
    );
  return (
    <main className="min-h-screen">
      <header className="bg-card border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-black">
            YUNG EVENT OS
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/events">Events</Link>
            <Link href="/documents">Documents</Link>
            <Link href="/settings">Settings</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
            Controlling
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Finanzen</h1>
          <p className="text-muted-foreground mt-3">
            Manuelle Transaktionen und Event-Auswertungen.
          </p>
        </div>
        <section className="grid gap-4 md:grid-cols-2">
          {data.totals.map(({ event, income, expense }) => (
            <article key={event.id} className="bg-card rounded-xl border p-5">
              <h2 className="font-semibold">{event.name}</h2>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Einnahmen</dt>
                  <dd className="font-semibold text-emerald-700">
                    {income.toFixed(2)} €
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ausgaben</dt>
                  <dd className="font-semibold text-red-700">
                    {expense.toFixed(2)} €
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Gewinn</dt>
                  <dd className="font-semibold">
                    {(income - expense).toFixed(2)} €
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
        <section className="bg-card rounded-xl border p-6">
          <h2 className="text-xl font-semibold">Transaktion hinzufügen</h2>
          <ApiForm
            endpoint="/api/finances/transactions"
            className="mt-4 grid gap-3 md:grid-cols-5"
          >
            <select
              name="eventId"
              required
              className="border-input rounded-md border px-3 py-2"
            >
              <option value="">Event</option>
              {data.events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            <select
              name="direction"
              required
              className="border-input rounded-md border px-3 py-2"
            >
              <option value="EXPENSE">Ausgabe</option>
              <option value="INCOME">Einnahme</option>
            </select>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Betrag"
              required
              className="border-input rounded-md border px-3 py-2"
            />
            <input
              name="bookedAt"
              type="date"
              required
              className="border-input rounded-md border px-3 py-2"
            />
            <input
              name="description"
              placeholder="Beschreibung"
              className="border-input rounded-md border px-3 py-2"
            />
            <button
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 md:col-span-5 md:justify-self-start"
              type="submit"
            >
              Transaktion speichern
            </button>
          </ApiForm>
        </section>
        <section className="bg-card rounded-xl border p-6">
          <h2 className="text-xl font-semibold">Erfasste Transaktionen</h2>
          <ul className="mt-4 divide-y">
            {data.transactions.map((transaction) => (
              <li key={transaction.id} className="py-3 text-sm">
                {transaction.bookedAt.toLocaleDateString("de-DE", {
                  timeZone: "Europe/Berlin",
                })}{" "}
                · {transaction.event?.name ?? "Ohne Event"} ·{" "}
                {transaction.direction === "INCOME" ? "Einnahme" : "Ausgabe"} ·{" "}
                {transaction.amount.toString()} {transaction.currency}
                <p className="text-muted-foreground">
                  {transaction.description}
                </p>
              </li>
            ))}
          </ul>
          {!data.transactions.length && (
            <p className="mt-3 text-sm">Noch keine Transaktionen.</p>
          )}
        </section>
      </div>
    </main>
  );
}
