import { z } from "zod";
export const moneySchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,12}(?:[.,]\d{1,2})?$/,
    "Betrag mit maximal zwei Nachkommastellen eingeben.",
  )
  .transform((value) => value.replace(",", "."));
export const invoiceSchema = z.object({
  counterparty: z.string().trim().min(1).max(200),
  totalAmount: moneySchema,
  status: z.enum(["DRAFT", "OPEN", "PAID", "CANCELLED"]),
});
export const taskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
});
