import { config } from "dotenv";
import { Client } from "pg";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { resolve, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import * as tls from "node:tls";

class SafeError extends Error {}
async function fileHash(file) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest("hex");
}

const root = fileURLToPath(new URL("../", import.meta.url));
const backups = join(root, "backups");
const local = {};
config({
  path: [join(root, ".env.local"), join(root, ".env")],
  processEnv: local,
  quiet: true,
});
const quote = (value) => '"' + value.replaceAll('"', '""') + '"';

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
  // Provider errors may contain credentials; never forward raw stderr.
  child.stderr.resume();
  const done = new Promise((resolveDone, reject) => {
    child.on("error", () =>
      reject(new SafeError(`${basename(command)} could not start.`)),
    );
    child.on("exit", (code) =>
      code === 0
        ? resolveDone()
        : reject(
            new SafeError(
              `${basename(command)} failed (exit ${code}). No credentials were logged.`,
            ),
          ),
    );
  });
  return { child, done };
}

async function counts(client) {
  const tables = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  const result = {};
  for (const { tablename } of tables.rows) {
    if (["Session", "_prisma_migrations"].includes(tablename)) continue;
    const count = await client.query(
      `SELECT count(*)::text AS count FROM public.${quote(tablename)}`,
    );
    result[tablename] = count.rows[0].count;
  }
  return result;
}

async function exportDatabase() {
  const url = new URL(local.DATABASE_URL);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new SafeError("Export requires the local source database.");
  await mkdir(backups, { recursive: true });
  const file = join(
    backups,
    `yung-${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}.dump`,
  );
  const source = new Client({ connectionString: local.DATABASE_URL });
  try {
    await source.connect();
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snapshot = await source.query("SELECT pg_export_snapshot() AS id");
    const rowCounts = await counts(source);
    const { child, done } = run("docker", [
      "compose",
      "exec",
      "-T",
      "postgres",
      "pg_dump",
      "--data-only",
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      '--exclude-table-data=public."Session"',
      '--exclude-table-data=public."_prisma_migrations"',
      `--snapshot=${snapshot.rows[0].id}`,
      "--username",
      decodeURIComponent(url.username),
      "--dbname",
      decodeURIComponent(url.pathname.slice(1)),
    ]);
    child.stdin.end();
    await Promise.all([
      pipeline(
        child.stdout,
        createWriteStream(file, { flags: "wx", mode: 0o600 }),
      ),
      done,
    ]);
    const hash = await fileHash(file);
    await writeFile(
      file + ".json",
      JSON.stringify(
        {
          version: 1,
          createdAt: new Date().toISOString(),
          sha256: hash,
          rowCounts,
        },
        null,
        2,
      ),
      { flag: "wx", mode: 0o600 },
    );
    console.log(
      `Private backup created: backups/${basename(file)}. Sessions were excluded; business data and Drive mappings were preserved.`,
    );
  } catch (error) {
    await unlink(file).catch(() => {});
    throw error;
  } finally {
    await source.query("ROLLBACK").catch(() => {});
    await source.end().catch(() => {});
  }
}

