import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FinanceTable } from "./finance-table";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const rows = [
  {
    id: "a",
    bookedAt: "2026-09-19",
    description: "Technik",
    amount: "1000",
    currency: "EUR",
    direction: "EXPENSE",
    isPaid: false,
    paidBy: null,
  },
  {
    id: "b",
    bookedAt: "2026-09-18",
    description: "Banner",
    amount: "108",
    currency: "EUR",
    direction: "EXPENSE",
    isPaid: true,
    paidBy: "Daniel",
  },
  {
    id: "c",
    bookedAt: "2026-09-17",
    description: "Sponsoring",
    amount: "200",
    currency: "EUR",
    direction: "INCOME",
    isPaid: true,
    paidBy: "Konto",
  },
];
function descriptions() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[1].textContent);
}
it("shows linked invoice status, the complete document path and filters missing invoices", () => {
  const document = {
    id: "pdf",
    name: "Technik.pdf",
    path: "Veranstaltungen / Chapter Four / Ausgaben / Technik.pdf",
    externalId: "drive-pdf",
    mimeType: "application/pdf",
    category: "EXPENSES",
  };
  render(
    <FinanceTable
      eventId="four"
      rows={[{ ...rows[0], invoiceDocument: document }, rows[1]]}
      documents={[document]}
    />,
  );
  expect(screen.getByText("Rechnung hinterlegt")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Technik.pdf ↗" })).toHaveAttribute(
    "href",
    "https://drive.google.com/file/d/drive-pdf/view",
  );
  expect(screen.getAllByRole("option", { name: document.path }).length).toBe(2);
  fireEvent.change(screen.getByRole("combobox", { name: /^Rechnung$/ }), {
    target: { value: "missing" },
  });
  expect(descriptions()).toEqual(["Banner"]);
});
it("sorts numeric expenses and reverses the sort while keeping empty cells last", () => {
  render(<FinanceTable rows={rows} />);
  expect(descriptions()).toEqual(["Technik", "Banner", "Sponsoring"]);
  fireEvent.click(screen.getByRole("button", { name: "Ausgaben" }));
  expect(descriptions()).toEqual(["Banner", "Technik", "Sponsoring"]);
  expect(
    screen.getByRole("columnheader", { name: "Ausgaben" }),
  ).toHaveAttribute("aria-sort", "ascending");
  fireEvent.click(screen.getByRole("button", { name: "Ausgaben" }));
  expect(descriptions()).toEqual(["Technik", "Banner", "Sponsoring"]);
  expect(
    screen.getByRole("columnheader", { name: "Ausgaben" }),
  ).toHaveAttribute("aria-sort", "descending");
});
it("combines filters, reports filtered totals and resets without changing data", () => {
  render(<FinanceTable rows={rows} />);
  const filters = within(
    screen.getByRole("group", { name: "Buchungen filtern" }),
  );
  fireEvent.change(filters.getByRole("combobox", { name: "Art" }), {
    target: { value: "EXPENSE" },
  });
  fireEvent.change(filters.getByRole("combobox", { name: "Zahlungsstatus" }), {
    target: { value: "paid" },
  });
  fireEvent.change(filters.getByRole("combobox", { name: "Bezahlt von" }), {
    target: { value: "Daniel" },
  });
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Beschreibung suchen" }),
    { target: { value: "BANNER" } },
  );
  expect(descriptions()).toEqual(["Banner"]);
  expect(
    screen.getByRole("status", { name: "Gefilterte Buchungsübersicht" }),
  ).toHaveTextContent("1 von 3 Buchungen");
  expect(
    screen.getByRole("status", { name: "Gefilterte Buchungsübersicht" }),
  ).toHaveTextContent("Ausgaben 108,00 €");
  fireEvent.change(filters.getByRole("combobox", { name: "Art" }), {
    target: { value: "INCOME" },
  });
  expect(
    screen.getByText(/Keine Buchungen für diese Filter/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Filter zurücksetzen" }));
  expect(descriptions()).toHaveLength(3);
});
