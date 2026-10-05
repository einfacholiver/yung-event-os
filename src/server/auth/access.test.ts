// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn() }));
vi.mock("@/server/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/db/client", () => ({
  getDb: () => ({ user: { findUnique: mocks.user } }),
}));
import { requireAdmin } from "./access";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "admin" } });
  mocks.user.mockResolvedValue({
    id: "admin",
    email: "lightsignal.dj@gmail.com",
    organizationId: "org",
    organization: { slug: "yung" },
    accounts: [{ provider: "google", providerAccountId: "verified-subject" }],
  });
});
it("accepts only the persisted administrator linked to Google and YUNG", async () => {
  expect(await requireAdmin()).toEqual({
    userId: "admin",
    organizationId: "org",
  });
});
it.each([null, {}, { user: {} }])(
  "rejects missing or expired sessions before loading any user: %j",
  async (session) => {
    mocks.auth.mockResolvedValue(session);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
    expect(mocks.user).not.toHaveBeenCalled();
  },
);
it.each([
  null,
  {
    email: "someone@example.com",
    organizationId: "org",
    organization: { slug: "yung" },
    accounts: [],
  },
  {
    email: "lightsignal.dj@gmail.com",
    organizationId: "other",
    organization: { slug: "other" },
    accounts: [],
  },
  {
    email: "lightsignal.dj@gmail.com",
    organizationId: "org",
    organization: { slug: "yung" },
    accounts: [],
  },
])(
  "rejects removed users, foreign users/organizations and missing Google identities: %j",
  async (user) => {
    mocks.user.mockResolvedValue(user);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  },
);
it("does not authorize a forged email/role from the session", async () => {
  mocks.auth.mockResolvedValue({
    user: { id: "foreign", email: "lightsignal.dj@gmail.com", role: "ADMIN" },
  });
  mocks.user.mockResolvedValue(null);
  await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
});
it("fails closed on database errors", async () => {
  mocks.user.mockRejectedValue(new Error("offline"));
  await expect(requireAdmin()).rejects.toThrow("offline");
});
