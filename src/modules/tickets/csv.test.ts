import { describe, expect, it } from "vitest";
import { parseTicketCsv } from "./csv";
const header =
  "number;paymentStatus;cancelledAt;AnzahlTicket;AnzahlTable;AnzahlLounge;total;amountRefunded;currency;userNotes\n";
const row = '123;PAID;;2.0;0.0;0.0;40;0;EUR;"note; with\nquoted ""text"""';
describe("One.com ticket CSV", () => {
  it("handles quoted cells and decimal quantities without retaining private fields", () => {
    const [result] = parseTicketCsv("\uFEFF" + header + row);
    expect(result).toMatchObject({
      tickets: 2,
      tables: 0,
      total: "40",
      cancelled: false,
    });
    expect(result).not.toHaveProperty("userNotes");
  });
  it("preserves unknown ticket quantities instead of inferring from money", () => {
    expect(
      parseTicketCsv(header + row.replace("2.0;", ";"))[0].tickets,
    ).toBeNull();
  });
  it("rejects duplicate orders, fractional tickets and malformed files", () => {
    expect(() => parseTicketCsv(header + row + "\n" + row)).toThrow(
      "Doppelte Bestellnummer",
    );
    expect(() => parseTicketCsv(header + row.replace("2.0", "2.5"))).toThrow(
      "AnzahlTicket",
    );
    expect(() => parseTicketCsv(header + row.slice(0, -1))).toThrow();
    expect(() =>
      parseTicketCsv(header + row.replace("40;0;", "40;50;")),
    ).toThrow("Erstattung");
  });
});
