// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  find: vi.fn(),
  remove: vi.fn(),
  log: vi.fn(),
  dbTransaction: vi.fn(),
}));
vi.mock("@/modules/drive/server/context", () => ({
  requireDriveUser: mocks.user,
}));
vi.mock("@/server/db/client", () => ({
  getDb: () => ({ $transaction: mocks.dbTransaction }),
}));
import { DELETE } from "./route";
import { DriveError } from "@/modules/drive/errors";
const context = { params: Promise.resolve({ id: "booking" }) };
function request(origin = "http://localhost:3000") {
  return new Request(
    "http://localhost:3000/api/finances/transactions/booking",
    { method: "DELETE", headers: { origin } },
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ userId: "oliver", organizationId: "yung" });
  mocks.dbTransaction.mockImplementation(async (callback) =>
    callback({
      transaction: { findFirst: mocks.find, deleteMany: mocks.remove },
      activityLog: { create: mocks.log },
    }),
  );
  mocks.find.mockResolvedValue({
    id: "booking",
    eventId: "chapter-four",
    invoiceId: null,
    direction: "EXPENSE",
    amount: { toString: () => "100.00" },
    currency: "EUR",
    bookedAt: new Date("2026-09-19"),
    description: "Technik",
    reference: null,
    isPaid: true,
    paidBy: "Daniel",
  });
  mocks.remove.mockResolvedValue({ count: 1 });
});
it("deletes only a booking in the authenticated organization and records its previous values", async () => {
  expect((await DELETE(request(), context)).status).toBe(200);
  const where = { id: "booking", organizationId: "yung", currency: "EUR" };
  expect(mocks.find).toHaveBeenCalledWith({ where });
  expect(mocks.remove).toHaveBeenCalledWith({ where });
  expect(mocks.log).toHaveBeenCalledWith({
    data: expect.objectContaining({
      actorId: "oliver",
      action: "TRANSACTION_DELETED",
      entityId: "booking",
      metadata: expect.objectContaining({ amount: "100.00", paidBy: "Daniel" }),
    }),
  });
});
it("does not delete or log a missing or inaccessible booking", async () => {
  mocks.find.mockResolvedValue(null);
  expect((await DELETE(request(), context)).status).toBe(404);
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.log).not.toHaveBeenCalled();
});
it("rejects cross-origin requests and unauthenticated users", async () => {
  expect((await DELETE(request("https://other.example"), context)).status).toBe(
    403,
  );
  expect(mocks.user).not.toHaveBeenCalled();
  mocks.user.mockRejectedValue(new DriveError("SIGN_IN", 401));
  expect((await DELETE(request(), context)).status).toBe(401);
  expect(mocks.dbTransaction).not.toHaveBeenCalled();
});
