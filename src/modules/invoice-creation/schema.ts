import { z } from "zod";

// PDF standard fonts cover Latin characters used in the supplied template.
// Reject unsupported glyphs instead of silently corrupting names in an invoice.
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) => /^[\x20-\x7e\xa0-\xff\n\r\t€–—‘’“”]*$/.test(value),
      "Bitte lateinische Zeichen ohne Emojis verwenden.",
    );
const decimal = z
  .string()
  .trim()
  .regex(/^\d{1,7}(?:[.,]\d{1,2})?$/)
  .transform((v) => v.replace(",", "."));
export const creationSchema = z
  .object({
    requestId: z.uuid(),
    recipient: text(500).refine(
      (v) => v.split(/\r\n?|\n/).length <= 8,
      "Anschrift auf maximal acht Zeilen verteilen.",
    ),
    title: text(150).refine(
      (v) => !/[\r\n]/.test(v),
      "Bezeichnung in einer Zeile eingeben.",
    ),
    serviceDate: z.string().date(),
    payment: z.enum(["TRANSFER_OPEN", "TRANSFER_PAID", "CASH_PAID"]),
    paidAt: z.union([z.literal(""), z.string().date()]),
    dueDays: z.number().int().min(1).max(90),
    destination: z.enum(["EVENT", "DJ_2026"]),
    eventId: z.string().max(100),
    items: z
      .array(
        z.object({
          description: text(1500).refine(
            (v) => v.split(/\r\n?|\n/).length <= 60,
            "Maximal 60 Zeilen pro Position verwenden.",
          ),
          quantity: z.number().int().min(1).max(10000),
          unitPrice: decimal,
        }),
      )
      .min(1)
      .max(30),
    confirmed: z.literal(true),
  })
  .superRefine((data, ctx) => {
    if (data.destination === "EVENT" && !data.eventId)
      ctx.addIssue({
        code: "custom",
        path: ["eventId"],
        message: "Event auswählen.",
      });
    if (data.payment !== "TRANSFER_OPEN" && !data.paidAt)
      ctx.addIssue({
        code: "custom",
        path: ["paidAt"],
        message: "Zahlungsdatum angeben.",
      });
    // Zod may still execute this refinement after a string regex issue.
    // Never pass invalid monetary input to BigInt.
    if (
      data.items.some(
        (item) =>
          !/^\d{1,7}(?:\.\d{1,2})?$/.test(item.unitPrice) ||
          !Number.isInteger(item.quantity),
      )
    )
      return;
    const total = totalCents(data.items);
    if (total <= 0n || total > 99999999999999n)
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message:
          "Gesamtbetrag muss positiv sein und in den Betragsbereich passen.",
      });
  });
export type InvoiceInput = z.infer<typeof creationSchema>;
export function cents(value: string) {
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function totalCents(items: InvoiceInput["items"]) {
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
export function berlinDate(now: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function invoiceNumber(period: string, sequence: number) {
  return `${period}-${1000 + sequence}`;
}
export function filename(number: string, title: string) {
  return `${number}--${title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 100)}.pdf`;
}
export function existingSequence(period: string, names: string[]) {
  const escaped = period.replace(/-/g, "[-_]");
  const pattern = new RegExp(
    `(?:^|[^0-9])${escaped}[-_](\\d{4,9})(?!\\d)`,
    "g",
  );
  let maximum = 0;
  for (const name of names) {
    for (const match of name.matchAll(pattern))
      maximum = Math.max(maximum, Number(match[1]) - 1000);
  }
  return maximum;
}
export const DJ_FOLDER_2026 = "18xlDM6tllxVCaI46ALs44E4edS4iJbis";
