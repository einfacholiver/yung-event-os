import { NextResponse } from "next/server";
import { requireDriveUser } from "@/modules/drive/server/context";
import { getDb } from "@/server/db/client";
import { mutationError, requireSameOrigin } from "@/server/http";
import { parseTicketCsv } from "@/modules/tickets/csv";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireDriveUser();
    const id = (await context.params).id;
    const db = getDb();
    if (
      !(await db.event.findFirst({
        where: { id, organizationId: user.organizationId },
        select: { id: true },
      }))
    )
      return NextResponse.json(
        { error: "Event nicht gefunden." },
        { status: 404 },
      );
    if (Number(request.headers.get("content-length")) > 2_100_000)
      return NextResponse.json({ error: "Datei zu groß." }, { status: 413 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 2_000_000)
      return NextResponse.json(
        { error: "CSV-Datei bis 2 MB auswählen." },
        { status: 400 },
      );
    let rows;
    try {
      rows = parseTicketCsv(await file.text());
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "CSV ungültig." },
        { status: 400 },
      );
    }
    if (form.get("confirm") !== "yes") return NextResponse.json({ rows });
    await db.$transaction(
      async (tx) => {
        for (const row of rows)
          await tx.ticketOrder.upsert({
            where: {
              eventId_orderNumber: {
                eventId: id,
                orderNumber: row.orderNumber,
              },
            },
            create: {
              ...row,
              eventId: id,
              organizationId: user.organizationId,
            },
            update: row,
          });
      },
      { timeout: 60000 },
    );
    return NextResponse.json({ success: true, count: rows.length });
  } catch (error) {
    return mutationError(error);
  }
}
