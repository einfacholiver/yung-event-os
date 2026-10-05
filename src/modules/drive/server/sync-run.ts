import "server-only";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { getDriveCredentials } from "./token";
import { verifiedDriveClient } from "./google-client";
import { DriveError } from "../errors";

const action = "DRIVE_SYNC_RUN";
const stateSchema = z.object({
  connectionId: z.string(),
  rootId: z.string(),
  startedAt: z.iso.datetime(),
  queue: z.array(z.string()).max(10_000),
  seen: z.array(z.string()).max(10_000),
  processed: z.array(z.string()).max(10_000),
  pageToken: z.string().optional(),
  files: z.number().int(),
  folders: z.number().int(),
  complete: z.boolean(),
  version: z.number().int(),
});
type State = z.infer<typeof stateSchema>;
const progress = (state: State) => ({
  files: state.files,
  folders: state.folders,
  total: state.seen.length,
  complete: state.complete,
});

// One Drive page per request. Progress lives in PostgreSQL, not local disk or
// process memory, so interrupted browser sessions and serverless cold starts resume.
export async function syncDriveStep(runId: string) {
  z.string().uuid().parse(runId);
  const { token, account, connection, organizationId, userId } =
    await getDriveCredentials();
  if (!connection.rootFolderId) throw new DriveError("INVALID_INPUT", 400);
  const db = getDb();
  const where = { organizationId, actorId: userId, action, entityId: runId };
  const saved = await db.activityLog.findFirst({ where });
  const initial: State = saved
    ? stateSchema.parse(saved.metadata)
    : {
        connectionId: connection.id,
        rootId: connection.rootFolderId,
        startedAt: new Date().toISOString(),
        queue: [connection.rootFolderId],
        seen: [],
        processed: [],
        files: 0,
        folders: 0,
        complete: false,
        version: 0,
      };
  if (
    initial.connectionId !== connection.id ||
    initial.rootId !== connection.rootFolderId
  )
    throw new DriveError("INVALID_INPUT", 409);
  if (initial.complete) return progress(initial);
  if (Date.now() - Date.parse(initial.startedAt) > 24 * 60 * 60_000)
    throw new DriveError("INVALID_INPUT", 409);
  const client = await verifiedDriveClient(token, account.providerAccountId);
  const folderId = initial.queue[0];
  const result = await client.browse({
    folderId,
    pageToken: initial.pageToken,
  });
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId + ":sync:" + runId}))::text`;
      let log = await tx.activityLog.findFirst({ where });
      const latest = log ? stateSchema.parse(log.metadata) : initial;
      if (latest.version !== initial.version) return progress(latest);
      if (!log)
        log = await tx.activityLog.create({
          data: { ...where, entityType: "DriveConnection", metadata: initial },
        });
      const seen = new Set(latest.seen);
      const queue = [...latest.queue];
      let { files, folders } = latest;
      for (const item of [result.folder, ...result.files]) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        if (seen.size > 10_000) throw new DriveError("UNAVAILABLE", 503);
        const kind =
          item.mimeType === "application/vnd.google-apps.folder"
            ? ("FOLDER" as const)
            : ("FILE" as const);
        const data = {
          name: item.name,
          mimeType: item.mimeType,
          kind,
          parentExternalId:
            item.id === latest.rootId ? null : (item.parents?.[0] ?? folderId),
          trashed: false,
          modifiedAt:
            item.modifiedTime && Number.isFinite(Date.parse(item.modifiedTime))
              ? new Date(item.modifiedTime)
              : null,
          webViewUrl: `https://drive.google.com/${kind === "FOLDER" ? "drive/folders" : "file/d"}/${encodeURIComponent(item.id)}`,
        };
        await tx.driveItem.upsert({
          where: {
            connectionId_externalId: {
              connectionId: connection.id,
              externalId: item.id,
            },
          },
          create: {
            ...data,
            organizationId,
            connectionId: connection.id,
            externalId: item.id,
          },
          update: data,
        });
        if (kind === "FOLDER") {
          folders++;
          if (
            item.id !== folderId &&
            !queue.includes(item.id) &&
            !latest.processed.includes(item.id)
          )
            queue.push(item.id);
        } else files++;
      }
      const processed = [...latest.processed];
      if (!result.nextPageToken) {
        queue.shift();
        processed.push(folderId);
      }
      const next: State = {
        ...latest,
        queue,
        processed,
        pageToken: result.nextPageToken,
        seen: [...seen],
        files,
        folders,
        complete: queue.length === 0,
        version: latest.version + 1,
      };
      // Omit undefined values from JSON persisted in Prisma.
      if (!next.pageToken) delete next.pageToken;
      if (next.complete) {
        await tx.driveItem.updateMany({
          where: {
            organizationId,
            connectionId: connection.id,
            externalId: { notIn: next.seen },
            updatedAt: { lt: new Date(next.startedAt) },
          },
          data: { trashed: true },
        });
        const updated = await tx.driveConnection.updateMany({
          where: {
            id: connection.id,
            organizationId,
            rootFolderId: next.rootId,
          },
          data: { lastSyncedAt: new Date() },
        });
        if (!updated.count) throw new DriveError("INVALID_INPUT", 409);
      }
      await tx.activityLog.update({
        where: { id: log.id },
        data: { metadata: next },
      });
      return progress(next);
    },
    { timeout: 45_000, maxWait: 5000 },
  );
}
