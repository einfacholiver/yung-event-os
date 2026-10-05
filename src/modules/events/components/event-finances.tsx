import Link from "next/link";
import { getDb } from "@/server/db/client";
import { cents, euro, financeTotals } from "@/modules/events/finance";
import { ApiForm } from "@/modules/workspace/components/api-form";
import { FinanceFields } from "./finance-fields";
export async function EventFinances({
  id,
  organizationId,
  analytics = false,
}: {
  id: string;
  organizationId: string;
  analytics?: boolean;
}) {
  const transactions = await getDb().transaction.findMany({
    where: { eventId: id, organizationId },
    orderBy: [{ bookedAt: "desc" }, { id: "asc" }],
  });
  const rows = transactions.map((row) => ({
    ...row,
    amount: row.amount.toString(),
    bookedAt: row.bookedAt.toISOString().slice(0, 10),
  }));
  const totals = financeTotals(rows);
  const unpaid = rows
    .filter(
      (row) =>
        row.direction === "EXPENSE" && row.currency === "EUR" && !row.isPaid,
    )
    .reduce((total, row) => total + cents(row.amount), 0n);
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">
        {analytics ? "Analytics" : "Finanzen"}
      </h2>
      <p className="text-sm text-stone-600">
        Aus deinen erfassten EUR-Buchungen. Drive-Rechnungen und
        Kostenübersichten werden nicht automatisch als Buchungen übernommen.
      </p>
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Einnahmen", euro(totals.income)],
          ["Ausgaben", euro(totals.expenses)],
          ["Gewinn", euro(totals.profit)],
          ["Marge", totals.margin],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-5">
            <h3 className="text-sm text-stone-600">{label}</h3>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-sm">
        Ausgaben bezahlt: <strong>{euro(totals.expenses - unpaid)}</strong> ·
        Offen / noch nicht bestätigt: <strong>{euro(unpaid)}</strong>. Beide
        sind in den Gesamtkosten enthalten. Private Auslagen sind keine
        zusätzlichen Kosten bei späterer Erstattung.
      </p>
      {rows.some((row) => row.currency !== "EUR") && (
        <p>
          Andere Währungen werden separat angezeigt und nicht in die EUR-Summen
          eingerechnet.
        </p>
      )}
      {analytics ? (
        <div className="space-y-4 rounded-xl border p-6">
          <h3 className="font-semibold">Einnahmen und Ausgaben</h3>
          {[
            { label: "Einnahmen", value: totals.income },
            { label: "Ausgaben", value: totals.expenses },
          ].map(({ label, value }) => (
            <div key={label}>
              <p>
                {label}: {euro(value)}
              </p>
              <div className="mt-2 h-5 rounded bg-stone-100">
                <div
                  className="h-5 rounded bg-stone-800"
                  style={{
                    width: `${(Number(value) / Math.max(Number(totals.income), Number(totals.expenses), 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
          <p className="text-sm">
            Besucherzahlen sind noch nicht erfasst. Bestellungen mit Tischen
            oder Lounges erlauben keinen verlässlichen durchschnittlichen
            Ticketpreis.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-white p-5">
            <h3 className="mb-4 font-semibold">Neue Buchung</h3>
            <ApiForm
              endpoint="/api/finances/transactions"
              className="grid gap-3 md:grid-cols-4"
            >
              <input type="hidden" name="eventId" value={id} />
              <FinanceFields />
            </ApiForm>
          </div>
          <div className="overflow-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-100">
                <tr>
                  {[
                    "Datum",
                    "Beschreibung",
                    "Einnahmen",
                    "Ausgaben",
                    "Bezahlt",
                    "Bezahlt von",
                    "Bearbeiten",
                  ].map((label) => (
                    <th className="p-3" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3">{row.bookedAt}</td>
                    <td className="p-3">{row.description || "—"}</td>
                    <td className="p-3">
                      {row.direction === "INCOME"
                        ? `${row.amount} ${row.currency}`
                        : "—"}
                    </td>
                    <td className="p-3">
                      {row.direction === "EXPENSE"
                        ? `${row.amount} ${row.currency}`
                        : "—"}
                    </td>
                    <td className="p-3">
                      {row.isPaid ? "✓ Ja" : "Offen / unbestätigt"}
                    </td>
                    <td className="p-3">
                      {row.isPaid ? (row.paidBy ?? "Nicht angegeben") : "—"}
                    </td>
                    <td className="p-3">
                      {row.currency === "EUR" && (
                        <details>
                          <summary className="cursor-pointer">
                            Bearbeiten
                          </summary>
                          <ApiForm
                            method="PATCH"
                            reset={false}
                            endpoint={`/api/finances/transactions/${row.id}`}
                            className="min-w-64 space-y-3 p-3"
                          >
                            <FinanceFields row={row} />
                          </ApiForm>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <p className="p-6">
                Noch keine Buchungen. Trage oben die erste Einnahme oder Ausgabe
                ein.
              </p>
            )}
          </div>
          <Link className="underline" href={`/events/${id}/documents`}>
            Vorhandene Rechnungen und Kostenübersichten öffnen
          </Link>
        </>
      )}
    </section>
  );
}
