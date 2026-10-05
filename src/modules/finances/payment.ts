import { z } from "zod";
export const paymentSources = ["Oliver", "Daniel", "Konto", "PayPal"] as const;
export const paymentFields = {
  isPaid: z
    .union([
      z.literal("on"),
      z.literal("true"),
      z.literal("false"),
      z.literal(""),
    ])
    .optional()
    .transform((value) => value === "on" || value === "true"),
  paidBy: z.string().trim().max(100).optional(),
};
export function normalizePayment<
  T extends { isPaid: boolean; paidBy?: string },
>(input: T) {
  return {
    ...input,
    paidBy: input.isPaid && input.paidBy ? input.paidBy : null,
  };
}
