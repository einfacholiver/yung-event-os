export function cents(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function euro(value: bigint) {
  const sign = value < 0 ? "−" : "";
  const absolute = value < 0 ? -value : value;
  return `${sign}${(absolute / 100n).toLocaleString("de-DE")},${String(absolute % 100n).padStart(2, "0")} €`;
}
export function financeTotals(
  rows: { direction: string; amount: string; currency: string }[],
) {
  let income = 0n,
    expenses = 0n;
  for (const row of rows) {
    if (row.currency !== "EUR") continue;
    if (row.direction === "INCOME") income += cents(row.amount);
    else expenses += cents(row.amount);
  }
  return {
    income,
    expenses,
    profit: income - expenses,
    margin:
      income > 0n
        ? `${Number(((income - expenses) * 1000n) / income) / 10} %`
        : "—",
  };
}
