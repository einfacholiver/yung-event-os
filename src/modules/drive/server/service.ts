import "server-only";
import { getDb } from "@/server/db/client";
import { folderIdSchema } from "../schemas";
import { DriveError } from "../errors";
import { getDriveCredentials } from "./token";
import { verifiedDriveClient } from "./google-client";
import { getDriveConnection } from "./context";

const MAX_SYNC_ITEMS = 10_000;

export async function browseDrive(input: unknown) {
  const { token, account } = await getDriveCredentials();
  const client = await verifiedDriveClient(token, account.providerAccountId);
  return client.browse(input);
}

export async function saveDriveFolder(input: unknown) {
  const parsed = folderIdSchema.safeParse(input);
  if (!parsed.success) throw new DriveError("INVALID_INPUT", 400);
  const { token, account, connection, organizationId } =
    await getDriveCredentials();
  const client = await verifiedDriveClient(token, account.providerAccountId);
  const { folder, rootId } = await client.folderPath(parsed.data);
  if (folder.id === rootId) throw new DriveError("INVALID_INPUT", 400);
  const result = await getDb().driveConnection.updateMany({
    where: {
      id: connection.id,
      organizationId,
      googleAccountId: account.id,
      status: "CONNECTED",
    },
    data: {
      rootFolderId: folder.id,
      rootFolderName: folder.name,
      folderSelectedAt: new Date(),
    },
  });
  if (result.count !== 1) throw new DriveError("RECONNECT", 401);
  return { id: folder.id, name: folder.name };
}

export async function disconnectDrive() {
  const { connection, account, organizationId } = await getDriveConnection();
  await getDb().$transaction([
    getDb().driveConnection.update({
      where: { id: connection.id, organizationId },
      data: { status: "DISCONNECTED" },
    }),
    getDb().account.update({
      where: { id: account.id },
      data: {
        access_token: null,
        refresh_token: null,
        id_token: null,
        expires_at: null,
        scope: null,
      },
    }),
  ]);
}

export async function syncDrive() {
  const { token, account, connection, organizationId } =
    await getDriveCredentials();
  if (!connection.rootFolderId) throw new DriveError("INVALID_INPUT", 400);
  const client = await verifiedDriveClient(token, account.providerAccountId);
  const db = getDb();
  const queue = [connection.rootFolderId];
  const seen = new Set<string>();
  const processedFolders = new Set<string>();
  let files = 0;
  let folders = 0;

  while (queue.length > 0) {
    const folderId = queue.shift()!;
    if (processedFolders.has(folderId)) continue;
    processedFolders.add(folderId);
    let pageToken: string | undefined;
    let firstPage = true;
    do {
      const result = await client.browse({ folderId, pageToken });
      const items = firstPage ? [result.folder, ...result.files] : result.files;
      firstPage = false;
      for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        if (seen.size > MAX_SYNC_ITEMS)
          throw new DriveError("UNAVAILABLE", 503);
        const kind =
          item.mimeType === "application/vnd.google-apps.folder"
            ? "FOLDER"
            : "FILE";
        const modifiedAt = item.modifiedTime
          ? new Date(item.modifiedTime)
          : null;
        await db.driveItem.upsert({
          where: {
            connectionId_externalId: {
              connectionId: connection.id,
              externalId: item.id,
            },
          },
          create: {
            organizationId,
            connectionId: connection.id,
            externalId: item.id,
            parentExternalId:
              item.id === connection.rootFolderId
                ? null
                : (item.parents?.[0] ?? folderId),
            name: item.name,
            mimeType: item.mimeType,
            kind,
            webViewUrl: `https://drive.google.com/${kind === "FOLDER" ? "drive/folders" : "file/d"}/${encodeURIComponent(item.id)}`,
            modifiedAt:
              modifiedAt && !Number.isNaN(modifiedAt.valueOf())
                ? modifiedAt
                : null,
            trashed: false,
          },
          update: {
            parentExternalId:
              item.id === connection.rootFolderId
                ? null
                : (item.parents?.[0] ?? folderId),
            name: item.name,
            mimeType: item.mimeType,
            kind,
            webViewUrl: `https://drive.google.com/${kind === "FOLDER" ? "drive/folders" : "file/d"}/${encodeURIComponent(item.id)}`,
            modifiedAt:
              modifiedAt && !Number.isNaN(modifiedAt.valueOf())
                ? modifiedAt
                : null,
            trashed: false,
          },
        });
        if (kind === "FOLDER") {
          folders += 1;
          if (item.id !== folderId) queue.push(item.id);
        } else files += 1;
      }
      pageToken = result.nextPageToken;
    } while (pageToken);
  }
  const syncedAt = new Date();
  await db.$transaction([
    db.driveItem.updateMany({
      where: { connectionId: connection.id, externalId: { notIn: [...seen] } },
      data: { trashed: true },
    }),
    db.driveConnection.update({
      where: { id: connection.id, organizationId },
      data: { lastSyncedAt: syncedAt },
    }),
  ]);
  return { files, folders, total: seen.size, syncedAt };
}
