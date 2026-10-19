// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  credentials: vi.fn(),
  client: vi.fn(),
  eventTarget: vi.fn(),
  generate: vi.fn(),
  upload: vi.fn(),
  browse: vi.fn(),
  folderPath: vi.fn(),
  pdf: vi.fn(),
  counter: vi.fn(),
  invoice: vi.fn(),
  item: vi.fn(),
  invoiceUpdate: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/modules/drive/server/context", () => ({
  requireDriveUser: mocks.user,
}));
vi.mock("@/modules/drive/server/token", () => ({
  getDriveCredentials: mocks.credentials,
}));
vi.mock("@/modules/drive/server/google-client", () => ({
  verifiedDriveClient: mocks.client,
}));
vi.mock("@/modules/documents/server/upload", () => ({
  resolveUploadTarget: mocks.eventTarget,
}));
vi.mock("./pdf", () => ({ renderInvoice: mocks.pdf }));
type Stored = Record<string, unknown> & {
  id: string;
  payload: unknown;
  uploadedAt: Date | null;
};
let saved: Stored | null = null;
const db = {
  invoiceDocument: {
    findUnique: async () => saved,
    findFirst: async () => saved,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      saved = { ...data, id: "doc", payload: data.payload, uploadedAt: null };
      return { id: "doc" };
    },
    update: async ({ data }: { data: { uploadedAt: Date } }) => {
      Object.assign(saved!, data);
    },
  },
  invoiceCounter: { findUnique: async () => null, upsert: mocks.counter },
  driveFolderMapping: { findMany: async () => [] },
  invoice: {
    findMany: async () => [],
    create: mocks.invoice,
    update: mocks.invoiceUpdate,
  },
  driveItem: { upsert: mocks.item },
  activityLog: { create: mocks.audit },
  $queryRaw: async () => [],
  $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(db),
};
vi.mock("@/server/db/client", () => ({ getDb: () => db }));
import { createInvoiceDocument, uploadInvoiceDocument } from "./server";
import { berlinDate, DJ_FOLDER_2026 } from "./schema";
const input = () => ({
  requestId: "40ebba4a-2db6-4c89-bca0-85cf257869f1",
  recipient: "Testfirma\nTeststraße 1\n84332 Ort",
  title: "DJ-Tätigkeit",
  serviceDate: "2026-09-12",
  payment: "TRANSFER_OPEN",
  paidAt: "",
  dueDays: 14,
  destination: "DJ_2026",
  eventId: "",
  confirmed: true,
  items: [{ description: "DJ-Gage", quantity: 2, unitPrice: "250.00" }],
});
beforeEach(() => {
  vi.resetAllMocks();
  saved = null;
  mocks.user.mockResolvedValue({ organizationId: "org", userId: "admin" });
  mocks.credentials.mockResolvedValue({
    organizationId: "org",
    userId: "admin",
    connection: { id: "drive" },
    account: {
      scope: "https://www.googleapis.com/auth/drive",
      providerAccountId: "google-subject",
    },
    token: "test-token",
  });
  mocks.client.mockResolvedValue({
    folderPath: mocks.folderPath,
    browse: mocks.browse,
    generateFileId: mocks.generate,
    uploadFile: mocks.upload,
  });
  mocks.folderPath.mockResolvedValue({
    folder: { mimeType: "application/vnd.google-apps.folder" },
  });
  mocks.browse.mockResolvedValue({
    files: [
      {
        name: `${berlinDate(new Date()).slice(0, 7)}-1007--old.pdf`,
        mimeType: "application/pdf",
      },
    ],
  });
  mocks.generate.mockResolvedValue("stable-drive-id");
  mocks.pdf.mockResolvedValue(new TextEncoder().encode("%PDF-test"));
  mocks.counter.mockImplementation(
    async ({ create }: { create: { lastSequence: number } }) => create,
  );
  mocks.invoice.mockResolvedValue({ id: "invoice", eventId: null });
  mocks.item.mockResolvedValue({ id: "cached-file" });
  mocks.upload.mockResolvedValue({
    id: "stable-drive-id",
    name: "invoice.pdf",
  });
});
it("continues existing monthly numbers and repeats the same issuance without another reservation or Drive request", async () => {
  const first = await createInvoiceDocument(input());
  const second = await createInvoiceDocument(input());
  expect(first).toEqual({ id: "doc" });
  expect(second).toEqual(first);
  expect(saved!.number).toBe(`${berlinDate(new Date()).slice(0, 7)}-1008`);
  expect(mocks.counter).toHaveBeenCalledOnce();
  expect(mocks.generate).toHaveBeenCalledOnce();
  await expect(
    createInvoiceDocument({
      ...input(),
      sender: {
        ...(saved!.payload as { sender: object }).sender,
        street: "Andere Straße 1",
      },
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(mocks.client).toHaveBeenCalledWith("test-token", "google-subject");
  expect(mocks.invoice).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        direction: "OUTGOING",
        totalAmount: "500.00",
        status: "OPEN",
      }),
    }),
  );
  await expect(
    createInvoiceDocument({ ...input(), recipient: "Changed recipient" }),
  ).rejects.toMatchObject({ status: 409 });
});
it("retries a failed upload with the same PDF and external ID, then short-circuits a completed delivery", async () => {
  await createInvoiceDocument(input());
  mocks.upload.mockRejectedValueOnce(new Error("network down"));
  await expect(uploadInvoiceDocument("doc")).rejects.toThrow("network down");
  expect(saved!.uploadedAt).toBeNull();
  await uploadInvoiceDocument("doc");
  expect(mocks.upload.mock.calls[0][0]).toEqual(mocks.upload.mock.calls[1][0]);
  expect(mocks.upload.mock.calls[1][0]).toMatchObject({
    id: "stable-drive-id",
    parentId: DJ_FOLDER_2026,
  });
  expect(saved!.uploadedAt).toBeInstanceOf(Date);
  await uploadInvoiceDocument("doc");
  expect(mocks.upload).toHaveBeenCalledTimes(2);
  expect(mocks.counter).toHaveBeenCalledOnce();
});
it("does not allocate a number when identity verification fails", async () => {
  mocks.client.mockRejectedValue(new Error("identity rejected"));
  await expect(createInvoiceDocument(input())).rejects.toThrow(
    "identity rejected",
  );
  expect(mocks.counter).not.toHaveBeenCalled();
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("refuses delivery when an event's mapped destination has changed", async () => {
  const context = await mocks.credentials();
  const client = await mocks.client();
  mocks.eventTarget.mockResolvedValue({
    ...context,
    db,
    client,
    target: { externalId: "original-income" },
  });
  await createInvoiceDocument({
    ...input(),
    destination: "EVENT",
    eventId: "event",
  });
  mocks.eventTarget.mockResolvedValue({
    ...context,
    db,
    client,
    target: { externalId: "different-income" },
  });
  await expect(uploadInvoiceDocument("doc")).rejects.toMatchObject({
    status: 409,
  });
  expect(mocks.upload).not.toHaveBeenCalled();
});
