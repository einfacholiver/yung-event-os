// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => ({ auth: (handler: unknown) => handler }));
const mocks = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("@/server/auth/access", () => ({
  verifyAdminSession: mocks.verify,
  AccessError: class extends Error {
    constructor(public status: number) {
      super("denied");
    }
  },
}));
import { AccessError } from "@/server/auth/access";
import { proxy } from "./proxy";
const run = proxy as unknown as (
  request: NextRequest & { auth: null },
) => Promise<Response>;
const request = (path: string) =>
  Object.assign(new NextRequest(`http://localhost:3000${path}`), {
    auth: null,
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.verify.mockRejectedValue(new AccessError(401));
});
it.each([
  "/",
  "/events",
  "/events/id/finances",
  "/documents",
  "/settings",
  "/events/private.png",
])(
  "redirects anonymous page requests without leaking data: %s",
  async (path) => {
    const response = await run(request(path));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
  },
);
it.each([
  "/api/events",
  "/api/events/id/tickets",
  "/api/finances/transactions",
  "/api/events/id/documents/file/preview",
  "/api/integrations/google-drive/browse",
])("rejects direct API access with JSON 401: %s", async (path) => {
  const response = await run(request(path));
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("rejects unauthorized identities with 403", async () => {
  mocks.verify.mockRejectedValue(new AccessError(403));
  expect((await run(request("/api/events"))).status).toBe(403);
});
it("fails closed on session/database outage", async () => {
  mocks.verify.mockRejectedValue(new Error("offline"));
  expect((await run(request("/events"))).status).toBe(503);
});
it("allows authenticated requests with no-store", async () => {
  mocks.verify.mockResolvedValue({ userId: "admin", organizationId: "org" });
  const response = await run(request("/events"));
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("keeps the login and callback routes accessible without data access", async () => {
  for (const path of [
    "/login",
    "/api/auth/callback/google",
    "/brand/yung-logo.png",
  ])
    expect((await run(request(path))).headers.get("x-middleware-next")).toBe(
      "1",
    );
  expect(mocks.verify).not.toHaveBeenCalled();
});
