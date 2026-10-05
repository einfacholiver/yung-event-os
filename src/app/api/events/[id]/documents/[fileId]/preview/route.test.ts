// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  documents: vi.fn(),
  credentials: vi.fn(),
  client: vi.fn(),
  pdf: vi.fn(),
}));
vi.mock("@/modules/documents/server/queries", () => ({
  getDocuments: mocks.documents,
}));
vi.mock("@/modules/drive/server/token", () => ({
  getDriveCredentials: mocks.credentials,
}));
vi.mock("@/modules/drive/server/google-client", () => ({
  verifiedDriveClient: mocks.client,
}));
import { GET } from "./route";
import { DRIVE_CONTENT_SCOPE } from "@/modules/drive/config";
const context = { params: Promise.resolve({ id: "event", fileId: "invoice" }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.documents.mockResolvedValue({
    documents: [
      { id: "invoice", externalId: "google-file", mimeType: "application/pdf" },
    ],
  });
  mocks.credentials.mockResolvedValue({
    account: { scope: DRIVE_CONTENT_SCOPE, providerAccountId: "subject" },
    token: "private-token",
  });
  mocks.client.mockResolvedValue({ pdf: mocks.pdf });
  mocks.pdf.mockResolvedValue({
    bytes: new TextEncoder().encode("%PDF-1.7"),
    type: "application/pdf",
  });
});
it("rejects files outside the event before contacting Google", async () => {
  mocks.documents.mockResolvedValue({ documents: [] });
  const response = await GET(new Request("http://localhost/preview"), context);
  expect(response.status).toBe(404);
  expect(mocks.documents).toHaveBeenCalledWith("event");
  expect(mocks.client).not.toHaveBeenCalled();
});
it("requires content scope before contacting Drive", async () => {
  mocks.credentials.mockResolvedValue({ account: { scope: "metadata-only" } });
  expect(
    (await GET(new Request("http://localhost/preview"), context)).status,
  ).toBe(403);
  expect(mocks.client).not.toHaveBeenCalled();
});
it("returns private inline PDF bytes without exposing credentials", async () => {
  const response = await GET(new Request("http://localhost/preview"), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/pdf");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("content-disposition")).toBe("inline");
  expect(await response.text()).toBe("%PDF-1.7");
  expect(mocks.client).toHaveBeenCalledWith("private-token", "subject");
  expect(mocks.pdf).toHaveBeenCalledWith("google-file");
});
