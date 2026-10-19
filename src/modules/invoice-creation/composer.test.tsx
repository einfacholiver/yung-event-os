import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import { DriveRetry } from "./composer";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("reports successful retry and refreshes without creating another invoice", async () => {
  const request = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ success: true })));
  vi.stubGlobal("fetch", request);
  const onUploaded = vi.fn();
  render(<DriveRetry id="existing-doc" onUploaded={onUploaded} />);
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(
      "In Google Drive abgelegt.",
    ),
  );
  expect(request).toHaveBeenCalledOnce();
  expect(request.mock.calls[0][0]).toBe(
    "/api/invoice-documents/existing-doc/drive",
  );
  expect(onUploaded).toHaveBeenCalledOnce();
  expect(refresh).toHaveBeenCalledOnce();
});
it("keeps delivery retryable when Drive is unavailable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Drive nicht erreichbar" }), {
        status: 503,
      }),
    ),
  );
  render(<DriveRetry id="existing-doc" />);
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Drive nicht erreichbar",
    ),
  );
  expect(screen.getByRole("button")).toBeEnabled();
});
