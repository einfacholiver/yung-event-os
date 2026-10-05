import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EventNavigation } from "./event-navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/events/event-1/documents",
}));

it("exposes focused event sections with exactly one active link", () => {
  render(<EventNavigation eventId="event-1" />);
  const links = screen.getAllByRole("link");
  expect(links.map((link) => link.textContent)).toEqual([
    "Overview",
    "Finanzen",
    "Dokumente",
    "Media",
    "Genehmigungen",
    "Tickets",
    "Analytics",
  ]);
  expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "href",
    "/events/event-1",
  );
  expect(screen.getByRole("link", { name: "Dokumente" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(
    links.filter((link) => link.hasAttribute("aria-current")),
  ).toHaveLength(1);
});
