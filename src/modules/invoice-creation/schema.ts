import { z } from "zod";
import { totalCents } from "./money";
export { cents, totalCents, euro, amountString } from "./money";

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
const line = (max: number) =>
  text(max).refine(
    (v) => !/[\r\n\t]/.test(v),
    "Bitte eine einzelne Zeile eingeben.",
  );
export const DEFAULT_SENDER = {
  brand: "LIGHTSIGNAL GBR",
  owners: "Daniel Ecklkofer & Oliver Schöfberger GbR",
  street: "St.-Emmeram-Str. 2",
  postalCity: "84332 Hebertsfelden",
  phone: "+49 175 6836506",
  email: "lightsignal.dj@gmail.com",
  taxNumber: "11316700308",
  bankName: "VR-Bank Rottal-Inn eG",
  iban: "DE16740618130005498473",
  bic: "GENODEF1PFK",
};
function validIban(value: string) {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value)) return false;
  let remainder = 0;
  for (const char of value.slice(4) + value.slice(0, 4)) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits)
      remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}
export const senderSchema = z.object({
  brand: line(40),
  owners: line(100),
  street: line(80),
  postalCity: line(80),
  phone: line(40),
  email: line(100).pipe(z.email()),
  taxNumber: line(40),
  bankName: line(60),
  iban: z
    .string()
    .max(80)
    .transform((v) => v.replace(/\s/g, "").toUpperCase())
    .refine(validIban, "Bitte eine gültige IBAN eingeben."),
  bic: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/,
      "BIC mit 8 oder 11 Zeichen eingeben.",
    ),
});
export type InvoiceSender = z.infer<typeof senderSchema>;
export const creationSchema = z
  .object({
    // Existing stored payloads predate these fields; their PDF bytes stay intact.
    sender: senderSchema.default(() => ({ ...DEFAULT_SENDER })),
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
