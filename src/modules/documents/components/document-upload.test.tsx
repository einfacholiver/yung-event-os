import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DocumentUpload } from "./document-upload";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("uses the selected category and retains the file and request ID for a retry", async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new Error("timeout"))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: "rechnung.pdf",
        path: "Veranstaltungen / Chapter Four / Einnahmen",
      }),
    });
  vi.stubGlobal("fetch", fetch);
  const { container } = render(
    <DocumentUpload
      eventId="event"
      initialPurpose="INCOME"
      targets={[
        { purpose: "INCOME", name: "Einnahmen" },
        { purpose: "EXPENSES", name: "Ausgaben" },
      ]}
    />,
  );
  fireEvent.change(screen.getByLabelText("Datei"), {
    target: {
      files: [
        new File(["%PDF-1.7"], "rechnung.pdf", { type: "application/pdf" }),
      ],
    },
  });
  fireEvent.submit(container.querySelector("form")!);
  await screen.findByText(/Verbindung unterbrochen/);
  const first = fetch.mock.calls[0][1].body as FormData;
  expect(first.get("purpose")).toBe("INCOME");
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  const retry = fetch.mock.calls[1][1].body as FormData;
  expect(retry.get("requestId")).toBe(first.get("requestId"));
  expect((retry.get("file") as File).name).toBe("rechnung.pdf");
  expect(screen.getByRole("status")).toHaveTextContent("Einnahmen hochgeladen");
});
