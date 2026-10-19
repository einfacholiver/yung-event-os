import { DocumentUploadError } from "@/modules/documents/upload";
import { AccessError } from "@/server/auth/access";
import { mutationError } from "@/server/http";
import { z } from "zod";
export async function invoiceBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new DocumentUploadError("Eingaben fehlen.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 100_000) {
        await reader.cancel();
        throw new DocumentUploadError("Eingaben zu groß.", 413);
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
export function invoiceError(error: unknown) {
  if (error instanceof DocumentUploadError || error instanceof AccessError)
    return Response.json(
      {
        error:
          error instanceof AccessError
            ? "Anmeldung erforderlich."
            : error.message,
      },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  if (
    error instanceof z.ZodError &&
    error.issues.some((issue) => issue.path[0] === "sender")
  )
    return Response.json(
      {
        error:
          "Bitte die Absenderangaben prüfen: alle Felder ausfüllen, eine gültige E-Mail, IBAN und BIC verwenden und keine Zeilenumbrüche eintragen.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return Response.json(
      {
        error:
          "Bitte Empfänger, Leistungsdatum, Zahlungsangaben und Positionen prüfen. Nur lateinische Zeichen ohne Emojis verwenden.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  return mutationError(error);
}
export function pdfResponse(
  bytes: Uint8Array,
  fileName: string,
  download = false,
) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
