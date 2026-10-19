import { getDb } from "@/server/db/client";
import { requireDriveUser } from "@/modules/drive/server/context";
import { invoiceError, pdfResponse } from "@/modules/invoice-creation/http";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { organizationId } = await requireDriveUser();
    const document = await getDb().invoiceDocument.findFirst({
      where: { id: (await context.params).id, organizationId },
      select: { pdf: true, fileName: true },
    });
    if (!document)
      return Response.json(
        { error: "Rechnung nicht gefunden." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    return pdfResponse(
      document.pdf,
      document.fileName,
      new URL(request.url).searchParams.get("download") === "1",
    );
  } catch (error) {
    return invoiceError(error);
  }
}
