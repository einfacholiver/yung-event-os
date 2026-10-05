import { NextResponse } from "next/server";
import { requireDriveUser } from "@/modules/drive/server/context";
import { DriveError, driveErrorMessage } from "@/modules/drive/errors";
import { requireSameOrigin, mutationError } from "@/server/http";
import { uploadEventDocument } from "@/modules/documents/server/upload";
import {
  MEDIA_UPLOAD_LIMIT,
  DocumentUploadError,
} from "@/modules/documents/upload";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    await requireDriveUser();
    if (
      Number(request.headers.get("content-length")) >
      MEDIA_UPLOAD_LIMIT + 50_000
    )
      return NextResponse.json(
        { error: "Datei zu groß. Maximal 100 MB für Media, sonst 20 MB." },
        { status: 413 },
      );
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new DocumentUploadError("Bitte eine Datei auswählen.");
    const result = await uploadEventDocument(
      (await context.params).id,
      { purpose: form.get("purpose"), requestId: form.get("requestId") },
      file,
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof DocumentUploadError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof DriveError)
      return NextResponse.json(
        { error: driveErrorMessage(error) },
        { status: error.status },
      );
    return mutationError(error);
  }
}
