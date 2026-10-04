import { NextResponse } from "next/server";
import { invoiceSchema as schema } from "@/modules/workspace/schemas";
import { mutationError, requireSameOrigin } from "@/server/http";
import { getDb } from "@/server/db/client";
import { requireDriveUser } from "@/modules/drive/server/context";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireDriveUser();
    const input = schema.parse(await request.json());
    const { id } = await params;
    const invoice = await getDb().invoice.updateMany({
      where: { id, organizationId: user.organizationId },
      data: input,
    });
    if (!invoice.count)
      return NextResponse.json(
        { error: "Rechnung nicht gefunden." },
        { status: 404 },
      );
    return NextResponse.json({ success: true });
  } catch (error) {
    return mutationError(error);
  }
}
