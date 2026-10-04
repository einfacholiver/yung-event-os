import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { requireDriveUser } from "@/modules/drive/server/context";
import { moneySchema } from "@/modules/workspace/schemas";
import { mutationError, requireSameOrigin } from "@/server/http";

const inputSchema = z.object({
  eventId: z.string().min(1),
  direction: z.enum(["INCOME", "EXPENSE"]),
  amount: moneySchema.refine((value) => Number(value) > 0),
  bookedAt: z.string().date(),
  description: z.string().trim().max(500).optional(),
});
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireDriveUser();
    const input = inputSchema.parse(
      Object.fromEntries(await request.formData()),
    );
    const event = await getDb().event.findFirst({
      where: { id: input.eventId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!event)
      return NextResponse.json(
        { error: "Event nicht gefunden." },
        { status: 400 },
      );
    const transaction = await getDb().transaction.create({
      data: {
        organizationId: user.organizationId,
        eventId: event.id,
        direction: input.direction,
        amount: input.amount,
        bookedAt: new Date(input.bookedAt),
        description: input.description || null,
      },
    });
    return NextResponse.json(
      { success: true, id: transaction.id },
      { status: 201 },
    );
  } catch (error) {
    return mutationError(error);
  }
}
