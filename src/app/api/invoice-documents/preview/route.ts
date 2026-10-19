import { requireSameOrigin } from "@/server/http";
import { requireDriveUser } from "@/modules/drive/server/context";
import { creationSchema, berlinDate } from "@/modules/invoice-creation/schema";
import { renderInvoice } from "@/modules/invoice-creation/pdf";
import { logoBytes } from "@/modules/invoice-creation/server";
import {
  invoiceBody,
  invoiceError,
  pdfResponse,
} from "@/modules/invoice-creation/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await requireDriveUser();
    const input = creationSchema.parse(await invoiceBody(request));
    return pdfResponse(
      await renderInvoice(
        input,
        "VORSCHAU",
        berlinDate(new Date()),
        await logoBytes(),
      ),
      "Vorschau.pdf",
    );
  } catch (error) {
    return invoiceError(error);
  }
}
