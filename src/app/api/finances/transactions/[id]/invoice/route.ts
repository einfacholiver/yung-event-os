import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { requireDriveUser } from "@/modules/drive/server/context";
import { getDocuments } from "@/modules/documents/server/queries";
import { DriveError } from "@/modules/drive/errors";
import { mutationError, requireSameOrigin } from "@/server/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireDriveUser();
    const { id } = await context.params;
    const { driveItemId } = z
      .object({ driveItemId: z.string().max(200) })
      .parse(Object.fromEntries(await request.formData()));
    const db = getDb();
    const row = await db.transaction.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row?.eventId) throw new DriveError("NOT_FOUND", 404);
    const { documents } = driveItemId
      ? await getDocuments(row.eventId)
      : { documents: [] };
    const document = documents.find(
      (file) =>
        file.id === driveItemId &&
        file.category === (row.direction === "EXPENSE" ? "EXPENSES" : "INCOME"),
    );
    if (driveItemId && !document) throw new DriveError("FORBIDDEN", 403);
    await db.$transaction(async (tx) => {
      // Serialize edits to this booking; linking never creates another transaction.
      await tx.$queryRaw`SELECT "id" FROM "Transaction" WHERE "id" = ${id} AND "organizationId" = ${user.organizationId} FOR UPDATE`;
      const current = await tx.transaction.findFirst({
        where: { id, organizationId: user.organizationId },
      });
      if (
        !current ||
        current.eventId !== row.eventId ||
        current.direction !== row.direction
      )
        throw new DriveError("FORBIDDEN", 403);
      let invoiceId: string | null = null;
      if (document) {
        const direction = row.direction === "EXPENSE" ? "INCOMING" : "OUTGOING";
        const existing = await tx.invoice.findFirst({
          where: {
            organizationId: user.organizationId,
            eventId: row.eventId,
            driveItemId: document.id,
            direction,
          },
        });
        const invoice =
          existing ??
          (await tx.invoice.create({
            data: {
              organizationId: user.organizationId,
              eventId: row.eventId,
              driveItemId: document.id,
              direction,
              counterparty: document.name,
              totalAmount: current.amount,
              currency: current.currency,
            },
          }));
        invoiceId = invoice.id;
      }
      await tx.transaction.update({ where: { id }, data: { invoiceId } });
      await tx.activityLog.create({
        data: {
          organizationId: user.organizationId,
          eventId: row.eventId,
          actorId: user.userId,
          action: "TRANSACTION_INVOICE_LINKED",
          entityType: "Transaction",
          entityId: id,
          metadata: {
            previousInvoiceId: current.invoiceId,
            invoiceId,
            driveItemId: document?.id ?? null,
          },
        },
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return mutationError(error);
  }
}
