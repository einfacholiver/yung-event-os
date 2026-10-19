// @vitest-environment node
import { expect, it } from "vitest";
import {
  amountString,
  berlinDate,
  creationSchema,
  existingSequence,
  filename,
  invoiceNumber,
  totalCents,
} from "./schema";
export const example = {
  requestId: "40ebba4a-2db6-4c89-bca0-85cf257869f1",
  recipient:
    "Hinterberger Partystadl e.V.\nMoritz Bergschneider / Josef Bergschneider\nHinterberg 40\n84508 Burgkirchen",
  title: "Rave the Mountain Festival",
  serviceDate: "2026-09-12",
  payment: "TRANSFER_OPEN" as const,
  paidAt: "",
  dueDays: 14,
  destination: "DJ_2026" as const,
  eventId: "",
  confirmed: true as const,
  items: [
    {
      description:
        "Gage für DJ-Tätigkeit am 12.09.2026 auf dem Rave the Mountain Festival",
      quantity: 1,
      unitPrice: "500,00",
    },
  ],
};
it("validates the template data and calculates exact cents without floating point", () => {
  const input = creationSchema.parse(example);
  expect(amountString(totalCents(input.items))).toBe("500.00");
  expect(
    amountString(
      totalCents([{ description: "A", quantity: 3, unitPrice: "0.10" }]),
    ),
  ).toBe("0.30");
});
it("numbers invoices monthly and respects Berlin's month boundary", () => {
  expect(berlinDate(new Date("2026-09-30T22:30:00Z"))).toBe("2026-10-01");
  expect(invoiceNumber("2026-10", 1)).toBe("2026-10-1001");
  expect(invoiceNumber("2026-11", 1)).toBe("2026-11-1001");
  expect(
    existingSequence("2026-09", [
      "2026-09-1001--12-09-Festival.pdf",
      "Rechnung_2026_09_1005.pdf",
      "2026-10-1020.pdf",
    ]),
  ).toBe(5);
  expect(filename("2026-10-1001", "DJ / Grüße")).not.toMatch(/[\/\\]/);
});
it("rejects unconfirmed issuance, missing payment date, unknown targets and invalid dates", () => {
  for (const patch of [
    { confirmed: false },
    { payment: "CASH_PAID" },
    { serviceDate: "2026-02-31" },
    { destination: "OTHER" },
    { destination: "EVENT", eventId: "" },
    { recipient: "🤖" },
    { items: [{ description: "A", quantity: 1, unitPrice: "invalid" }] },
    { items: [{ description: "A", quantity: 1, unitPrice: "0" }] },
  ]) {
    expect(creationSchema.safeParse({ ...example, ...patch }).success).toBe(
      false,
    );
  }
});
