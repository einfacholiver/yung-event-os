import { z } from "zod";
export const newEventSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(
      /^[\p{L}\p{N} ._()-]+$/u,
      "Name darf keine Pfadtrenner oder Steuerzeichen enthalten.",
    )
    .transform((value) => `YUNG ${value.replace(/^yung\s+/i, "").trim()}`),
});
export function eventSlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export const newEventFolders = [
  { purpose: "EXPENSES", name: "Ausgaben" },
  { purpose: "INCOME", name: "Einnahmen" },
  { purpose: "PERMISSIONS", name: "Genehmigungen" },
  { purpose: "MEDIA", name: "MEDIA" },
] as const;
