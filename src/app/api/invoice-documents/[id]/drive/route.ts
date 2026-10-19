import { requireSameOrigin } from "@/server/http";
import { requireDriveUser } from "@/modules/drive/server/context";
import { uploadInvoiceDocument } from "@/modules/invoice-creation/server";
import { invoiceError } from "@/modules/invoice-creation/http";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    await requireDriveUser();
    return Response.json(
      await uploadInvoiceDocument((await context.params).id),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return invoiceError(error);
  }
}
