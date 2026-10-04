// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  user: vi.fn(),
  connection: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/db/client", () => ({
  getDb: () => ({
    user: { findUnique: mocks.user },
    driveConnection: { findUnique: mocks.connection },
  }),
}));
import { getDriveConnection } from "./context";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "user" } });
  mocks.user.mockResolvedValue({
    id: "user",
    email: "lightsignal.dj@gmail.com",
    organizationId: "org",
    organization: { slug: "yung" },
  });
});
it("rejects unauthenticated access before database queries", async () => {
  mocks.auth.mockResolvedValue(null);
  await expect(getDriveConnection()).rejects.toMatchObject({
    code: "SIGN_IN",
    status: 401,
  });
  expect(mocks.user).not.toHaveBeenCalled();
});
it("rejects a different account before querying connections", async () => {
  mocks.user.mockResolvedValue({
    id: "user",
    email: "other@example.com",
    organizationId: "org",
    organization: { slug: "yung" },
  });
  await expect(getDriveConnection()).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(mocks.connection).not.toHaveBeenCalled();
});
it("rejects tokens belonging to another user", async () => {
  mocks.connection.mockResolvedValue({
    status: "CONNECTED",
    googleAccount: { userId: "someone-else", provider: "google" },
  });
  await expect(getDriveConnection()).rejects.toMatchObject({
    code: "RECONNECT",
  });
});
