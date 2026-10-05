import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DocumentUpload } from "./document-upload";
const refresh = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
vi.mock("../upload-client", () => ({ uploadInChunks: upload }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("uses the selected category and retains the file and request ID for a retry", async () => {
  upload.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce({
    name: "rechnung.pdf",
    path: "Veranstaltungen / Chapter Four / Einnahmen",
  });
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
  await screen.findByText(/derselben Datei erneut versuchen/);
  const first = upload.mock.calls[0];
  expect(first[2]).toBe("INCOME");
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  const retry = upload.mock.calls[1];
  expect(retry[3]).toBe(first[3]);
  expect(retry[0]).toBe(first[0]);
  expect(screen.getByRole("status")).toHaveTextContent("Einnahmen hochgeladen");
});
