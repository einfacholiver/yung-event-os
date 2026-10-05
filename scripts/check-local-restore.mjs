import { config } from "dotenv";
import { Client } from "pg";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { resolve, sep } from "node:path";

const local = {};
config({ path: [".env.local", ".env"], processEnv: local, quiet: true });
const original = new URL(local.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(original.hostname))
  throw new Error("Local database required");
const file = resolve(process.argv[2] ?? "");
if (!file.startsWith(resolve("backups") + sep) || !file.endsWith(".dump"))
  throw new Error("Use backups/FILE.dump");
const name = "yung_restore_check_" + Date.now();
const admin = new Client({ connectionString: original.href });
await admin.connect();
const target = new URL(original.href);
target.pathname = "/" + name;
let stage = "create temporary database";
function run(command, args, env = process.env) {
  const child = spawn(command, args, {
    env,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.resume();
  child.stdout.resume();
  const done = new Promise((ok, no) => {
    child.on("error", () => no(new Error("Process failed")));
    child.on("exit", (code) =>
      code === 0 ? ok() : no(new Error("Process failed")),
    );
  });
  return { child, done };
}
try {
  await admin.query("CREATE DATABASE " + name);
  stage = "apply migrations";
  const migration = run(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      ...process.env,
      DATABASE_URL: target.href,
      DIRECT_DATABASE_URL: target.href,
    },
  );
  migration.child.stdin.end();
  await migration.done;
  stage = "restore exported data";
  const restore = run("docker", [
    "compose",
    "exec",
    "-T",
    "postgres",
    "pg_restore",
    "--username",
    decodeURIComponent(original.username),
    "--dbname",
    name,
    "--data-only",
    "--single-transaction",
    "--exit-on-error",
    "--no-owner",
    "--no-privileges",
  ]);
  await Promise.all([
    pipeline(createReadStream(file), restore.child.stdin),
    restore.done,
  ]);
  stage = "verify row counts";
  const check = new Client({ connectionString: target.href });
  await check.connect();
  try {
    const manifest = JSON.parse(await readFile(file + ".json", "utf8"));
    for (const [table, count] of Object.entries(manifest.rowCounts)) {
      const result = await check.query(
        'SELECT count(*)::text AS count FROM public."' +
          table.replaceAll('"', '""') +
          '"',
      );
      if (result.rows[0].count !== count) throw new Error("Row count mismatch");
    }
    const session = await check.query(
      'SELECT count(*)::text AS count FROM public."Session"',
    );
    if (session.rows[0].count !== "0")
      throw new Error("Sessions were transferred");
    console.log(
      "Local restore verified: all business-table counts match, sessions excluded.",
    );
  } finally {
    await check.end();
  }
} catch {
  console.error(
    "Local restore verification failed at: " +
      stage +
      ". No credentials logged.",
  );
  process.exitCode = 1;
} finally {
  await admin.query("DROP DATABASE IF EXISTS " + name + " WITH (FORCE)");
  await admin.end();
}
