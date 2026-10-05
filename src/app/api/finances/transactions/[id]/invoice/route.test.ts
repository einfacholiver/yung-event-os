// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  user: vi.fn(),
  documents: vi.fn(),
  find: vi.fn(),
  invoiceFind: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  log: vi.fn(),
  lock: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/modules/drive/server/context", () => ({ requireDriveUser: m.user }));
vi.mock("@/modules/documents/server/queries", () => ({
  getDocuments: m.documents,
}));
vi.mock("@/server/db/client", () => ({
  getDb: () => ({
    transaction: { findFirst: m.find },
    $transaction: m.transaction,
  }),
}));
import { PATCH } from "./route";
import { DriveError } from "@/modules/drive/errors";
const context = { params: Promise.resolve({ id: "booking" }) };
function request(file = "file", origin = "http://localhost:3000") {
  const body = new FormData();
  body.set("driveItemId", file);
  return new Request(
    "http://localhost:3000/api/finances/transactions/booking/invoice",
    { method: "PATCH", headers: { origin }, body },
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  m.user.mockResolvedValue({ userId: "admin", organizationId: "org" });
  m.find.mockResolvedValue({
    id: "booking",
    eventId: "four",
    direction: "EXPENSE",
    amount: "100.00",
    currency: "EUR",
    invoiceId: null,
  });
  m.documents.mockResolvedValue({
    documents: [{ id: "file", category: "EXPENSES", name: "Technik.pdf" }],
  });
  m.create.mockResolvedValue({ id: "invoice" });
  m.transaction.mockImplementation((callback) =>
    callback({
      $queryRaw: m.lock,
      transaction: { findFirst: m.find, update: m.update },
      invoice: { findFirst: m.invoiceFind, create: m.create },
      activityLog: { create: m.log },
    }),
  );
});
it("links an event expense document without adding a financial transaction", async () => {
  expect((await PATCH(request(), context)).status).toBe(200);
  expect(m.documents).toHaveBeenCalledWith("four");
  expect(m.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      organizationId: "org",
      eventId: "four",
      driveItemId: "file",
      direction: "INCOMING",
      totalAmount: "100.00",
    }),
  });
  expect(m.update).toHaveBeenCalledWith({
    where: { id: "booking" },
    data: { invoiceId: "invoice" },
  });
});
it("reuses an existing invoice and can remove a link without deleting the invoice or Drive file", async () => {
  m.invoiceFind.mockResolvedValue({ id: "existing" });
  expect((await PATCH(request(), context)).status).toBe(200);
  expect(m.create).not.toHaveBeenCalled();
  expect(m.update).toHaveBeenLastCalledWith({
    where: { id: "booking" },
    data: { invoiceId: "existing" },
  });
  expect((await PATCH(request(""), context)).status).toBe(200);
  expect(m.update).toHaveBeenLastCalledWith({
    where: { id: "booking" },
    data: { invoiceId: null },
  });
});
it("rejects inaccessible or wrong-category files before writing", async () => {
  m.documents.mockResolvedValue({
    documents: [{ id: "file", category: "INCOME" }],
  });
  expect((await PATCH(request(), context)).status).toBe(403);
  expect(m.transaction).not.toHaveBeenCalled();
  m.documents.mockResolvedValue({ documents: [] });
  expect((await PATCH(request(), context)).status).toBe(403);
});
it("blocks cross-origin and anonymous requests before reading or writing data", async () => {
  expect(
    (await PATCH(request("file", "https://evil.test"), context)).status,
  ).toBe(403);
  expect(m.user).not.toHaveBeenCalled();
  m.user.mockRejectedValue(new DriveError("SIGN_IN", 401));
  expect((await PATCH(request(), context)).status).toBe(401);
  expect(m.find).not.toHaveBeenCalled();
});
it("rejects missing bookings and concurrent changes", async () => {
  m.find.mockResolvedValueOnce(null);
  expect((await PATCH(request(), context)).status).toBe(404);
  m.find
    .mockResolvedValueOnce({ eventId: "four", direction: "EXPENSE" })
    .mockResolvedValueOnce({ eventId: "other", direction: "EXPENSE" });
  expect((await PATCH(request(), context)).status).toBe(403);
  expect(m.update).not.toHaveBeenCalled();
});
