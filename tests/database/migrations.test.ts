// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    readFileSync(
      "prisma/migrations/20261004000000_auth_foundation/migration.sql",
      "utf8",
    ),
  );
  // Prove that an existing Auth.js user survives the additive migration.
  await db.exec(
    `INSERT INTO "User" (id, email) VALUES ('existing-user', 'existing@example.test');`,
  );
  await db.exec(
    readFileSync(
      "prisma/migrations/20261004010000_core_models/migration.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "prisma/migrations/20261004020000_drive_connection/migration.sql",
      "utf8",
    ),
  );
  for (const name of [
    "20261004030000_drive_mapping_categories",
    "20261004040000_ticket_orders",
    "20261005000000_transaction_payment",
    "20261005010000_ticket_sales_items",
  ]) {
    await db.exec(
      readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"),
    );
  }
  await db.exec(`
    INSERT INTO "Organization" (id, name, slug) VALUES ('org-a', 'A', 'a'), ('org-b', 'B', 'b');
    INSERT INTO "User" (id, email, "organizationId") VALUES ('user-a', 'a@example.test', 'org-a'), ('user-b', 'b@example.test', 'org-b');
    INSERT INTO "Event" (id, "organizationId", name, slug) VALUES ('event-a', 'org-a', 'A', 'a'), ('event-b', 'org-b', 'B', 'b');
    INSERT INTO "DriveConnection" (id, "organizationId", "accountEmail") VALUES ('drive-a', 'org-a', 'lightsignal.dj@gmail.com');
  `);
}, 30_000);

afterAll(async () => {
  await db?.close();
});

