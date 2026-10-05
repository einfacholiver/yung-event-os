// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  credentials: vi.fn(),
  client: vi.fn(),
  generate: vi.fn(),
  createFolder: vi.fn(),
  browse: vi.fn(),
  item: vi.fn(),
  mapping: vi.fn(),
}));
vi.mock("@/modules/drive/server/token", () => ({
  getDriveCredentials: mocks.credentials,
}));
vi.mock("@/modules/drive/server/google-client", () => ({
  verifiedDriveClient: mocks.client,
}));
type Plan = { parentId: string; name: string; ids: string[]; ready: boolean };
let event: { id: string } | null = null;
let log: { id: string; metadata: Plan } | null = null;
const db = {
  event: {
    findFirst: async () => event,
    create: async () => {
      event = { id: "event-five" };
      return event;
    },
  },
  activityLog: {
    findFirst: async () => log,
    create: async ({ data }: { data: { metadata: Plan } }) => {
      log = { id: "setup-log", metadata: data.metadata };
      return log;
    },
    update: async ({ data }: { data: { metadata: Plan } }) => {
      log!.metadata = data.metadata;
    },
  },
  driveItem: { upsert: mocks.item },
  driveFolderMapping: { upsert: mocks.mapping },
  $queryRaw: async () => [],
  $transaction: async <T>(callback: (tx: unknown) => Promise<T>) =>
    callback(db),
};
vi.mock("@/server/db/client", () => ({ getDb: () => db }));
import { createEventWithFolders } from "./create-event";
import { DRIVE_WRITE_SCOPE } from "@/modules/drive/config";
beforeEach(() => {
  vi.clearAllMocks();
  event = null;
  log = null;
  mocks.credentials.mockResolvedValue({
    organizationId: "org",
    userId: "user",
    connection: { id: "connection", rootFolderId: "events-root" },
    account: { scope: DRIVE_WRITE_SCOPE, providerAccountId: "subject" },
    token: "token",
  });
  mocks.generate.mockResolvedValue([
    "event-root",
    "expenses",
    "income",
    "permits",
    "media",
  ]);
  mocks.browse.mockResolvedValue({ files: [] });
  mocks.createFolder.mockResolvedValue({});
  mocks.item.mockImplementation(
    async ({ create }: { create: { externalId: string } }) => ({
      id: create.externalId,
    }),
  );
  mocks.mapping.mockResolvedValue({});
  mocks.client.mockResolvedValue({
    folderPath: async () => ({}),
    browse: mocks.browse,
    generateFolderIds: mocks.generate,
    createFolder: mocks.createFolder,
  });
});
it("creates five scoped folders and stores all mappings, with no second creation on retry", async () => {
  expect(await createEventWithFolders({ name: "Chapter Five" })).toEqual({
    id: "event-five",
  });
  expect(mocks.createFolder.mock.calls).toEqual([
    ["event-root", "events-root", "YUNG Chapter Five"],
    ["expenses", "event-root", "Ausgaben"],
    ["income", "event-root", "Einnahmen"],
    ["permits", "event-root", "Genehmigungen"],
    ["media", "event-root", "MEDIA"],
  ]);
  expect(mocks.mapping).toHaveBeenCalledTimes(5);
  await createEventWithFolders({ name: "Chapter Five" });
  expect(mocks.generate).toHaveBeenCalledTimes(1);
  expect(mocks.createFolder).toHaveBeenCalledTimes(5);
});
it("resumes a partial failure using the previously reserved folder IDs", async () => {
  mocks.createFolder.mockRejectedValueOnce(new Error("network timeout"));
  await expect(
    createEventWithFolders({ name: "Chapter Five" }),
  ).rejects.toMatchObject({ status: 503 });
  expect(mocks.mapping).not.toHaveBeenCalled();
  await createEventWithFolders({ name: "Chapter Five" });
  expect(mocks.generate).toHaveBeenCalledTimes(1);
  expect(mocks.createFolder.mock.calls[0]).toEqual(
    mocks.createFolder.mock.calls[1],
  );
  expect(mocks.mapping).toHaveBeenCalledTimes(5);
});
it("requires writing scope before any Drive request", async () => {
  mocks.credentials.mockResolvedValue({ account: { scope: "openid" } });
  await expect(
    createEventWithFolders({ name: "Chapter Five" }),
  ).rejects.toMatchObject({ status: 403 });
  expect(mocks.client).not.toHaveBeenCalled();
});
it("refuses an existing event or conflicting Drive folder without creating anything", async () => {
  event = { id: "old-event" };
  await expect(
    createEventWithFolders({ name: "Chapter Five" }),
  ).rejects.toMatchObject({ status: 409 });
  expect(mocks.createFolder).not.toHaveBeenCalled();
  event = null;
  mocks.browse.mockResolvedValue({ files: [{ name: "YUNG Chapter Five" }] });
  await expect(
    createEventWithFolders({ name: "Chapter Five" }),
  ).rejects.toMatchObject({ status: 409 });
  expect(mocks.generate).not.toHaveBeenCalled();
});
