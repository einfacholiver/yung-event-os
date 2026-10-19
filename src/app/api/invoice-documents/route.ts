import { requireSameOrigin } from "@/server/http";
import { requireDriveUser } from "@/modules/drive/server/context";
import { createInvoiceDocument } from "@/modules/invoice-creation/server";
import { invoiceBody, invoiceError } from "@/modules/invoice-creation/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await requireDriveUser();
    return Response.json(
      await createInvoiceDocument(await invoiceBody(request)),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return invoiceError(error);
  }
}
