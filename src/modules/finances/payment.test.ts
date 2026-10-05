import { expect, it } from "vitest";
import { z } from "zod";
import { paymentFields, normalizePayment } from "./payment";
it("handles HTML checkboxes and clears payer on unpaid entries", () => {
  const schema = z.object(paymentFields);
  expect(
    normalizePayment(schema.parse({ isPaid: "on", paidBy: "Oliver" })),
  ).toEqual({ isPaid: true, paidBy: "Oliver" });
  expect(normalizePayment(schema.parse({ paidBy: "Daniel" }))).toEqual({
    isPaid: false,
    paidBy: null,
  });
  expect(normalizePayment(schema.parse({ isPaid: "on", paidBy: "" }))).toEqual({
    isPaid: true,
    paidBy: null,
  });
  expect(schema.safeParse({ isPaid: "false-but-truthy" }).success).toBe(false);
});
