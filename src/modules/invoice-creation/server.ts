import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { getDb } from "@/server/db/client";
import { requireDriveUser } from "@/modules/drive/server/context";
import { getDriveCredentials } from "@/modules/drive/server/token";
import { verifiedDriveClient } from "@/modules/drive/server/google-client";
import { hasDriveWriteScope, DRIVE_FOLDER_MIME } from "@/modules/drive/config";
import { resolveUploadTarget } from "@/modules/documents/server/upload";
import { DocumentUploadError } from "@/modules/documents/upload";
import { Prisma } from "@/generated/prisma/client";
import { renderInvoice } from "./pdf";
import {
  amountString,
  berlinDate,
  creationSchema,
  DJ_FOLDER_2026,
  existingSequence,
  filename,
  invoiceNumber,
  totalCents,
  type InvoiceInput,
} from "./schema";

export const logoBytes = () =>
  readFile(
    path.join(
      process.cwd(),
      "src/modules/invoice-creation/assets/lightsignal.png",
    ),
  );
const digest = (input: InvoiceInput) =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex");
const conflict = () =>
  new DocumentUploadError(
    "Diese Erstellung wurde mit anderen Angaben begonnen. Bitte die Seite neu laden.",
    409,
  );

async function targetFor(input: InvoiceInput) {
  if (input.destination === "EVENT") {
    const target = await resolveUploadTarget(input.eventId, "INCOME");
    return { ...target, parentId: target.target.externalId };
  }
  const context = await getDriveCredentials();
  if (!hasDriveWriteScope(context.account.scope))
    throw new DocumentUploadError(
      "Bitte die Schreibfreigabe für Google Drive aktivieren.",
      403,
    );
  const client = await verifiedDriveClient(
    context.token,
    context.account.providerAccountId,
  );
  const folder = await client.folderPath(DJ_FOLDER_2026);
  if (folder.folder.mimeType !== DRIVE_FOLDER_MIME)
    throw new DocumentUploadError("DJ-Gig-Zielordner nicht gefunden.", 404);
  return { ...context, db: getDb(), client, parentId: DJ_FOLDER_2026 };
}

// On first issuance in a month, inspect existing PDFs in the authorized invoice
// folders. Never reuse a number just because the old PDF was not created here.
async function previousSequence(
  context: Awaited<ReturnType<typeof targetFor>>,
  period: string,
) {
  const { db, organizationId, client, connection } = context;
  if (
    await db.invoiceCounter.findUnique({
      where: { organizationId_period: { organizationId, period } },
    })
  )
    return 0;
  const [mappings, invoices] = await Promise.all([
    db.driveFolderMapping.findMany({
      where: {
        organizationId,
        purpose: "INCOME",
        driveItem: { connectionId: connection.id, trashed: false },
      },
      include: { driveItem: true },
    }),
    db.invoice.findMany({
      where: {
        organizationId,
        direction: "OUTGOING",
        number: { startsWith: period },
      },
      select: { number: true },
    }),
  ]);
  const queue = [
    ...new Set([
      DJ_FOLDER_2026,
      ...mappings.map((m) => m.driveItem.externalId),
    ]),
  ];
  const visited = new Set<string>();
  const names = invoices.map((i) => i.number ?? "");
  let count = 0;
  while (queue.length) {
    const folderId = queue.shift()!;
    if (visited.has(folderId)) continue;
    visited.add(folderId);
    if (visited.size > 100)
      throw new DocumentUploadError(
        "Zu viele Unterordner zur sicheren Nummernprüfung. Bitte Zielstruktur prüfen.",
        409,
      );
    let pageToken: string | undefined;
    const seenTokens = new Set<string>();
    do {
      const result = await client.browse({ folderId, pageToken });
      for (const file of result.files) {
        if (++count > 10000)
          throw new DocumentUploadError(
            "Zu viele Dateien zur sicheren Nummernprüfung.",
            409,
          );
        names.push(file.name);
        if (file.mimeType === DRIVE_FOLDER_MIME) queue.push(file.id);
      }
      pageToken = result.nextPageToken;
      if (pageToken && seenTokens.has(pageToken))
        throw new DocumentUploadError(
          "Drive-Seitenfolge konnte nicht geprüft werden.",
          503,
        );
      if (pageToken) seenTokens.add(pageToken);
    } while (pageToken);
  }
  return existingSequence(period, names);
}

