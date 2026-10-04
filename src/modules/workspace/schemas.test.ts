import { expect, it } from "vitest";
import { invoiceSchema, moneySchema, taskSchema } from "./schemas";
it("accepts exact decimal amounts and rejects precision loss and overflow", () => {
  expect(moneySchema.parse("123,45")).toBe("123.45");
  for (const value of ["", "1.001", "1e3", "-1", "1000000000000", "NaN"])
    expect(moneySchema.safeParse(value).success).toBe(false);
});
it("keeps invoice and task statuses distinct", () => {
  expect(
    invoiceSchema.safeParse({
      counterparty: "Firma",
      totalAmount: "10.50",
      status: "DONE",
    }).success,
  ).toBe(false);
  expect(
    taskSchema.safeParse({
      title: "Artwork",
      status: "PAID",
      priority: "MEDIUM",
    }).success,
  ).toBe(false);
});
