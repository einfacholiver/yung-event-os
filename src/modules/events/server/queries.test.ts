// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const { findMany, findFirst } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
}));
const { requireAdmin } = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("@/server/auth/access", () => ({ requireAdmin }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/db/client", () => ({
  getDb: () => ({ event: { findMany, findFirst } }),
}));
import { getEvent, getEvents } from "./queries";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ organizationId: "org" });
});
it("scopes the list to YUNG rather than listing other organizations", async () => {
  findMany.mockResolvedValue([]);
  expect(await getEvents()).toEqual([]);
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { organizationId: "org" } }),
  );
});
it("scopes individual id lookups and preserves missing results", async () => {
  findFirst.mockResolvedValue(null);
  expect(await getEvent("foreign-event")).toBeNull();
  expect(findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: "foreign-event", organizationId: "org" },
    }),
  );
});
it("never queries events without authorization", async () => {
  requireAdmin.mockRejectedValue(new Error("SIGN_IN"));
  await expect(getEvents()).rejects.toThrow("SIGN_IN");
  await expect(getEvent("known-event")).rejects.toThrow("SIGN_IN");
  expect(findMany).not.toHaveBeenCalled();
  expect(findFirst).not.toHaveBeenCalled();
});
it("does not replace database failures with fabricated or empty data", async () => {
  findMany.mockRejectedValue(new Error("database unavailable"));
  await expect(getEvents()).rejects.toThrow("database unavailable");
});
