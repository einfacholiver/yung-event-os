import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
const base = new URL(process.env.AUTH_TEST_URL ?? "http://localhost:3000");
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname),
  "Only run against a local server.",
);
assert(process.env.DATABASE_URL, "DATABASE_URL required");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const fetchLocal = (path: string, options: RequestInit = {}) =>
  fetch(new URL(path, base), { ...options, redirect: "manual" });
const assertBlockedPage = async (path: string, headers?: HeadersInit) => {
  const response = await fetchLocal(path, { headers });
  assert.equal(response.status, 307, path);
  assert.equal(
    new URL(response.headers.get("location")!, base).pathname,
    "/login",
  );
};

let sessionToken: string | undefined;
try {
  for (const path of [
    "/",
    "/events",
    "/events/private/finances",
    "/documents",
    "/finances",
    "/settings/integrations/google-drive",
    "/events/private.png",
  ])
    await assertBlockedPage(path);
  await assertBlockedPage("/events", {
    "x-middleware-subrequest": "proxy:proxy:proxy:proxy:proxy",
  });
  await assertBlockedPage("/events?_rsc=security-test", { RSC: "1" });
  await assertBlockedPage("/events", {
    cookie: "authjs.session-token=forged-session",
  });
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
    const response = await fetchLocal("/api/finances/transactions", {
      method,
      headers: { origin: base.origin },
    });
    assert.equal(response.status, 401, method);
    assert.match(
      response.headers.get("content-type") ?? "",
      /application\/json/,
    );
  }
  const login = await fetchLocal("/login");
  assert.equal(login.status, 200);
  assert.match(await login.text(), /Mit Google anmelden/);

  // Temporary server-side session for the existing verified admin. No identity,
  // business record or Drive mapping is created or changed; token is never logged.
  const admin = await db.user.findUnique({
    where: { email: "lightsignal.dj@gmail.com" },
    include: { accounts: true, organization: true },
  });
  assert(
    admin?.organization?.slug === "yung" &&
      admin.accounts.some((account) => account.provider === "google"),
    "Existing Google admin required",
  );
  sessionToken = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      userId: admin.id,
      sessionToken,
      expires: new Date(Date.now() + 5 * 60_000),
    },
  });
  const cookie = `authjs.session-token=${sessionToken}`;
  const allowed = await fetchLocal("/events", { headers: { cookie } });
  assert.equal(allowed.status, 200);
  assert.match(await allowed.text(), /Chapter Four/);
  const api = await fetchLocal("/api/finances/transactions", {
    headers: { cookie },
  });
  assert.equal(
    api.status,
    405,
    "Authenticated request passes the gate, GET is unsupported here",
  );
  await db.session.delete({ where: { sessionToken } });
  await assertBlockedPage("/events", { cookie });
  sessionToken = undefined;
  console.log(
    "Auth smoke passed: anonymous, forged/revoked sessions, RSC and direct API access blocked; existing admin allowed.",
  );
} finally {
  if (sessionToken) await db.session.deleteMany({ where: { sessionToken } });
  await db.$disconnect();
}
