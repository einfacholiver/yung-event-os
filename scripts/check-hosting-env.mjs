import { z } from "zod";
const httpsOrigin = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  );
});
const database = z.url().refine((value) => {
  const url = new URL(value);
  return (
    ["postgres:", "postgresql:"].includes(url.protocol) &&
    !["localhost", "127.0.0.1"].includes(url.hostname) &&
    ["require", "verify-full"].includes(url.searchParams.get("sslmode"))
  );
});
const schema = z
  .object({
    DATABASE_URL: database,
    DIRECT_DATABASE_URL: database,
    AUTH_URL: httpsOrigin,
    APP_URL: httpsOrigin,
    AUTH_SECRET: z.string().min(32),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
  })
  .refine(
    (env) => new URL(env.AUTH_URL).origin === new URL(env.APP_URL).origin,
    { path: ["APP_URL"], message: "Must match AUTH_URL" },
  );
const result = schema.safeParse(process.env);
if (!result.success) {
  console.error(
    "Hosting configuration invalid. Check these variable names (values are deliberately not logged):",
    [...new Set(result.error.issues.map((issue) => issue.path.join(".")))].join(
      ", ",
    ),
  );
  process.exitCode = 1;
} else
  console.log(
    "Hosting configuration passed: HTTPS origin and TLS database URLs configured.",
  );
