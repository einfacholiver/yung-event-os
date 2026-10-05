import "server-only";
import { z } from "zod";
import { decryptToken, encryptToken } from "@/server/auth/token-cipher";
import { DriveError } from "@/modules/drive/errors";
import { resolveUploadTarget } from "./upload";
import {
  DocumentUploadError,
  uploadInputSchema,
  validateDocumentFile,
} from "../upload";

const action = "DOCUMENT_UPLOAD_RESUMABLE";
export const CHUNK_SIZE = 2_097_152;
const descriptorSchema = uploadInputSchema.extend({
  name: z.string().max(200),
  size: z.number().int().positive().max(100_000_000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  md5: z.string().regex(/^[a-f0-9]{32}$/),
});
const planSchema = descriptorSchema.extend({
  fileId: z.string(),
  parentId: z.string(),
  connectionId: z.string(),
  mimeType: z.string(),
  session: z.string().optional(),
  offset: z.number().int().nonnegative(),
  ready: z.boolean(),
  expires: z.iso.datetime(),
});
type Target = Awaited<ReturnType<typeof resolveUploadTarget>>;
type Plan = z.infer<typeof planSchema>;

async function complete(
  target: Target,
  plan: Plan,
  db: Pick<Target["db"], "driveItem">,
) {
  const uploaded = await target.client.file(plan.fileId);
  if (
    uploaded.id !== plan.fileId ||
    uploaded.name !== plan.name ||
    uploaded.mimeType !== plan.mimeType ||
    uploaded.parents?.[0] !== plan.parentId ||
    uploaded.md5Checksum !== plan.md5 ||
    uploaded.trashed
  )
    throw new DocumentUploadError(
      "Die hochgeladene Datei stimmt nicht mit dem begonnenen Upload überein.",
      409,
    );
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
  await db.driveItem.upsert({
    where: {
      connectionId_externalId: {
        connectionId: target.connection.id,
        externalId: uploaded.id,
      },
    },
    create: {
      ...data,
      organizationId: target.organizationId,
      connectionId: target.connection.id,
      externalId: uploaded.id,
    },
    update: data,
  });
  return uploaded;
}

export async function beginDocumentUpload(eventId: string, input: unknown) {
  const descriptor = descriptorSchema.parse(input);
  const mimeType = validateDocumentFile(descriptor, descriptor.purpose);
  const target = await resolveUploadTarget(eventId, descriptor.purpose);
  const where = {
    organizationId: target.organizationId,
    eventId,
    actorId: target.userId,
    action,
    entityId: descriptor.requestId,
  };
  const existing = await target.db.activityLog.findFirst({ where });
  const fileId = existing
    ? planSchema.parse(existing.metadata).fileId
    : await target.client.generateFileId();
  return target.db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${target.organizationId + ":chunk-upload:" + descriptor.requestId}))::text`;
      let log = await tx.activityLog.findFirst({ where });
      let plan: Plan = log
        ? planSchema.parse(log.metadata)
        : {
            ...descriptor,
            fileId,
            parentId: target.target.externalId,
            connectionId: target.connection.id,
            mimeType,
            offset: 0,
            ready: false,
            expires: new Date(Date.now() + 6 * 24 * 60 * 60_000).toISOString(),
          };
      if (
        Object.keys(descriptor).some(
          (key) =>
            descriptor[key as keyof typeof descriptor] !==
            plan[key as keyof Plan],
        ) ||
        plan.parentId !== target.target.externalId ||
        plan.connectionId !== target.connection.id
      )
        throw new DocumentUploadError(
          "Für diesen Upload muss dieselbe Datei und Ordnerzuordnung verwendet werden.",
          409,
        );
      if (Date.parse(plan.expires) < Date.now())
        throw new DocumentUploadError(
          "Der Upload ist abgelaufen. Bitte einen neuen Upload beginnen.",
          410,
        );
      if (!log)
        log = await tx.activityLog.create({
          data: { ...where, entityType: "DriveItem", metadata: plan },
        });
      if (!plan.ready) {
        // A previous final chunk may have succeeded even if its response was lost.
        try {
          await complete(target, plan, tx);
          plan = { ...plan, ready: true, offset: plan.size };
        } catch (error) {
          if (!(error instanceof DriveError && error.status === 404))
            throw error;
          if (!plan.session) {
            const session = await target.client.beginResumable({
              id: plan.fileId,
              parentId: plan.parentId,
              name: plan.name,
              mimeType: plan.mimeType,
              size: plan.size,
            });
            plan = { ...plan, session: encryptToken(session) };
          } else {
            const status = await target.client.resumablePart(
              decryptToken(plan.session),
              plan.size,
            );
            plan = { ...plan, ...status, ready: status.complete };
            if (status.complete) await complete(target, plan, tx);
          }
        }
        await tx.activityLog.update({
          where: { id: log.id },
          data: { metadata: plan },
        });
      }
      return {
        requestId: plan.requestId,
        offset: plan.offset,
        complete: plan.ready,
        chunkSize: CHUNK_SIZE,
        name: plan.name,
        path: target.path.breadcrumbs.map((part) => part.name).join(" / "),
      };
    },
    { timeout: 45_000, maxWait: 5000 },
  );
}

export async function uploadDocumentChunk(
  eventId: string,
  requestId: string,
  offset: number,
  bytes: Uint8Array<ArrayBuffer>,
) {
  z.string().uuid().parse(requestId);
  z.number().int().nonnegative().parse(offset);
  if (!bytes.length || bytes.length > CHUNK_SIZE)
    throw new DocumentUploadError(
      "Ungültige Größe des Upload-Abschnitts.",
      413,
    );
  // Get the purpose from the scoped log, never an arbitrary Drive folder from the browser.
  const { requireAdmin } = await import("@/server/auth/access");
  const { getDb } = await import("@/server/db/client");
  const user = await requireAdmin();
  const db = getDb();
  const where = {
    organizationId: user.organizationId,
    actorId: user.userId,
    eventId,
    action,
    entityId: requestId,
  };
  const saved = await db.activityLog.findFirst({ where });
  if (!saved) throw new DocumentUploadError("Upload nicht gefunden.", 404);
  const target = await resolveUploadTarget(
    eventId,
    planSchema.parse(saved.metadata).purpose,
  );
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.organizationId + ":chunk-upload:" + requestId}))::text`;
      const log = await tx.activityLog.findFirstOrThrow({ where });
      let plan = planSchema.parse(log.metadata);
      if (
        plan.parentId !== target.target.externalId ||
        plan.connectionId !== target.connection.id
      )
        throw new DocumentUploadError(
          "Die Ordnerzuordnung wurde geändert. Bitte den Upload neu beginnen.",
          409,
        );
      if (Date.parse(plan.expires) < Date.now())
        throw new DocumentUploadError("Der Upload ist abgelaufen.", 410);
      if (!plan.ready) {
        if (
          !plan.session ||
          offset !== plan.offset ||
          offset + bytes.length > plan.size
        )
          throw new DocumentUploadError(
            "Bitte den Upload erneut versuchen, um seinen Fortschritt abzugleichen.",
            409,
          );
        if (
          offset === 0 &&
          plan.mimeType === "application/pdf" &&
          new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
        )
          throw new DocumentUploadError(
            "Die Datei ist keine gültige PDF-Datei.",
          );
        const status = await target.client.resumablePart(
          decryptToken(plan.session),
          plan.size,
          offset,
          bytes,
        );
        if (status.offset < offset + bytes.length && !status.complete)
          throw new DocumentUploadError(
            "Der Upload-Abschnitt wurde nicht vollständig bestätigt. Bitte erneut versuchen.",
            503,
          );
        plan = { ...plan, offset: status.offset, ready: status.complete };
        if (status.complete) await complete(target, plan, tx);
        await tx.activityLog.update({
          where: { id: log.id },
          data: { metadata: plan },
        });
      }
      return {
        offset: plan.offset,
        complete: plan.ready,
        name: plan.name,
        path: target.path.breadcrumbs.map((part) => part.name).join(" / "),
      };
    },
    { timeout: 45_000, maxWait: 5000 },
  );
}
