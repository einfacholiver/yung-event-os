import { expect, it } from "vitest";
import { euro, financeTotals } from "./finance";
it("adds decimal money exactly and keeps currencies separate", () => {
  const totals = financeTotals([
    { direction: "INCOME", amount: "0.1", currency: "EUR" },
    { direction: "INCOME", amount: "0.2", currency: "EUR" },
    { direction: "EXPENSE", amount: "1", currency: "EUR" },
    { direction: "INCOME", amount: "200", currency: "USD" },
  ]);
  expect(euro(totals.income)).toBe("0,30 €");
  expect(euro(totals.profit)).toBe("−0,70 €");
  expect(financeTotals([]).margin).toBe("—");
});
