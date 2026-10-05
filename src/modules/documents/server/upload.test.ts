// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  credentials: vi.fn(),
  client: vi.fn(),
  event: vi.fn(),
  mappings: vi.fn(),
  conflict: vi.fn(),
  folderPath: vi.fn(),
  generate: vi.fn(),
  upload: vi.fn(),
  item: vi.fn(),
}));
vi.mock("@/modules/drive/server/token", () => ({
  getDriveCredentials: mocks.credentials,
}));
vi.mock("@/modules/drive/server/google-client", () => ({
  verifiedDriveClient: mocks.client,
}));
let log: { id: string; metadata: unknown } | null;
const db = {
  event: { findFirst: mocks.event },
  driveFolderMapping: { findMany: mocks.mappings, findFirst: mocks.conflict },
  activityLog: {
    findFirst: async () => log,
    create: async ({ data }: { data: { metadata: unknown } }) =>
      (log = { id: "upload-log", metadata: data.metadata }),
    update: async ({ data }: { data: { metadata: unknown } }) => {
      log!.metadata = data.metadata;
    },
  },
  driveItem: { upsert: mocks.item },
  $queryRaw: async () => [],
  $transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> =>
    callback(db),
};
vi.mock("@/server/db/client", () => ({ getDb: () => db }));
import { uploadEventDocument } from "./upload";
import { DRIVE_WRITE_SCOPE } from "@/modules/drive/config";
const input = {
  purpose: "EXPENSES",
  requestId: "853d063a-1d99-4889-9d31-7e3f1ab3a960",
};
const file = () =>
  new File(["%PDF-1.7\nexample"], "rechnung.pdf", { type: "application/pdf" });
beforeEach(() => {
  vi.resetAllMocks();
  log = null;
  mocks.credentials.mockResolvedValue({
    organizationId: "org",
    userId: "user",
    connection: { id: "connection", rootFolderId: "events-root" },
    account: { scope: DRIVE_WRITE_SCOPE, providerAccountId: "subject" },
    token: "token",
  });
  mocks.event.mockResolvedValue({ id: "event" });
  mocks.mappings.mockResolvedValue([
    {
      purpose: "ROOT",
      driveItem: {
        id: "root-item",
        externalId: "event-root",
        connectionId: "connection",
        trashed: false,
      },
    },
    {
      purpose: "EXPENSES",
      driveItem: {
        id: "expense-item",
        externalId: "expenses",
        connectionId: "connection",
        trashed: false,
      },
    },
  ]);
  mocks.conflict.mockResolvedValue(null);
  mocks.folderPath.mockResolvedValue({
    breadcrumbs: [
      { id: "events-root", name: "Veranstaltungen" },
      { id: "event-root", name: "YUNG Chapter Four" },
      { id: "expenses", name: "Ausgaben" },
    ],
  });
  mocks.generate.mockResolvedValue("new-document-id");
  mocks.upload.mockImplementation(async (value) => ({
    id: value.id,
    name: value.name,
    mimeType: value.mimeType,
    parents: [value.parentId],
  }));
  mocks.client.mockResolvedValue({
    folderPath: mocks.folderPath,
    generateFileId: mocks.generate,
    uploadFile: mocks.upload,
  });
});
it("reserves one Drive ID and upserts metadata for immediate visibility, including on retry", async () => {
  await uploadEventDocument("event", input, file());
  await uploadEventDocument("event", input, file());
  expect(mocks.generate).toHaveBeenCalledOnce();
  expect(mocks.client).toHaveBeenCalledWith("token", "subject");
  expect(mocks.upload).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "new-document-id",
      parentId: "expenses",
      name: "rechnung.pdf",
    }),
  );
  expect(mocks.item).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({
        organizationId: "org",
        externalId: "new-document-id",
        parentExternalId: "expenses",
        kind: "FILE",
      }),
    }),
  );
});
it("recovers metadata persistence failure with the same Drive ID and rejects a different file on that request", async () => {
  mocks.item.mockRejectedValueOnce(new Error("database unavailable"));
  await expect(uploadEventDocument("event", input, file())).rejects.toThrow(
    "database unavailable",
  );
  await uploadEventDocument("event", input, file());
  expect(mocks.generate).toHaveBeenCalledOnce();
  await expect(
    uploadEventDocument(
      "event",
      input,
      new File(["%PDF-other"], "rechnung.pdf"),
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect(mocks.upload).toHaveBeenCalledTimes(2);
});
it("requires write scope and an accessible event before contacting Drive", async () => {
  mocks.credentials.mockResolvedValueOnce({ account: { scope: "read-only" } });
  await expect(
    uploadEventDocument("event", input, file()),
  ).rejects.toMatchObject({ status: 403 });
  mocks.event.mockResolvedValueOnce(null);
  await expect(
    uploadEventDocument("other-event", input, file()),
  ).rejects.toMatchObject({ status: 404 });
  expect(mocks.client).not.toHaveBeenCalled();
});
it.each(["MEDIA", "PERMISSIONS"])(
  "uses the mapped %s folder instead of an invoice folder",
  async (purpose) => {
    mocks.mappings.mockResolvedValue([
      {
        purpose: "ROOT",
        driveItem: {
          id: "root-item",
          externalId: "event-root",
          connectionId: "connection",
          trashed: false,
        },
      },
      {
        purpose,
        driveItem: {
          id: "target-item",
          externalId: "target-folder",
          connectionId: "connection",
          trashed: false,
        },
      },
    ]);
    mocks.folderPath.mockResolvedValue({
      breadcrumbs: [
        { id: "events-root", name: "Veranstaltungen" },
        { id: "event-root", name: "YUNG Chapter Four" },
        { id: "target-folder", name: purpose },
      ],
    });
    await uploadEventDocument(
      "event",
      { ...input, purpose },
      purpose === "MEDIA"
        ? new File(["example-video"], "clip.mp4", { type: "video/mp4" })
        : file(),
    );
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: "target-folder" }),
    );
  },
);
it("refuses missing, outside-root or foreign-event mappings without uploading", async () => {
  mocks.mappings.mockResolvedValueOnce([]);
  await expect(
    uploadEventDocument("event", input, file()),
  ).rejects.toMatchObject({ status: 400 });
  mocks.folderPath.mockResolvedValueOnce({
    breadcrumbs: [{ id: "foreign-root", name: "Other" }],
  });
  await expect(
    uploadEventDocument("event", input, file()),
  ).rejects.toMatchObject({ status: 409 });
  mocks.conflict.mockResolvedValueOnce({ eventId: "other" });
  await expect(
    uploadEventDocument("event", input, file()),
  ).rejects.toMatchObject({ status: 409 });
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("rejects oversized or invalid PDF files before obtaining Google credentials", async () => {
  await expect(
    uploadEventDocument("event", input, new File(["not a PDF"], "wrong.pdf")),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    uploadEventDocument(
      "event",
      input,
      new File([new Uint8Array(20_000_001)], "big.pdf"),
    ),
  ).rejects.toMatchObject({ status: 400 });
  expect(mocks.credentials).not.toHaveBeenCalled();
});
