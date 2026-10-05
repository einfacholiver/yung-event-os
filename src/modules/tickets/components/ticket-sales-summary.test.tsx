import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TicketSalesSummary } from "./ticket-sales-summary";
it("shows separate ticket and upgrade revenues without treating packages as visitors", () => {
  render(
    <TicketSalesSummary
      items={[
        {
          id: "ticket",
          description: "GROUP THREE TICKET",
          category: "TICKET",
          quantity: 12,
          unitPrice: "50.00",
          grossRevenue: "600.00",
        },
        {
          id: "upgrade",
          description: "Table Upgrade",
          category: "UPGRADE",
          quantity: 6,
          unitPrice: "30.00",
          grossRevenue: "180.00",
        },
      ]}
    />,
  );
  expect(screen.getAllByText("780,00 €")).toHaveLength(2);
  expect(screen.getByRole("cell", { name: "12" })).toBeInTheDocument();
  expect(
    screen.getByText(/Gruppen-Tickets zählen hier als verkaufte Pakete/),
  ).toBeInTheDocument();
});
