import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DeleteTransaction } from "./delete-transaction";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("requires confirmation, allows cancellation and refreshes after deletion", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  vi.stubGlobal("fetch", fetch);
  const deleted = vi.fn();
  render(
    <DeleteTransaction
      id="booking"
      description="Technik"
      amount="100"
      onDeleted={deleted}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Löschen" }));
  expect(screen.getByText(/Technik.*100 EUR/)).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Löschen" }));
  fireEvent.click(screen.getByRole("button", { name: "Endgültig löschen" }));
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(fetch).toHaveBeenCalledWith("/api/finances/transactions/booking", {
    method: "DELETE",
  });
  expect(deleted).toHaveBeenCalledOnce();
});
it("keeps the row and displays an error when deletion fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Bitte erneut anmelden." }),
      }),
  );
  const deleted = vi.fn();
  render(
    <DeleteTransaction
      id="booking"
      description="Technik"
      amount="100"
      onDeleted={deleted}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Löschen" }));
  fireEvent.click(screen.getByRole("button", { name: "Endgültig löschen" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Bitte erneut anmelden.",
  );
  expect(refresh).not.toHaveBeenCalled();
  expect(deleted).not.toHaveBeenCalled();
});
