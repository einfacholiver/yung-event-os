import "server-only";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { getDriveCredentials } from "@/modules/drive/server/token";
import { verifiedDriveClient } from "@/modules/drive/server/google-client";
import { hasDriveWriteScope } from "@/modules/drive/config";
import { folderIdSchema } from "@/modules/drive/schemas";
import { eventSlug, newEventFolders, newEventSchema } from "../create-schema";

const action = "EVENT_DRIVE_SETUP";
const planSchema = z.object({
  parentId: folderIdSchema,
  name: z.string(),
  ids: z.array(folderIdSchema).length(5),
  ready: z.boolean(),
});
export class EventSetupError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function createEventWithFolders(input: unknown) {
  const { name } = newEventSchema.parse(input);
  const slug = eventSlug(name);
  if (!slug || slug === "yung")
    throw new EventSetupError("Bitte einen Eventnamen ergänzen.");
  const { organizationId, userId, connection, account, token } =
    await getDriveCredentials();
  if (!hasDriveWriteScope(account.scope))
    throw new EventSetupError(
      "Bitte zuerst das Anlegen von Drive-Ordnern über Google freigeben.",
      403,
    );
  const parentId = connection.rootFolderId;
  if (!parentId)
    throw new EventSetupError(
      "Bitte zuerst Veranstaltungen als Drive-Ausgangsordner auswählen.",
    );
  // No Drive reads or writes until the current Google identity is verified.
  const client = await verifiedDriveClient(token, account.providerAccountId);
  await client.folderPath(parentId);
  const db = getDb();
  const where = {
    organizationId,
    OR: [{ slug }, { slug: slug.replace(/^yung-/, "") }],
  };
  const existing = await db.event.findFirst({ where });
  const existingLog = existing
    ? await db.activityLog.findFirst({
        where: { organizationId, eventId: existing.id, action },
      })
    : null;
  if (existing && !existingLog)
    throw new EventSetupError(
      "Dieses Event existiert bereits. Öffne es in der Eventübersicht.",
      409,
    );
  const candidate = existingLog ? planSchema.parse(existingLog.metadata) : null;
  if (!candidate) {
    let pageToken: string | undefined;
    do {
      const page = await client.browse({ folderId: parentId, pageToken });
      if (
        page.files.some(
          (item) =>
            item.name.toLocaleLowerCase("de") === name.toLocaleLowerCase("de"),
        )
      )
        throw new EventSetupError(
          "Ein gleichnamiger Drive-Eintrag existiert bereits. Bitte vorhandene Zuordnung prüfen oder einen anderen Namen wählen.",
          409,
        );
      pageToken = page.nextPageToken;
    } while (pageToken);
  }
  const ids = candidate?.ids ?? (await client.generateFolderIds());
  const reserved = await db.$transaction(async (tx) => {
    // Serialize reservation only. Network calls stay outside this transaction.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId + ":" + slug.replace(/^yung-/, "")}))::text`;
    let event = await tx.event.findFirst({ where });
    let log = event
      ? await tx.activityLog.findFirst({
          where: { organizationId, eventId: event.id, action },
        })
      : null;
    if (event && !log)
      throw new EventSetupError("Dieses Event existiert bereits.", 409);
    if (!event)
      event = await tx.event.create({
        data: { name, slug, organizationId, status: "PLANNED" },
      });
    if (!log)
      log = await tx.activityLog.create({
        data: {
          organizationId,
          eventId: event.id,
          actorId: userId,
          action,
          entityType: "Event",
          entityId: event.id,
          metadata: { parentId, name, ids, ready: false },
        },
      });
    return { event, log, plan: planSchema.parse(log.metadata) };
  });
  const { event, log, plan } = reserved;
  if (plan.parentId !== parentId || plan.name !== name)
    throw new EventSetupError(
      "Der Ausgangsordner oder Eventname hat sich geändert. Bitte die ursprüngliche Auswahl wiederherstellen.",
      409,
    );
  if (plan.ready) return { id: event.id };
  // Google-generated IDs persisted above make timeout retries safe: creation
  // of an already-created ID returns 409, then its parent/name are verified.
  const folders = [
    { id: plan.ids[0], parentId, name, purpose: "ROOT" as const },
    ...newEventFolders.map((folder, index) => ({
      ...folder,
      id: plan.ids[index + 1],
      parentId: plan.ids[0],
    })),
  ];
  try {
    for (const folder of folders)
      await client.createFolder(folder.id, folder.parentId, folder.name);
    await db.$transaction(async (tx) => {
      for (const folder of folders) {
        const item = await tx.driveItem.upsert({
          where: {
            connectionId_externalId: {
              connectionId: connection.id,
              externalId: folder.id,
            },
          },
          create: {
            organizationId,
            connectionId: connection.id,
            externalId: folder.id,
            parentExternalId: folder.parentId,
            name: folder.name,
            mimeType: "application/vnd.google-apps.folder",
            kind: "FOLDER",
          },
          update: {
            parentExternalId: folder.parentId,
            name: folder.name,
            trashed: false,
          },
        });
        await tx.driveFolderMapping.upsert({
          where: {
            eventId_purpose: { eventId: event.id, purpose: folder.purpose },
          },
          create: {
            organizationId,
            eventId: event.id,
            driveItemId: item.id,
            purpose: folder.purpose,
          },
          update: { driveItemId: item.id },
        });
      }
      await tx.activityLog.update({
        where: { id: log.id },
        data: { metadata: { ...plan, ready: true } },
      });
    });
  } catch {
    throw new EventSetupError(
      "Das Event ist reserviert, die Drive-Struktur aber noch nicht vollständig. Bitte mit demselben Namen erneut anlegen; bereits erstellte Ordner werden wiederverwendet.",
      503,
    );
  }
  return { id: event.id };
}
