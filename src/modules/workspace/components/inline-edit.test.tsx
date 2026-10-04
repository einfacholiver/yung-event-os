import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InlineEdit } from "./inline-edit";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());
it("creates an invoice with an exact amount and shows confirmation", async () => {
  const request = vi
    .fn()
    .mockResolvedValue(Response.json({ success: true }, { status: 201 }));
  vi.stubGlobal("fetch", request);
  render(
    <InlineEdit
      type="invoice"
      events={[{ id: "event", name: "Chapter Four" }]}
      initial={{ counterparty: "", amount: "", status: "DRAFT" }}
    />,
  );
  fireEvent.change(screen.getByLabelText("Event"), {
    target: { value: "event" },
  });
  fireEvent.change(screen.getByLabelText("Lieferant"), {
    target: { value: "Security" },
  });
  fireEvent.change(screen.getByLabelText("Betrag (EUR)"), {
    target: { value: "12.34" },
  });
  expect(
    screen.queryByRole("option", { name: "DONE" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Anlegen" }));
  expect(await screen.findByText("Angelegt")).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith(
    "/api/invoices",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        counterparty: "Security",
        totalAmount: "12.34",
        status: "DRAFT",
        eventId: "event",
      }),
    }),
  );
});
it("keeps edits on a network failure and allows retry", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(
    <InlineEdit
      type="task"
      id="task"
      initial={{ title: "Artwork", status: "TODO", priority: "MEDIUM" }}
    />,
  );
  expect(
    screen.queryByRole("option", { name: "PAID" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
  expect(
    await screen.findByText("Server nicht erreichbar. Bitte erneut versuchen."),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Titel")).toHaveValue("Artwork");
  expect(screen.getByRole("button", { name: "Speichern" })).toBeEnabled();
});
