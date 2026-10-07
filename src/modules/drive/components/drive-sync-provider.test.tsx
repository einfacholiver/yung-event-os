import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
const sync = vi.hoisted(() => vi.fn());
vi.mock("../actions", () => ({ syncGoogleDrive: sync }));
import { DriveSyncProvider, useDriveSync } from "./drive-sync-provider";
function Start() {
  const { startSync } = useDriveSync();
  return (
    <button
      onClick={() => void startSync({ id: "root", name: "Veranstaltungen" })}
    >
      Sync starten
    </button>
  );
}
function Workspace() {
  const [visible, setVisible] = useState(true);
  return (
    <DriveSyncProvider>
      <button onClick={() => setVisible(false)}>Andere Seite</button>
      {visible && <Start />}
    </DriveSyncProvider>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
});
it("keeps incremental progress and completion visible when leaving the browser page", async () => {
  let finish!: (value: unknown) => void;
  sync.mockResolvedValueOnce({
    success: true,
    result: { total: 10, folders: 2, files: 8, complete: false },
  });
  sync.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<Workspace />);
  fireEvent.click(screen.getByRole("button", { name: "Sync starten" }));
  expect(screen.getByText("Drive wird synchronisiert …")).toBeInTheDocument();
  await screen.findByText("10 Metadaten · 2 Ordner · 8 Dateien");
  fireEvent.click(screen.getByRole("button", { name: "Andere Seite" }));
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
  await act(async () =>
    finish({
      success: true,
      result: { total: 20, folders: 3, files: 17, complete: true },
    }),
  );
  expect(screen.getByText("Drive-Sync abgeschlossen")).toBeInTheDocument();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(sessionStorage.getItem("yung-drive-sync:root")).toBeNull();
  expect(sync.mock.calls[0][0]).toBe(sync.mock.calls[1][0]);
  fireEvent.click(screen.getByRole("button", { name: "Meldung schließen" }));
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});
it("shows errors persistently and resumes the saved run on retry", async () => {
  sessionStorage.setItem("yung-drive-sync:root", "saved-run");
  sync.mockResolvedValueOnce({
    success: false,
    error: "Google begrenzt die Anfragen.",
  });
  sync.mockResolvedValueOnce({
    success: true,
    result: { total: 5, folders: 1, files: 4, complete: true },
  });
  render(<Workspace />);
  fireEvent.click(screen.getByRole("button", { name: "Sync starten" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Google begrenzt die Anfragen.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Fortsetzen" }));
  await screen.findByText("Drive-Sync abgeschlossen");
  expect(sync).toHaveBeenNthCalledWith(1, "saved-run");
  expect(sync).toHaveBeenNthCalledWith(2, "saved-run");
});
it("prevents duplicate concurrent runs and starts a fresh run explicitly", async () => {
  sessionStorage.setItem("yung-drive-sync:root", "old-run");
  let finish!: (value: unknown) => void;
  sync.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  sync.mockResolvedValueOnce({
    success: true,
    result: { total: 1, folders: 0, files: 1, complete: true },
  });
  render(<Workspace />);
  fireEvent.click(screen.getByRole("button", { name: "Sync starten" }));
  fireEvent.click(screen.getByRole("button", { name: "Sync starten" }));
  await waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
  await act(async () => finish({ success: false, error: "Unterbrochen" }));
  fireEvent.click(screen.getByRole("button", { name: "Neu starten" }));
  await screen.findByText("Drive-Sync abgeschlossen");
  expect(sync.mock.calls[1][0]).not.toBe("old-run");
});
