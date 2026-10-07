import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FinanceTable } from "./finance-table";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  });
});
afterEach(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});
const row = {
  id: "canva",
  bookedAt: "2026-10-07",
  description: "Canva Design (Jahresrechnung)",
  amount: "110",
  currency: "EUR",
  direction: "EXPENSE",
  isPaid: true,
  paidBy: "Oliver",
};
it("opens editing outside the scrolling table and keeps all fields and deletion available", () => {
  render(<FinanceTable rows={[row]} />);
  fireEvent.click(screen.getByRole("button", { name: "Bearbeiten" }));
  const dialog = screen.getByRole("dialog", { name: "Buchung bearbeiten" });
  expect(dialog.closest("table")).toBeNull();
  expect(within(dialog).getByLabelText("Beschreibung")).toHaveValue(
    row.description,
  );
  expect(within(dialog).getByLabelText("Bezahlt von")).toHaveValue("Oliver");
  expect(
    within(dialog).getByRole("button", { name: "Speichern" }),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByRole("button", { name: "Löschen" }),
  ).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Schließen" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
