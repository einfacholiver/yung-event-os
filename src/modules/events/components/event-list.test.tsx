import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventList } from "./event-list";

const events = [
  {
    id: "pre-event",
    name: "YUNG Pre-Event",
    status: "DRAFT" as const,
    startsAt: null,
    timezone: "Europe/Berlin",
    location: null,
  },
  {
    id: "chapter-one",
    name: "Chapter One",
    status: "PLANNED" as const,
    startsAt: new Date("2026-10-04T18:00:00Z"),
    timezone: "Europe/Berlin",
    location: "Berlin",
  },
];

describe("event list", () => {
  it("links to real event ids and distinguishes missing dates", () => {
    render(<EventList events={events} />);
    expect(
      screen.getByRole("link", { name: "YUNG Pre-Event öffnen" }),
    ).toHaveAttribute("href", "/events/pre-event");
    expect(screen.getByText("Noch nicht festgelegt")).toBeInTheDocument();
    expect(screen.getByText(/20:00/)).toBeInTheDocument();
  });
  it("combines search and status and resets empty results", () => {
    render(<EventList events={events} />);
    fireEvent.change(screen.getByLabelText("Events suchen"), {
      target: { value: " chapter " },
    });
    expect(
      screen.queryByRole("link", { name: "YUNG Pre-Event öffnen" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Status filtern"), {
      target: { value: "DRAFT" },
    });
    expect(screen.getByText("Keine passenden Events")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Filter zurücksetzen" }),
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
  it("shows an honest empty state with no fabricated records", () => {
    render(<EventList events={[]} />);
    expect(screen.getByText("Noch keine Events")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