export async function createInvoiceDocument(raw: unknown) {
  const input = creationSchema.parse(raw);
  const { organizationId, userId } = await requireDriveUser();
  const db = getDb();
  const where = {
    organizationId_requestId: { organizationId, requestId: input.requestId },
  };
  const existing = await db.invoiceDocument.findUnique({
    where,
    select: { id: true, payload: true },
  });
  if (existing) {
    if (digest(creationSchema.parse(existing.payload)) !== digest(input))
      throw conflict();
    return { id: existing.id };
  }
  const context = await targetFor(input);
  const now = new Date();
  const issuedDate = berlinDate(now);
  const period = issuedDate.slice(0, 7);
  const floor = await previousSequence(context, period);
  const externalId = await context.client.generateFileId();
  const logo = await logoBytes();
  // One lock per organization/month serializes allocation and idempotency.
  // Network requests are completed before this transaction starts.
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${organizationId + ":invoice:" + period}, 0))::text`;
      const saved = await tx.invoiceDocument.findUnique({
        where,
        select: { id: true, payload: true },
      });
      if (saved) {
        if (digest(creationSchema.parse(saved.payload)) !== digest(input))
          throw conflict();
        return { id: saved.id };
      }
      const counter = await tx.invoiceCounter.upsert({
        where: { organizationId_period: { organizationId, period } },
        create: { organizationId, period, lastSequence: floor + 1 },
        update: { lastSequence: { increment: 1 } },
      });
      const number = invoiceNumber(period, counter.lastSequence);
      const bytes = await renderInvoice(input, number, issuedDate, logo);
      const due = new Date(`${issuedDate}T12:00:00Z`);
      due.setUTCDate(due.getUTCDate() + input.dueDays);
      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          eventId: input.destination === "EVENT" ? input.eventId : null,
          counterparty: input.recipient.split(/\r?\n/)[0],
          direction: "OUTGOING",
          number,
          status: input.payment === "TRANSFER_OPEN" ? "OPEN" : "PAID",
          totalAmount: amountString(totalCents(input.items)),
          issuedAt: new Date(`${issuedDate}T12:00:00Z`),
          dueAt: due,
        },
      });
      const document = await tx.invoiceDocument.create({
        data: {
          organizationId,
          invoiceId: invoice.id,
          requestId: input.requestId,
          number,
          period,
          sequence: counter.lastSequence,
          payload: input as unknown as Prisma.InputJsonValue,
          pdf: new Uint8Array(bytes),
          fileName: filename(number, input.title),
          parentExternalId: context.parentId,
          externalId,
          connectionId: context.connection.id,
        },
        select: { id: true },
      });
      await tx.activityLog.create({
        data: {
          organizationId,
          eventId: invoice.eventId,
          actorId: userId,
          action: "INVOICE_ISSUED",
          entityType: "Invoice",
          entityId: invoice.id,
          metadata: {
            number,
            documentId: document.id,
            destination: input.destination,
          },
        },
      });
      return document;
    },
    { timeout: 15000 },
  );
}

export async function uploadInvoiceDocument(id: string) {
  const { organizationId } = await requireDriveUser();
  const db = getDb();
  const document = await db.invoiceDocument.findFirst({
    where: { id, organizationId },
  });
  if (!document) throw new DocumentUploadError("Rechnung nicht gefunden.", 404);
  if (document.uploadedAt) return { success: true };
  const input = creationSchema.parse(document.payload);
  const context = await targetFor(input);
  if (
    context.connection.id !== document.connectionId ||
    context.parentId !== document.parentExternalId
  )
    throw new DocumentUploadError(
      "Die Drive-Zuordnung hat sich geändert. Die Rechnung bleibt gespeichert; bitte ursprünglichen Ordner wieder zuweisen.",
      409,
    );
  const bytes = new Uint8Array(document.pdf);
  const file = await context.client.uploadFile({
    id: document.externalId,
    parentId: document.parentExternalId,
    name: document.fileName,
    mimeType: "application/pdf",
    bytes,
    md5Checksum: createHash("md5").update(bytes).digest("hex"),
  });
  await db.$transaction(async (tx) => {
    const data = {
      name: file.name,
      mimeType: "application/pdf",
      kind: "FILE" as const,
      parentExternalId: document.parentExternalId,
      trashed: false,
      webViewUrl: `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`,
      modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
    };
    const item = await tx.driveItem.upsert({
      where: {
        connectionId_externalId: {
          connectionId: document.connectionId,
          externalId: file.id,
        },
      },
      create: {
        ...data,
        organizationId,
        connectionId: document.connectionId,
        externalId: file.id,
      },
      update: data,
    });
    await tx.invoice.update({
      where: { id: document.invoiceId },
      data: { driveItemId: item.id },
    });
    await tx.invoiceDocument.update({
      where: { id: document.id },
      data: { uploadedAt: new Date() },
    });
  });
  return { success: true };
}