describe("core model SQL migration", () => {
  it("validates article totals and their organization assignment", async () => {
    await db.exec(
      `INSERT INTO "TicketSalesItem" (id,"organizationId","eventId",description,category,quantity,"unitPrice","grossRevenue",position,"updatedAt") VALUES ('sale','org-a','event-a','Regular','TICKET',251,20,5020,0,NOW())`,
    );
    await expect(
      db.exec(`UPDATE "TicketSalesItem" SET "grossRevenue"=1 WHERE id='sale'`),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.exec(
        `UPDATE "TicketSalesItem" SET "organizationId"='org-b' WHERE id='sale'`,
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });
  it("stores payer for paid entries and rejects a payer on an unpaid entry", async () => {
    await db.exec(
      `INSERT INTO "Transaction" (id, "organizationId", direction, amount, "bookedAt", "isPaid", "paidBy") VALUES ('paid-expense', 'org-a', 'EXPENSE', 10, NOW(), true, 'Oliver')`,
    );
    await expect(
      db.exec(
        `UPDATE "Transaction" SET "isPaid" = false WHERE id = 'paid-expense'`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await db.exec(
      `UPDATE "Transaction" SET "isPaid" = false, "paidBy" = NULL WHERE id = 'paid-expense'`,
    );
    await db.exec(`DELETE FROM "Transaction" WHERE id = 'paid-expense'`);
  });
  it("stores a root folder id and rejects an incomplete selection", async () => {
    await expect(
      db.exec(
        `UPDATE "DriveConnection" SET "rootFolderName" = 'Veranstaltungen' WHERE id = 'drive-a'`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await db.exec(
      `UPDATE "DriveConnection" SET "rootFolderId" = 'real-google-folder-id', "rootFolderName" = 'Veranstaltungen', "folderSelectedAt" = NOW() WHERE id = 'drive-a'`,
    );
    const result = await db.query<{ rootFolderId: string }>(
      `SELECT "rootFolderId" FROM "DriveConnection" WHERE id = 'drive-a'`,
    );
    expect(result.rows[0].rootFolderId).toBe("real-google-folder-id");
  });
  it("keeps existing auth users and backfills timestamps", async () => {
    const result = await db.query<{
      organizationId: string | null;
      createdAt: Date;
    }>(
      `SELECT "organizationId", "createdAt" FROM "User" WHERE id = 'existing-user'`,
    );
    expect(result.rows[0].organizationId).toBeNull();
    expect(result.rows[0].createdAt).toBeTruthy();
  });

  it("preserves core/auth tables and adds ticket orders", async () => {
    const result = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    expect(result.rows.map((row) => row.table_name).sort()).toEqual(
      [
        "Organization",
        "User",
        "Event",
        "DriveConnection",
        "DriveItem",
        "DriveFolderMapping",
        "Transaction",
        "Invoice",
        "Task",
        "Permission",
        "ActivityLog",
        "Account",
        "Session",
        "VerificationToken",
        "TicketOrder",
        "TicketSalesItem",
      ].sort(),
    );
  });

  it.each([
    `INSERT INTO "Task" (id, "organizationId", "eventId", title) VALUES ('bad-task-event', 'org-a', 'event-b', 'Wrong event')`,
    `INSERT INTO "Task" (id, "organizationId", "assigneeId", title) VALUES ('bad-task-user', 'org-a', 'user-b', 'Wrong user')`,
    `INSERT INTO "Permission" (id, "organizationId", "userId", resource, action) VALUES ('bad-permission', 'org-a', 'user-b', 'EVENT', 'READ')`,
    `INSERT INTO "DriveItem" (id, "organizationId", "connectionId", "externalId", name, "mimeType", kind) VALUES ('bad-drive', 'org-b', 'drive-a', 'remote', 'file', 'text/plain', 'FILE')`,
    `INSERT INTO "ActivityLog" (id, "organizationId", "actorId", action, "entityType") VALUES ('bad-log', 'org-a', 'user-b', 'created', 'Event')`,
  ])("rejects cross-organization relations: %s", async (sql) => {
    await expect(db.exec(sql)).rejects.toMatchObject({ code: "23503" });
  });

  it("rejects other Drive accounts", async () => {
    await expect(
      db.exec(
        `INSERT INTO "DriveConnection" (id, "organizationId", "accountEmail") VALUES ('bad-account', 'org-b', 'other@example.test')`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("rejects duplicate grants even without an event", async () => {
    await db.exec(
      `INSERT INTO "Permission" (id, "organizationId", "userId", resource, action) VALUES ('grant-1', 'org-a', 'user-a', 'EVENT', 'READ')`,
    );
    await expect(
      db.exec(
        `INSERT INTO "Permission" (id, "organizationId", "userId", resource, action) VALUES ('grant-2', 'org-a', 'user-a', 'EVENT', 'READ')`,
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("preserves exact decimal amounts", async () => {
    await db.exec(
      `INSERT INTO "Transaction" (id, "organizationId", direction, amount, "bookedAt") VALUES ('tx-1', 'org-a', 'INCOME', 0.10, NOW()), ('tx-2', 'org-a', 'INCOME', 0.20, NOW())`,
    );
    const result = await db.query<{ total: string }>(
      `SELECT SUM(amount)::text AS total FROM "Transaction"`,
    );
    expect(result.rows[0].total).toBe("0.30");
    await expect(
      db.exec(
        `INSERT INTO "Transaction" (id, "organizationId", direction, amount, "bookedAt") VALUES ('tx-invalid', 'org-a', 'INCOME', -1, NOW())`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("rejects an event ending before its start", async () => {
    await expect(
      db.exec(
        `UPDATE "Event" SET "startsAt" = '2026-10-05', "endsAt" = '2026-10-04' WHERE id = 'event-a'`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("maps folders and rejects files as event folders", async () => {
    await db.exec(`INSERT INTO "DriveItem" (id, "organizationId", "connectionId", "externalId", name, "mimeType", kind) VALUES
      ('folder-a', 'org-a', 'drive-a', 'folder-remote', 'Folder', 'application/vnd.google-apps.folder', 'FOLDER'),
      ('file-a', 'org-a', 'drive-a', 'file-remote', 'File', 'text/plain', 'FILE')`);
    await db.exec(
      `INSERT INTO "DriveFolderMapping" (id, "organizationId", "eventId", "driveItemId") VALUES ('mapping-ok', 'org-a', 'event-a', 'folder-a')`,
    );
    await expect(
      db.exec(
        `INSERT INTO "DriveFolderMapping" (id, "organizationId", "eventId", "driveItemId", purpose) VALUES ('mapping-bad', 'org-a', 'event-a', 'file-a', 'FINANCE')`,
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      db.exec(`UPDATE "DriveItem" SET kind = 'FILE' WHERE id = 'folder-a'`),
    ).rejects.toThrow();
  });

  it("restricts deletion of organizations with records", async () => {
    await expect(
      db.exec(`DELETE FROM "Organization" WHERE id = 'org-a'`),
    ).rejects.toMatchObject({ code: "23503" });
  });
});
