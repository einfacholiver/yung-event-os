import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { getDriveCredentials } from "@/modules/drive/server/token";
import { verifiedDriveClient } from "@/modules/drive/server/google-client";
import { hasDriveWriteScope } from "@/modules/drive/config";
import { folderIdSchema } from "@/modules/drive/schemas";
import {
  DocumentUploadError,
  uploadInputSchema,
  validateDocumentFile,
} from "../upload";

const action = "DOCUMENT_UPLOAD";
const planSchema = z.object({
  fileId: folderIdSchema,
  parentId: folderIdSchema,
  connectionId: z.string(),
  eventId: z.string(),
  purpose: z.enum(["INCOME", "EXPENSES", "MEDIA", "PERMISSIONS"]),
  name: z.string(),
  mimeType: z.string(),
  sha256: z.string(),
  ready: z.boolean(),
});

export async function resolveUploadTarget(eventId: string, purpose: string) {
  const { organizationId, userId, connection, account, token } =
    await getDriveCredentials();
  if (!hasDriveWriteScope(account.scope))
    throw new DocumentUploadError(
      "Bitte zuerst den Dokument-Upload über Google freigeben.",
      403,
    );
  const db = getDb();
  const event = await db.event.findFirst({
    where: { id: eventId, organizationId },
    select: { id: true },
  });
  if (!event) throw new DocumentUploadError("Event nicht gefunden.", 404);
  const mappings = await db.driveFolderMapping.findMany({
    where: { organizationId, eventId },
    include: { driveItem: true },
  });
  const target = mappings.find(
    (mapping) => mapping.purpose === purpose,
  )?.driveItem;
  const eventRoot = mappings.find(
    (mapping) => mapping.purpose === "ROOT",
  )?.driveItem;
  if (
    !target ||
    target.trashed ||
    target.connectionId !== connection.id ||
    !connection.rootFolderId
  )
    throw new DocumentUploadError(
      "Bitte zuerst den Zielordner für diesen Event-Bereich zuweisen.",
    );
  if (
    mappings.some(
      (mapping) =>
        mapping.purpose !== purpose && mapping.driveItem.id === target.id,
    )
  )
    throw new DocumentUploadError(
      "Der Zielordner ist mehreren Kategorien zugewiesen. Bitte eindeutige Ordnerzuordnung speichern.",
      409,
    );
  const client = await verifiedDriveClient(token, account.providerAccountId);
  const path = await client.folderPath(target.externalId);
  const ancestors = path.breadcrumbs.map((part) => part.id);
  if (
    !ancestors.includes(connection.rootFolderId) ||
    target.externalId === connection.rootFolderId ||
    (eventRoot &&
      (eventRoot.trashed ||
        eventRoot.connectionId !== connection.id ||
        !ancestors.includes(eventRoot.externalId) ||
        eventRoot.externalId === target.externalId))
  )
    throw new DocumentUploadError(
      "Der Zielordner liegt nicht innerhalb der zugewiesenen Event-Struktur. Bitte Drive-Mapping prüfen.",
      409,
    );
  const conflict = await db.driveFolderMapping.findFirst({
    where: {
      organizationId,
      eventId: { not: eventId },
      driveItem: {
        connectionId: connection.id,
        externalId: {
          in: ancestors.filter((id) => id !== connection.rootFolderId),
        },
      },
    },
  });
  if (conflict)
    throw new DocumentUploadError(
      "Der Zielpfad ist einem anderen Event zugewiesen. Bitte Drive-Mapping prüfen.",
      409,
    );
  return {
    db,
    organizationId,
    userId,
    connection,
    account,
    client,
    target,
    path,
  };
}

export async function uploadEventDocument(
  eventId: string,
  input: unknown,
  file: File,
) {
  const { purpose, requestId } = uploadInputSchema.parse(input);
  const mimeType = validateDocumentFile(file, purpose);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (
    mimeType === "application/pdf" &&
    new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
  )
    throw new DocumentUploadError(
      "Die ausgewählte Datei ist keine gültige PDF-Datei.",
    );
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const md5Checksum = createHash("md5").update(bytes).digest("hex");
  const { db, organizationId, userId, connection, client, target, path } =
    await resolveUploadTarget(eventId, purpose);
  const logWhere = { organizationId, action, entityId: requestId };
  const existing = await db.activityLog.findFirst({ where: logWhere });
  const candidateId = existing
    ? planSchema.parse(existing.metadata).fileId
    : await client.generateFileId();
  const reserved = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId + ":upload:" + requestId}))::text`;
    const log =
      (await tx.activityLog.findFirst({ where: logWhere })) ??
      (await tx.activityLog.create({
        data: {
          organizationId,
          eventId,
          actorId: userId,
          action,
          entityType: "DriveItem",
          entityId: requestId,
          metadata: {
            fileId: candidateId,
            parentId: target.externalId,
            connectionId: connection.id,
            eventId,
            purpose,
            name: file.name,
            mimeType,
            sha256,
            ready: false,
          },
        },
      }));
    return { log, plan: planSchema.parse(log.metadata) };
  });
  const { log, plan } = reserved;
  if (
    plan.parentId !== target.externalId ||
    plan.connectionId !== connection.id ||
    plan.eventId !== eventId ||
    plan.purpose !== purpose ||
    plan.name !== file.name ||
    plan.mimeType !== mimeType ||
    plan.sha256 !== sha256
  )
    throw new DocumentUploadError(
      "Dieser Upload wurde mit einer anderen Datei oder Zuordnung begonnen. Bitte die ursprüngliche Datei und Auswahl verwenden.",
      409,
    );
  const uploaded = await client.uploadFile({
    id: plan.fileId,
    parentId: plan.parentId,
    name: plan.name,
    mimeType,
    bytes,
    md5Checksum,
  });
  await db.$transaction(async (tx) => {
    const data = {
      name: uploaded.name,
      mimeType: uploaded.mimeType,
      parentExternalId: plan.parentId,
      kind: "FILE" as const,
      modifiedAt: uploaded.modifiedTime
        ? new Date(uploaded.modifiedTime)
        : new Date(),
      trashed: false,
      webViewUrl: `https://drive.google.com/file/d/${encodeURIComponent(uploaded.id)}/view`,
    };
    await tx.driveItem.upsert({
      where: {
        connectionId_externalId: {
          connectionId: connection.id,
          externalId: uploaded.id,
        },
      },
      create: {
        ...data,
        organizationId,
        connectionId: connection.id,
        externalId: uploaded.id,
      },
      update: data,
    });
    await tx.activityLog.update({
      where: { id: log.id },
      data: { metadata: { ...plan, ready: true } },
    });
  });
  return {
    name: uploaded.name,
    path: path.breadcrumbs.map((part) => part.name).join(" / "),
    externalId: uploaded.id,
  };
}
