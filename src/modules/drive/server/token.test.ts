// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  update: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("./context", () => ({ getDriveConnection: mocks.context }));
vi.mock("@/server/db/client", () => ({
  getDb: () => ({ account: { updateMany: mocks.update } }),
}));
import { encryptToken, decryptToken } from "@/server/auth/token-cipher";
import { DRIVE_METADATA_SCOPE } from "../config";
import { getDriveCredentials } from "./token";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AUTH_SECRET", "test-secret-with-more-than-thirty-two-characters");
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost/test");
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.context.mockResolvedValue({
    account: {
      id: "account",
      scope: DRIVE_METADATA_SCOPE,
      access_token: encryptToken("old-access"),
      refresh_token: encryptToken("old-refresh"),
      expires_at: 1,
    },
    connection: { id: "connection" },
  });
  mocks.update.mockResolvedValue({ count: 1 });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("refreshes encrypted credentials and preserves refresh token when Google omits it", async () => {
  mocks.fetch.mockResolvedValue(
    Response.json({ access_token: "new-access", expires_in: 3600 }),
  );
  await expect(getDriveCredentials()).resolves.toMatchObject({
    token: "new-access",
  });
  const update = mocks.update.mock.calls[0][0];
  expect(decryptToken(update.data.access_token)).toBe("new-access");
  expect(update.data.refresh_token).toBeUndefined();
  expect(update.where.driveConnections).toEqual({
    some: { id: "connection", status: "CONNECTED" },
  });
  expect(mocks.fetch.mock.calls[0][1].body.get("refresh_token")).toBe(
    "old-refresh",
  );
});
it("requires reconnect after Google revokes the grant without writing tokens", async () => {
  mocks.fetch.mockResolvedValue(new Response("invalid_grant", { status: 400 }));
  await expect(getDriveCredentials()).rejects.toMatchObject({
    code: "RECONNECT",
  });
  expect(mocks.update).not.toHaveBeenCalled();
});
it("does not return refreshed credentials after a concurrent disconnect", async () => {
  mocks.fetch.mockResolvedValue(
    Response.json({ access_token: "new-access", expires_in: 3600 }),
  );
  mocks.update.mockResolvedValue({ count: 0 });
  await expect(getDriveCredentials()).rejects.toMatchObject({
    code: "RECONNECT",
  });
});
