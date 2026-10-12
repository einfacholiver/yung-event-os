// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn() }));
vi.mock("@/server/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/db/client", () => ({
  getDb: () => ({ user: { findFirst: mocks.user } }),
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
  expect(mocks.user).toHaveBeenCalledWith({
    where: {
      id: "admin",
      email: "lightsignal.dj@gmail.com",
      organization: { slug: "yung" },
      accounts: {
        some: { provider: "google", providerAccountId: { not: "" } },
      },
    },
    select: { id: true, organizationId: true },
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
it.each(["removed", "foreign-user", "foreign-organization", "missing-google"])(
  "rejects an identity excluded by the persisted access filters: %s",
  async (id) => {
    mocks.auth.mockResolvedValue({ user: { id } });
    mocks.user.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
    expect(mocks.user.mock.calls[0][0].where.id).toBe(id);
  },
);
it("rejects a user without an organization", async () => {
  mocks.user.mockResolvedValue({ id: "admin", organizationId: null });
  await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
});
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
