// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  credentials: vi.fn(),
  client: vi.fn(),
  path: vi.fn(),
  update: vi.fn(),
}));
vi.mock("./token", () => ({ getDriveCredentials: mocks.credentials }));
vi.mock("./context", () => ({ getDriveConnection: vi.fn() }));
vi.mock("./google-client", () => ({ verifiedDriveClient: mocks.client }));
vi.mock("@/server/db/client", () => ({
  getDb: () => ({ driveConnection: { updateMany: mocks.update } }),
}));
import { saveDriveFolder } from "./service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.credentials.mockResolvedValue({
    token: "secret",
    account: { id: "account-id", providerAccountId: "verified-sub" },
    connection: { id: "connection-id" },
    organizationId: "org-id",
  });
  mocks.client.mockResolvedValue({ folderPath: mocks.path });
  mocks.update.mockResolvedValue({ count: 1 });
});
it("saves the Google ID and verified name, scoped to the current connection", async () => {
  mocks.path.mockResolvedValue({
    rootId: "root",
    folder: { id: "real-folder-id", name: "Veranstaltungen" },
  });
  await expect(saveDriveFolder("real-folder-id")).resolves.toEqual({
    id: "real-folder-id",
    name: "Veranstaltungen",
  });
  expect(mocks.client).toHaveBeenCalledWith("secret", "verified-sub");
  expect(mocks.update).toHaveBeenCalledWith({
    where: {
      id: "connection-id",
      organizationId: "org-id",
      googleAccountId: "account-id",
      status: "CONNECTED",
    },
    data: {
      rootFolderId: "real-folder-id",
      rootFolderName: "Veranstaltungen",
      folderSelectedAt: expect.any(Date),
    },
  });
});
it("does not save My Drive itself or an unverified folder", async () => {
  mocks.path.mockResolvedValue({
    rootId: "root",
    folder: { id: "root", name: "Meine Ablage" },
  });
  await expect(saveDriveFolder("root")).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  expect(mocks.update).not.toHaveBeenCalled();
});
it("cannot write after disconnect or a change of account", async () => {
  mocks.path.mockResolvedValue({
    rootId: "root",
    folder: { id: "folder-id", name: "Veranstaltungen" },
  });
  mocks.update.mockResolvedValue({ count: 0 });
  await expect(saveDriveFolder("folder-id")).rejects.toMatchObject({
    code: "RECONNECT",
  });
});
