import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const select = vi.hoisted(() => vi.fn());
vi.mock("../actions", () => ({ selectDriveFolder: select }));
import { DriveBrowser } from "./drive-browser";
afterEach(() => vi.unstubAllGlobals());

it("waits for explicit browsing, then saves an ID rather than the folder name", async () => {
  const request = vi.fn().mockResolvedValue(
    Response.json({
      folder: { id: "real-folder", name: "Veranstaltungen" },
      breadcrumbs: [
        { id: "root", name: "Meine Ablage" },
        { id: "real-folder", name: "Veranstaltungen" },
      ],
      files: [],
    }),
  );
  vi.stubGlobal("fetch", request);
  select.mockResolvedValue({
    success: true,
    folder: { id: "real-folder", name: "Veranstaltungen" },
  });
  render(<DriveBrowser selectedFolder={null} />);
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Meine Ablage öffnen" }));
  await screen.findByText("Dieser Ordner ist leer.");
  fireEvent.click(
    screen.getByRole("button", { name: "Diesen Ordner auswählen" }),
  );
  await waitFor(() => expect(select).toHaveBeenCalledWith("real-folder"));
  expect(
    await screen.findByText(
      "Ordner gespeichert. Es wurde noch kein Sync gestartet.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("real-folder")).toBeInTheDocument();
});
it("shows failed permissions instead of an empty folder", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: "Kein Zugriff" }, { status: 403 }),
      ),
  );
  render(<DriveBrowser selectedFolder={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Meine Ablage öffnen" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Kein Zugriff");
  expect(screen.queryByText("Dieser Ordner ist leer.")).not.toBeInTheDocument();
});
