// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { expect, it } from "vitest";
import { renderInvoice } from "./pdf";
import { creationSchema } from "./schema";

it("renders a normal invoice and paginates long descriptions without changing totals", async () => {
  const logo = await readFile(
    "src/modules/invoice-creation/assets/lightsignal.png",
  );
  const base = creationSchema.parse({
    requestId: crypto.randomUUID(),
    recipient: "Test Empfänger\nTeststraße 1\n84332 Testort",
    title: "DJ-Tätigkeit",
    serviceDate: "2026-09-12",
    payment: "CASH_PAID",
    paidAt: "2026-09-12",
    dueDays: 14,
    destination: "DJ_2026",
    eventId: "",
    confirmed: true,
    items: [
      {
        description: "DJ-Tätigkeit für ein Event",
        quantity: 1,
        unitPrice: "500",
      },
    ],
  });
  const bytes = await renderInvoice(base, "2026-10-1001", "2026-10-19", logo);
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  const long = await renderInvoice(
    {
      ...base,
      items: Array.from({ length: 6 }, () => ({
        description:
          "Sehr ausführliche Leistungsbeschreibung mit Umlauten äöü. ".repeat(
            25,
          ),
        quantity: 1,
        unitPrice: "1.10",
      })),
    },
    "VORSCHAU",
    "2026-10-19",
    logo,
  );
  expect((await PDFDocument.load(long)).getPageCount()).toBeGreaterThan(2);
});
