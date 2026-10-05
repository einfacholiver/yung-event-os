import { z } from "zod";
import { moneySchema } from "@/modules/workspace/schemas";
// Parse quoted semicolon CSV, including newlines and escaped quotes inside cells.
function csvRows(source: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const input = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
    } else if (char === ";" || char === "\n") {
      row.push(cell);
      cell = "";
      closed = false;
      if (char === "\n") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else if (char === '"' && !cell && !closed) quoted = true;
    else {
      if (closed || char === '"')
        throw new Error("Ungültige CSV-Anführungszeichen.");
      cell += char;
    }
  }
  if (quoted) throw new Error("Nicht geschlossenes CSV-Feld.");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
const quantity = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d+(?:\.0+)?$/.test(value))
  .transform((value) => (value === "" ? null : Number(value)))
  .refine(
    (value) =>
      value === null || (Number.isSafeInteger(value) && value <= 1000000),
  );
const schema = z.object({
  number: z.string().trim().min(1).max(100),
  paymentStatus: z.enum([
    "PAID",
    "PENDING",
    "REFUNDED",
    "PARTIALLY_REFUNDED",
    "FAILED",
    "CANCELLED",
    "UNPAID",
  ]),
  cancelledAt: z.string(),
  AnzahlTicket: quantity,
  AnzahlTable: quantity,
  AnzahlLounge: quantity,
  total: moneySchema,
  amountRefunded: moneySchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
});
export function parseTicketCsv(source: string) {
  if (source.length > 2_000_000)
    throw new Error("Datei zu groß (maximal 2 MB).");
  const [header, ...rows] = csvRows(source);
  if (!header || !rows.length || rows.length > 5000)
    throw new Error("Erwartet werden 1 bis 5.000 Bestellungen.");
  if (new Set(header).size !== header.length)
    throw new Error("Doppelte Spaltennamen.");
  for (const key of Object.keys(schema.shape))
    if (!header.includes(key)) throw new Error(`Spalte fehlt: ${key}`);
  const seen = new Set<string>();
  return rows.map((cells, index) => {
    if (cells.length !== header.length)
      throw new Error(`Zeile ${index + 2}: Spaltenanzahl stimmt nicht.`);
    const result = schema.safeParse(
      Object.fromEntries(header.map((name, i) => [name, cells[i]])),
    );
    if (!result.success)
      throw new Error(
        `Zeile ${index + 2}: Ungültiges Feld ${String(result.error.issues[0].path[0])}.`,
      );
    const value = result.data;
    if (seen.has(value.number))
      throw new Error(`Zeile ${index + 2}: Doppelte Bestellnummer.`);
    seen.add(value.number);
    if (Number(value.amountRefunded) > Number(value.total))
      throw new Error(`Zeile ${index + 2}: Erstattung übersteigt Bestellwert.`);
    return {
      orderNumber: value.number,
      paymentStatus: value.paymentStatus,
      cancelled: Boolean(value.cancelledAt.trim()),
      tickets: value.AnzahlTicket,
      tables: value.AnzahlTable,
      lounges: value.AnzahlLounge,
      total: value.total,
      refunded: value.amountRefunded,
      currency: value.currency,
    };
  });
}