async function importDatabase(argument) {
  if (!argument)
    throw new SafeError("Specify the exported backups/FILE.dump path.");
  const file = resolve(root, argument);
  if (
    !file.startsWith(backups + (process.platform === "win32" ? "\\" : "/")) ||
    !file.endsWith(".dump")
  )
    throw new SafeError(
      "Import requires a dump inside this project's backups directory.",
    );
  const cloud = {};
  config({ path: join(root, ".env.cloud"), processEnv: cloud, quiet: true });
  const url = new URL(cloud.DIRECT_DATABASE_URL);
  if (
    !url.hostname.endsWith(".neon.tech") ||
    url.hostname.includes("-pooler.") ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["require", "verify-full"].includes(url.searchParams.get("sslmode"))
  )
    throw new SafeError(
      "Use the Neon direct connection with TLS in .env.cloud.",
    );
  const password = decodeURIComponent(url.password);
  if (!password || /[\r\n]/.test(password))
    throw new SafeError("Invalid target credential format.");
  const manifest = JSON.parse(await readFile(file + ".json", "utf8"));
  if (manifest.version !== 1 || (await fileHash(file)) !== manifest.sha256)
    throw new SafeError("Backup checksum does not match its export manifest.");
  const target = new Client({ connectionString: cloud.DIRECT_DATABASE_URL });
  const certificateFile = `/tmp/yung-neon-ca-${randomBytes(8).toString("hex")}.pem`;
  let certificateWritten = false;
  try {
    await target.connect();
    if (Object.values(await counts(target)).some((count) => count !== "0"))
      throw new SafeError(
        "Target contains existing records. Import stopped without changing them. Use an empty Neon database.",
      );
    const migration = run(
      process.execPath,
      [join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"],
      {
        env: {
          ...process.env,
          DATABASE_URL: cloud.DATABASE_URL,
          DIRECT_DATABASE_URL: cloud.DIRECT_DATABASE_URL,
        },
      },
    );
    migration.child.stdin.end();
    migration.child.stdout.resume();
    await migration.done;
    // Alpine's CA bundle can lag behind Node's trusted roots. Use the same
    // trusted certificate authorities as the verified Node connection above.
    const certificates =
      typeof tls.getCACertificates === "function"
        ? tls.getCACertificates("default")
        : tls.rootCertificates;
    const certificateWriter = run("docker", [
      "compose",
      "exec",
      "-T",
      "postgres",
      "sh",
      "-c",
      'umask 077; cat > "$1"',
      "sh",
      certificateFile,
    ]);
    certificateWriter.child.stdout.resume();
    certificateWriter.child.stdin.end(certificates.join("\n") + "\n");
    await certificateWriter.done;
    certificateWritten = true;
    const restore = run("docker", [
      "compose",
      "exec",
      "-T",
      "-e",
      "PGSSLMODE=verify-full",
      "-e",
      `PGSSLROOTCERT=${certificateFile}`,
      "postgres",
      "sh",
      "-c",
      'IFS= read -r PGPASSWORD; export PGPASSWORD; exec pg_restore --host="$1" --port="$2" --username="$3" --dbname="$4" --data-only --no-owner --no-privileges --single-transaction --exit-on-error',
      "sh",
      url.hostname,
      url.port || "5432",
      decodeURIComponent(url.username),
      decodeURIComponent(url.pathname.slice(1)),
    ]);
    restore.child.stdout.resume();
    restore.child.stdin.write(password + "\n");
    await Promise.all([
      pipeline(createReadStream(file), restore.child.stdin),
      restore.done,
    ]);
    const restored = await counts(target);
    if (JSON.stringify(restored) !== JSON.stringify(manifest.rowCounts))
      throw new SafeError(
        "Restore completed but row counts differ. Keep the backup and investigate before deployment.",
      );
    console.log(
      "Neon import completed and row counts verified. Existing local data is unchanged; no browser sessions were transferred.",
    );
  } finally {
    if (certificateWritten) {
      const cleanup = run("docker", [
        "compose",
        "exec",
        "-T",
        "postgres",
        "rm",
        "-f",
        certificateFile,
      ]);
      cleanup.child.stdin.end();
      cleanup.child.stdout.resume();
      await cleanup.done.catch(() => {});
    }
    await target.end().catch(() => {});
  }
}

try {
  if (process.argv[2] === "export") await exportDatabase();
  else if (process.argv[2] === "import") await importDatabase(process.argv[3]);
  else throw new SafeError("Use export or import backups/FILE.dump.");
} catch (error) {
  // Never print PostgreSQL errors containing a URL, token or password.
  console.error(
    error instanceof SafeError
      ? error.message
      : "Database operation failed. Check local Docker/PostgreSQL and the private connection settings. No credentials were logged.",
  );
  process.exitCode = 1;
}
