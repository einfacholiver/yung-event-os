// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ user: vi.fn(), upload: vi.fn() }));
vi.mock("@/modules/drive/server/context", () => ({
  requireDriveUser: mocks.user,
}));
vi.mock("@/modules/documents/server/upload", () => ({
  uploadEventDocument: mocks.upload,
}));
import { POST } from "./route";
import { DriveError } from "@/modules/drive/errors";
const context = { params: Promise.resolve({ id: "event" }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ organizationId: "org" });
  mocks.upload.mockResolvedValue({ name: "invoice.pdf" });
});
function request(origin = "http://localhost:3000") {
  const body = new FormData();
  body.set(
    "file",
    new File(["%PDF-test"], "invoice.pdf", { type: "application/pdf" }),
  );
  body.set("purpose", "INCOME");
  body.set("requestId", "853d063a-1d99-4889-9d31-7e3f1ab3a960");
  return new Request("http://localhost:3000/api/events/event/documents", {
    method: "POST",
    headers: { origin },
    body,
  });
}
it("passes the event, category and original file to the upload service", async () => {
  expect((await POST(request(), context)).status).toBe(200);
  expect(mocks.upload).toHaveBeenCalledWith(
    "event",
    { purpose: "INCOME", requestId: "853d063a-1d99-4889-9d31-7e3f1ab3a960" },
    expect.objectContaining({ name: "invoice.pdf", type: "application/pdf" }),
  );
});
it("rejects foreign origins and missing login before uploading", async () => {
  expect((await POST(request("https://other.example"), context)).status).toBe(
    403,
  );
  expect(mocks.user).not.toHaveBeenCalled();
  mocks.user.mockRejectedValueOnce(new DriveError("SIGN_IN", 401));
  expect((await POST(request(), context)).status).toBe(401);
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("rejects oversized requests before reading file content", async () => {
  const req = request();
  req.headers.set("content-length", "100100000");
  expect((await POST(req, context)).status).toBe(413);
  expect(mocks.upload).not.toHaveBeenCalled();
});
