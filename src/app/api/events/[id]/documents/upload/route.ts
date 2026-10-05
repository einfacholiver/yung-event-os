import { requireSameOrigin, mutationError } from "@/server/http";
import { requireDriveUser } from "@/modules/drive/server/context";
import { AccessError } from "@/server/auth/access";
import { DriveError, driveErrorMessage } from "@/modules/drive/errors";
import { DocumentUploadError } from "@/modules/documents/upload";
import {
  beginDocumentUpload,
  CHUNK_SIZE,
  uploadDocumentChunk,
} from "@/modules/documents/server/resumable-upload";

export const runtime = "nodejs";

async function bodyBytes(request: Request, limit: number) {
  if (!request.body) throw new DocumentUploadError("Upload-Inhalt fehlt.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new DocumentUploadError("Upload-Abschnitt zu groß.", 413);
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function failure(error: unknown) {
  if (error instanceof DocumentUploadError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof DriveError)
    return Response.json(
      { error: driveErrorMessage(error) },
      { status: error.status },
    );
  if (error instanceof AccessError)
    return Response.json(
      { error: "Anmeldung erforderlich." },
      { status: error.status },
    );
  if (error instanceof SyntaxError)
    return Response.json(
      { error: "Ungültige Upload-Anfrage." },
      { status: 400 },
    );
  return mutationError(error);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    await requireDriveUser();
    const input = JSON.parse(
      new TextDecoder().decode(await bodyBytes(request, 4096)),
    );
    return Response.json(
      await beginDocumentUpload((await context.params).id, input),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    await requireDriveUser();
    const offset = request.headers.get("x-upload-offset");
    if (offset === null || !/^\d+$/.test(offset))
      throw new DocumentUploadError("Upload-Fortschritt fehlt.");
    const result = await uploadDocumentChunk(
      (await context.params).id,
      request.headers.get("x-upload-id") ?? "",
      Number(offset),
      await bodyBytes(request, CHUNK_SIZE),
    );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
