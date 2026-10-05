import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { requireDriveUser } from "@/modules/drive/server/context";
import { moneySchema } from "@/modules/workspace/schemas";
import { mutationError, requireSameOrigin } from "@/server/http";
import { paymentFields, normalizePayment } from "@/modules/finances/payment";
const schema = z.object({
  ...paymentFields,
  direction: z.enum(["INCOME", "EXPENSE"]),
  amount: moneySchema.refine((value) => Number(value) > 0),
  bookedAt: z.string().date(),
  description: z.string().trim().max(500),
});
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireDriveUser();
    const data = normalizePayment(
      schema.parse(Object.fromEntries(await request.formData())),
    );
    const result = await getDb().transaction.updateMany({
      where: {
        id: (await context.params).id,
        organizationId: user.organizationId,
        currency: "EUR",
      },
      data: { ...data, bookedAt: new Date(data.bookedAt) },
    });
    return NextResponse.json(
      result.count ? { success: true } : { error: "Buchung nicht gefunden." },
      { status: result.count ? 200 : 404 },
    );
  } catch (error) {
    return mutationError(error);
  }
}
