// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  credentials: vi.fn(),
  client: vi.fn(),
  browse: vi.fn(),
  upsert: vi.fn(),
  trash: vi.fn(),
  connection: vi.fn(),
}));
vi.mock("./token", () => ({ getDriveCredentials: mocks.credentials }));
vi.mock("./google-client", () => ({ verifiedDriveClient: mocks.client }));
let log: { id: string; metadata: unknown } | null;
const db = {
  activityLog: {
    findFirst: async () => log,
    create: async ({ data }: { data: { metadata: unknown } }) =>
      (log = { id: "log", metadata: data.metadata }),
    update: async ({ data }: { data: { metadata: unknown } }) => {
      log!.metadata = data.metadata;
    },
  },
  driveItem: { upsert: mocks.upsert, updateMany: mocks.trash },
  driveConnection: { updateMany: mocks.connection },
  $queryRaw: async () => [],
  $transaction: async <T>(callback: (tx: unknown) => Promise<T>) =>
    callback(db),
};
vi.mock("@/server/db/client", () => ({ getDb: () => db }));
import { syncDriveStep } from "./sync-run";
const runId = "853d063a-1d99-4889-9d31-7e3f1ab3a960";
const folder = {
  id: "root",
  name: "Veranstaltungen",
  mimeType: "application/vnd.google-apps.folder",
};
const file = {
  id: "pdf",
  name: "Rechnung.pdf",
  mimeType: "application/pdf",
  parents: ["root"],
};
beforeEach(() => {
  vi.resetAllMocks();
  log = null;
  mocks.credentials.mockResolvedValue({
    token: "token",
    account: { providerAccountId: "subject" },
    connection: { id: "connection", rootFolderId: "root" },
    organizationId: "org",
    userId: "admin",
  });
  mocks.client.mockResolvedValue({ browse: mocks.browse });
  mocks.connection.mockResolvedValue({ count: 1 });
});
it("checkpoints each page, resumes without duplicates and removes stale metadata only after completion", async () => {
  mocks.browse
    .mockResolvedValueOnce({ folder, files: [file], nextPageToken: "page2" })
    .mockResolvedValueOnce({ folder, files: [file] });
  expect(await syncDriveStep(runId)).toMatchObject({
    total: 2,
    complete: false,
  });
  expect(mocks.browse).toHaveBeenCalledOnce();
  expect(mocks.trash).not.toHaveBeenCalled();
  expect(await syncDriveStep(runId)).toMatchObject({
    files: 1,
    folders: 1,
    total: 2,
    complete: true,
  });
  expect(mocks.browse).toHaveBeenLastCalledWith({
    folderId: "root",
    pageToken: "page2",
  });
  expect(mocks.upsert).toHaveBeenCalledTimes(2);
  expect(mocks.trash).toHaveBeenCalledWith({
    where: {
      organizationId: "org",
      connectionId: "connection",
      externalId: { notIn: ["root", "pdf"] },
      updatedAt: { lt: expect.any(Date) },
    },
    data: { trashed: true },
  });
  await syncDriveStep(runId);
  expect(mocks.browse).toHaveBeenCalledTimes(2);
});
it("retains its last checkpoint after a provider failure and rejects a changed root", async () => {
  mocks.browse
    .mockResolvedValueOnce({ folder, files: [], nextPageToken: "page2" })
    .mockRejectedValueOnce(new Error("network"));
  await syncDriveStep(runId);
  const checkpoint = structuredClone(log);
  await expect(syncDriveStep(runId)).rejects.toThrow("network");
  expect(log).toEqual(checkpoint);
  expect(mocks.trash).not.toHaveBeenCalled();
  mocks.credentials.mockResolvedValue({
    connection: { id: "connection", rootFolderId: "different" },
  });
  await expect(syncDriveStep(runId)).rejects.toMatchObject({ status: 409 });
});
