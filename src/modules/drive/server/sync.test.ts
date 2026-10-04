// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  credentials: vi.fn(),
  client: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("./token", () => ({ getDriveCredentials: mocks.credentials }));
vi.mock("./context", () => ({ getDriveConnection: vi.fn() }));
vi.mock("./google-client", () => ({ verifiedDriveClient: mocks.client }));
vi.mock("@/server/db/client", () => ({
  getDb: () => ({
    driveItem: { upsert: mocks.upsert, updateMany: mocks.updateMany },
    driveConnection: { update: mocks.update },
    $transaction: mocks.transaction,
  }),
}));
import { syncDrive } from "./service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.credentials.mockResolvedValue({
    token: "secret",
    account: { providerAccountId: "verified-sub" },
    connection: { id: "connection", rootFolderId: "events" },
    organizationId: "org",
  });
  mocks.client.mockResolvedValue({
    browse: vi
      .fn()
      .mockResolvedValueOnce({
        folder: {
          id: "events",
          name: "Veranstaltungen",
          mimeType: "application/vnd.google-apps.folder",
        },
        files: [
          {
            id: "chapter-four",
            name: "YUNG Chapter four",
            mimeType: "application/vnd.google-apps.folder",
            parents: ["events"],
          },
          {
            id: "readme",
            name: "README.pdf",
            mimeType: "application/pdf",
            parents: ["events"],
          },
        ],
      })
      .mockResolvedValueOnce({
        folder: {
          id: "chapter-four",
          name: "YUNG Chapter four",
          mimeType: "application/vnd.google-apps.folder",
          parents: ["events"],
        },
        files: [
          {
            id: "expenses",
            name: "Ausgaben",
            mimeType: "application/vnd.google-apps.folder",
            parents: ["chapter-four"],
          },
        ],
      })
      .mockResolvedValueOnce({
        folder: {
          id: "expenses",
          name: "Ausgaben",
          mimeType: "application/vnd.google-apps.folder",
          parents: ["chapter-four"],
        },
        files: [],
      }),
  });
  mocks.transaction.mockResolvedValue([]);
});

it("upserts the tree by external ID and records a completed sync", async () => {
  await expect(syncDrive()).resolves.toMatchObject({
    total: 4,
    folders: 3,
    files: 1,
  });
  expect(mocks.upsert).toHaveBeenCalledTimes(4);
  expect(mocks.upsert.mock.calls[0][0].where).toEqual({
    connectionId_externalId: {
      connectionId: "connection",
      externalId: "events",
    },
  });
  expect(mocks.transaction).toHaveBeenCalledTimes(1);
  expect(mocks.updateMany).toHaveBeenCalledWith({
    where: {
      connectionId: "connection",
      externalId: { notIn: ["events", "chapter-four", "readme", "expenses"] },
    },
    data: { trashed: true },
  });
});

it("does not start a sync before a folder is selected", async () => {
  mocks.credentials.mockResolvedValue({
    token: "secret",
    account: { providerAccountId: "verified-sub" },
    connection: { id: "connection", rootFolderId: null },
    organizationId: "org",
  });
  await expect(syncDrive()).rejects.toMatchObject({ code: "INVALID_INPUT" });
  expect(mocks.client).not.toHaveBeenCalled();
});
