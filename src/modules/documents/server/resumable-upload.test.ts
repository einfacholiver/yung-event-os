// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  target: vi.fn(),
  file: vi.fn(),
  begin: vi.fn(),
  part: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("./upload", () => ({ resolveUploadTarget: mocks.target }));
vi.mock("@/server/auth/access", () => ({
  requireAdmin: async () => ({ organizationId: "org", userId: "admin" }),
}));
vi.mock("@/server/auth/token-cipher", () => ({
  encryptToken: (s: string) => "encrypted:" + s,
  decryptToken: (s: string) => s.slice(10),
}));
let log: { id: string; metadata: unknown } | null;
const db = {
  activityLog: {
    findFirst: async () => log,
    findFirstOrThrow: async () => log,
    create: async ({ data }: { data: { metadata: unknown } }) =>
      (log = { id: "log", metadata: data.metadata }),
    update: async ({ data }: { data: { metadata: unknown } }) => {
      log!.metadata = data.metadata;
    },
  },
  driveItem: { upsert: mocks.upsert },
  $queryRaw: async () => [],
  $transaction: async <T>(cb: (tx: unknown) => Promise<T>) => cb(db),
};
vi.mock("@/server/db/client", () => ({ getDb: () => db }));
import { beginDocumentUpload, uploadDocumentChunk } from "./resumable-upload";
import { DriveError } from "@/modules/drive/errors";
const input = {
  purpose: "EXPENSES",
  requestId: "853d063a-1d99-4889-9d31-7e3f1ab3a960",
  name: "invoice.pdf",
  size: 8,
  sha256: "a".repeat(64),
  md5: "b".repeat(32),
};
const uploaded = {
  id: "file",
  name: input.name,
  mimeType: "application/pdf",
  parents: ["expenses"],
  md5Checksum: input.md5,
};
beforeEach(() => {
  vi.resetAllMocks();
  log = null;
  mocks.target.mockResolvedValue({
    db,
    organizationId: "org",
    userId: "admin",
    connection: { id: "connection" },
    target: { externalId: "expenses" },
    path: { breadcrumbs: [{ name: "Veranstaltungen" }, { name: "Ausgaben" }] },
    client: {
      file: mocks.file,
      beginResumable: mocks.begin,
      resumablePart: mocks.part,
      generateFileId: async () => "file",
    },
  });
  mocks.file.mockRejectedValue(new DriveError("NOT_FOUND", 404));
  mocks.begin.mockResolvedValue("private-session");
});
it("persists its session only on the server, resumes progress, and indexes exactly one completed file", async () => {
  const result = await beginDocumentUpload("event", input);
  expect(result).toMatchObject({ offset: 0, complete: false });
  expect(JSON.stringify(result)).not.toContain("private-session");
  expect(log!.metadata).toMatchObject({ session: "encrypted:private-session" });
  mocks.part.mockResolvedValueOnce({ offset: 0, complete: false });
  await beginDocumentUpload("event", input);
  expect(mocks.begin).toHaveBeenCalledOnce();
  mocks.part.mockResolvedValueOnce({ offset: 8, complete: true });
  mocks.file.mockResolvedValue(uploaded);
  expect(
    await uploadDocumentChunk(
      "event",
      input.requestId,
      0,
      new TextEncoder().encode("%PDF-abc"),
    ),
  ).toMatchObject({ complete: true });
  await beginDocumentUpload("event", input);
  expect(mocks.upsert).toHaveBeenCalledOnce();
});
it("recovers a lost final response without starting another Google upload", async () => {
  await beginDocumentUpload("event", input);
  mocks.file.mockResolvedValue(uploaded);
  expect(await beginDocumentUpload("event", input)).toMatchObject({
    complete: true,
    offset: 8,
  });
  expect(mocks.begin).toHaveBeenCalledOnce();
});
it("rejects changed contents, bad PDF signatures and unexpected offsets without uploading bytes", async () => {
  await beginDocumentUpload("event", input);
  await expect(
    beginDocumentUpload("event", { ...input, sha256: "c".repeat(64) }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    uploadDocumentChunk(
      "event",
      input.requestId,
      1,
      new TextEncoder().encode("%PDF-xx"),
    ),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    uploadDocumentChunk(
      "event",
      input.requestId,
      0,
      new TextEncoder().encode("not-pdf!"),
    ),
  ).rejects.toThrow(/PDF/);
  expect(mocks.part).not.toHaveBeenCalled();
});
