"use client";

import { useState } from "react";
import { cents, euro, financeTotals } from "@/modules/events/finance";
import { paymentSources } from "@/modules/finances/payment";
import { ApiForm } from "@/modules/workspace/components/api-form";
import { FinanceFields } from "./finance-fields";
import { DeleteTransaction } from "./delete-transaction";

type Row = {
  id: string;
  bookedAt: string;
  description: string | null;
  amount: string;
  currency: string;
  direction: string;
  isPaid: boolean;
  paidBy: string | null;
};
const columns = [
  ["bookedAt", "Datum"],
  ["description", "Beschreibung"],
  ["income", "Einnahmen"],
  ["expenses", "Ausgaben"],
  ["isPaid", "Bezahlt"],
  ["paidBy", "Bezahlt von"],
] as const;
type SortKey = (typeof columns)[number][0];
const collator = new Intl.Collator("de", {
  numeric: true,
  sensitivity: "base",
});

function sortValue(row: Row, key: SortKey): string | bigint | number | null {
  if (key === "income" || key === "expenses") {
    return row.direction === (key === "income" ? "INCOME" : "EXPENSE")
      ? cents(row.amount)
      : null;
  }
  if (key === "isPaid") return Number(row.isPaid);
  if (key === "paidBy") return row.isPaid ? row.paidBy : null;
  return row[key];
}

export function FinanceTable({ rows }: { rows: Row[] }) {
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({
    key: "bookedAt",
    descending: true,
  });
  const [direction, setDirection] = useState("");
  const [payment, setPayment] = useState("");
  const [payer, setPayer] = useState("");
  const [search, setSearch] = useState("");
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const payers = [
    ...new Set([
      ...paymentSources,
      ...rows.flatMap((row) => (row.isPaid && row.paidBy ? [row.paidBy] : [])),
    ]),
  ].sort(collator.compare);
  const visible = rows
    .filter(
      (row) =>
        !deletedIds.includes(row.id) &&
        (!direction || row.direction === direction) &&
        (!payment || row.isPaid === (payment === "paid")) &&
        (!payer ||
          (row.isPaid &&
            (payer === "unknown" ? !row.paidBy : row.paidBy === payer))) &&
        (row.description ?? "")
          .toLocaleLowerCase("de")
          .includes(search.trim().toLocaleLowerCase("de")),
    )
    .sort((a, b) => {
      const left = sortValue(a, sort.key),
        right = sortValue(b, sort.key);
      // Missing values stay at the end in either direction.
      if (left === null && right !== null) return 1;
      if (right === null && left !== null) return -1;
      let comparison = 0;
      if (left !== null && right !== null) {
        comparison =
          typeof left === "string" && typeof right === "string"
            ? collator.compare(left, right)
            : left < right
              ? -1
              : left > right
                ? 1
                : 0;
      }
      return (
        (sort.descending ? -comparison : comparison) || a.id.localeCompare(b.id)
      );
    });
  const filteredTotals = financeTotals(visible);
  const style = "mt-1 block w-full rounded border bg-white p-2";

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="Buchungen filtern"
        className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label>
          Art
          <select
            className={style}
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
          >
            <option value="">Einnahmen und Ausgaben</option>
            <option value="INCOME">Nur Einnahmen</option>
            <option value="EXPENSE">Nur Ausgaben</option>
          </select>
        </label>
        <label>
          Zahlungsstatus
          <select
            className={style}
            value={payment}
            onChange={(event) => setPayment(event.target.value)}
          >
            <option value="">Alle Zahlungsstatus</option>
            <option value="paid">Bezahlt / eingegangen</option>
            <option value="unpaid">Offen / unbestätigt</option>
          </select>
        </label>
        <label>
          Bezahlt von
          <select
            className={style}
            value={payer}
            onChange={(event) => setPayer(event.target.value)}
          >
            <option value="">Alle Zahler</option>
            {payers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="unknown">Bezahlt, Zahler unbekannt</option>
          </select>
        </label>
        <label>
          Beschreibung suchen
          <input
            type="search"
            className={style}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="z. B. Technik oder Sponsoring"
          />
        </label>
        <button
          type="button"
          className="justify-self-start rounded border px-3 py-2 text-sm"
          onClick={() => {
            setDirection("");
            setPayment("");
            setPayer("");
            setSearch("");
          }}
        >
          Filter zurücksetzen
        </button>
      </div>
      <p
        role="status"
        aria-label="Gefilterte Buchungsübersicht"
        className="text-sm text-stone-600"
      >
        {visible.length} von {rows.length} Buchungen · Gefilterte EUR-Summen:
        Einnahmen {euro(filteredTotals.income)} · Ausgaben{" "}
        {euro(filteredTotals.expenses)}. Die Kennzahlen oben zeigen weiterhin
        das gesamte Event.
      </p>
      <div className="overflow-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Event-Buchungen. Spaltenüberschriften anklicken, um die Sortierung
            zu ändern.
          </caption>
          <thead className="bg-stone-100">
            <tr>
              {columns.map(([key, label]) => (
                <th
                  scope="col"
                  className="p-3"
                  key={key}
                  aria-sort={
                    sort.key === key
                      ? sort.descending
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    className="rounded px-1 py-1 whitespace-nowrap hover:bg-stone-200 focus-visible:outline-2"
                    onClick={() =>
                      setSort((previous) => ({
                        key,
                        descending:
                          previous.key === key ? !previous.descending : false,
                      }))
                    }
                  >
                    {label}{" "}
                    <span aria-hidden="true">
                      {sort.key === key ? (sort.descending ? "↓" : "↑") : "↕"}
                    </span>
                  </button>
                </th>
              ))}
              <th scope="col" className="p-3">
                Bearbeiten
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
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
                      <summary className="cursor-pointer">Bearbeiten</summary>
                      <ApiForm
                        method="PATCH"
                        reset={false}
                        endpoint={`/api/finances/transactions/${row.id}`}
                        className="min-w-64 space-y-3 p-3"
                      >
                        <FinanceFields row={row} />
                      </ApiForm>
                      <DeleteTransaction
                        id={row.id}
                        description={row.description}
                        amount={row.amount}
                        onDeleted={() =>
                          setDeletedIds((previous) => [...previous, row.id])
                        }
                      />
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <p className="p-6">
            {rows.length
              ? "Keine Buchungen für diese Filter. Ändere die Auswahl oder setze die Filter zurück."
              : "Noch keine Buchungen. Trage oben die erste Einnahme oder Ausgabe ein."}
          </p>
        )}
      </div>
    </div>
  );
}
