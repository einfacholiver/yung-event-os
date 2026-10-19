export function cents(value: string) {
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function totalCents<T extends { unitPrice: string; quantity: number }>(
  items: T[],
) {
  return items.reduce(
    (sum, item) => sum + cents(item.unitPrice) * BigInt(item.quantity),
    0n,
  );
}
export function amountString(value: bigint) {
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}
export function euro(value: bigint) {
  return `${(value / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${String(value % 100n).padStart(2, "0")} EUR`;
}
