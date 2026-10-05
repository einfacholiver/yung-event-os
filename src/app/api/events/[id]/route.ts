import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDriveUser } from "@/modules/drive/server/context";
import { getDb } from "@/server/db/client";
import { mutationError, requireSameOrigin } from "@/server/http";
const optionalDate = z
  .union([z.literal(""), z.iso.datetime()])
  .transform((value) => (value ? new Date(value) : null));
const schema = z
  .object({
    location: z.string().trim().max(300),
    description: z.string().trim().max(10000),
    startsAt: optionalDate,
    endsAt: optionalDate,
    status: z.enum(["DRAFT", "PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"]),
  })
  .refine(
    (data) => !data.startsAt || !data.endsAt || data.endsAt >= data.startsAt,
  );
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireDriveUser();
    const data = schema.parse(Object.fromEntries(await request.formData()));
    const result = await getDb().event.updateMany({
      where: {
        id: (await context.params).id,
        organizationId: user.organizationId,
      },
      data,
    });
    return NextResponse.json(
      result.count ? { success: true } : { error: "Event nicht gefunden." },
      { status: result.count ? 200 : 404 },
    );
  } catch (error) {
    return mutationError(error);
  }
}
