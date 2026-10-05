import { expect, it } from "vitest";
import { isAdminIdentity, isPublicPath } from "./policy";
it("requires the verified exact admin email and a Google subject", () => {
  expect(
    isAdminIdentity({
      email: "lightsignal.dj@gmail.com",
      email_verified: true,
      sub: "google-sub",
    }),
  ).toBe(true);
  for (const profile of [
    null,
    {},
    { email: "lightsignal.dj@gmail.com", email_verified: false, sub: "s" },
    { email: "attacker@example.com", email_verified: true, sub: "s" },
    { email: "lightsignal.dj@gmail.com", email_verified: true, sub: "" },
  ])
    expect(isAdminIdentity(profile)).toBe(false);
});
it("allows only sign-in infrastructure and static brand assets", () => {
  for (const path of [
    "/login",
    "/api/auth/callback/google",
    "/_next/static/chunk.js",
    "/_next/image",
    "/brand/yung-logo.png",
    "/favicon.ico",
  ])
    expect(isPublicPath(path)).toBe(true);
  for (const path of [
    "/",
    "/events",
    "/api/events",
    "/api/events/private.pdf",
    "/events/private.png",
    "/api/auth-other",
    "/login/private",
    "/_next/data/build/events.json",
    "/brand/private.pdf",
  ])
    expect(isPublicPath(path)).toBe(false);
});
