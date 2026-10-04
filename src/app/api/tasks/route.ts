import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { requireDriveUser } from "@/modules/drive/server/context";
import { taskSchema } from "@/modules/workspace/schemas";
import { mutationError, requireSameOrigin } from "@/server/http";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { organizationId } = await requireDriveUser();
    const input = taskSchema
      .extend({ eventId: z.string().min(1) })
      .parse(await request.json());
    const db = getDb();
    if (
      !(await db.event.findFirst({
        where: { id: input.eventId, organizationId },
      }))
    )
      return NextResponse.json(
        { error: "Event nicht gefunden." },
        { status: 400 },
      );
    await db.task.create({
      data: {
        ...input,
        organizationId,
        completedAt: input.status === "DONE" ? new Date() : null,
      },
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return mutationError(error);
  }
}
