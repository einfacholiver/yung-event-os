import { getDocuments } from "@/modules/documents/server/queries";
import { getDriveCredentials } from "@/modules/drive/server/token";
import { verifiedDriveClient } from "@/modules/drive/server/google-client";
import { hasDriveContentScope } from "@/modules/drive/config";
import { DriveError } from "@/modules/drive/errors";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const { id, fileId } = await context.params;
    const { documents } = await getDocuments(id);
    const file = documents.find(
      (item) => item.id === fileId && item.mimeType === "application/pdf",
    );
    if (!file)
      return Response.json({ error: "PDF nicht gefunden." }, { status: 404 });
    const credentials = await getDriveCredentials();
    if (!hasDriveContentScope(credentials.account.scope))
      return Response.json(
        { error: "Bitte Dokumentvorschauen zuerst über Google freigeben." },
        { status: 403 },
      );
    const client = await verifiedDriveClient(
      credentials.token,
      credentials.account.providerAccountId,
    );
    const pdf = await client.pdf(file.externalId);
    return new Response(pdf.bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status = error instanceof DriveError ? error.status : 503;
    const message =
      status === 400
        ? "PDF-Vorschau nicht verfügbar (maximal 20 MB). Bitte Original in Drive öffnen."
        : status === 401
          ? "Bitte erneut anmelden."
          : "PDF konnte nicht geladen werden. Bitte Original in Drive öffnen.";
    return Response.json({ error: message }, { status });
  }
}
