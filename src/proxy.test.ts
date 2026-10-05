// @vitest-environment node
import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
// Importing either module into Proxy breaks Netlify's Edge bundling.
vi.mock("@/server/auth", () => {
  throw new Error("Auth.js must not enter the Edge bundle");
});
vi.mock("@/server/db/client", () => {
  throw new Error("PostgreSQL must not enter the Edge bundle");
});
import { proxy } from "./proxy";
const request = (path: string, cookie?: string) =>
  new NextRequest("http://localhost:3000" + path, {
    headers: cookie ? { cookie } : undefined,
  });
it.each([
  "/",
  "/events",
  "/events/id/finances",
  "/documents",
  "/settings",
  "/events/private.png",
])("redirects requests without a session cookie: %s", (path) => {
  const response = proxy(request(path));
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it.each([
  "/api/events",
  "/api/events/id/tickets",
  "/api/finances/transactions",
  "/api/events/id/documents/file/preview",
  "/api/events/id/documents/upload",
  "/api/integrations/google-drive/browse",
])("rejects anonymous API calls before the Node handler: %s", (path) => {
  const response = proxy(request(path));
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it.each(["authjs.session-token", "__Secure-authjs.session-token"])(
  "delegates session validation to protected Node handlers: %s",
  (name) => {
    const response = proxy(request("/events", name + "=untrusted-cookie"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  },
);
it.each(["other-cookie=forged", "authjs.session-token="])(
  "does not accept unrelated or empty cookies: %s",
  (cookie) => {
    expect(proxy(request("/events", cookie)).status).toBe(307);
  },
);
it("keeps login infrastructure and branding accessible", () => {
  for (const path of [
    "/login",
    "/api/auth/callback/google",
    "/brand/yung-logo.png",
  ])
    expect(proxy(request(path)).headers.get("x-middleware-next")).toBe("1");
});
