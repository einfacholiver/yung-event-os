// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/access", () => ({
  AccessError: class extends Error {
    constructor(public status: number) {
      super("Access denied");
    }
  },
}));
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  begin: vi.fn(),
  chunk: vi.fn(),
}));
vi.mock("@/modules/drive/server/context", () => ({
  requireDriveUser: mocks.user,
}));
vi.mock("@/modules/documents/server/resumable-upload", () => ({
  beginDocumentUpload: mocks.begin,
  uploadDocumentChunk: mocks.chunk,
  CHUNK_SIZE: 2_097_152,
}));
import { POST, PUT } from "./route";
import { DriveError } from "@/modules/drive/errors";
const context = { params: Promise.resolve({ id: "event" }) };
function request(
  body: BodyInit,
  method = "POST",
  origin = "http://localhost:3000",
) {
  return new Request(
    "http://localhost:3000/api/events/event/documents/upload",
    {
      method,
      body,
      headers: { origin, "x-upload-id": "request", "x-upload-offset": "0" },
    },
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.begin.mockResolvedValue({ offset: 0 });
  mocks.chunk.mockResolvedValue({ complete: true });
});
it("rejects cross-origin and unauthenticated uploads before reading their body", async () => {
  expect(
    (await POST(request("{}", "POST", "https://other.example"), context))
      .status,
  ).toBe(403);
  expect(mocks.user).not.toHaveBeenCalled();
  mocks.user.mockRejectedValueOnce(new DriveError("SIGN_IN", 401));
  expect((await POST(request("{}"), context)).status).toBe(401);
  expect(mocks.begin).not.toHaveBeenCalled();
});
it("bounds streamed request bodies even when Content-Length is absent", async () => {
  expect((await POST(request("x".repeat(4097)), context)).status).toBe(413);
  expect(
    (await PUT(request(new Uint8Array(2_097_153), "PUT"), context)).status,
  ).toBe(413);
  expect(mocks.begin).not.toHaveBeenCalled();
  expect(mocks.chunk).not.toHaveBeenCalled();
});
it("forwards bytes and offset only after authentication, with a non-cacheable response", async () => {
  const response = await PUT(request("%PDF-test", "PUT"), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.chunk).toHaveBeenCalledWith(
    "event",
    "request",
    0,
    new TextEncoder().encode("%PDF-test"),
  );
});
