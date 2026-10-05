import { getDocuments } from "@/modules/documents/server/queries";
import { getDriveCredentials } from "@/modules/drive/server/token";
import { verifiedDriveClient } from "@/modules/drive/server/google-client";
import { hasDriveContentScope } from "@/modules/drive/config";
import { contentStream } from "@/server/content-stream";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const { id, fileId } = await context.params;
    const { documents } = await getDocuments(id);
    const file = documents.find(
      (item) =>
        item.id === fileId &&
        item.category === "MEDIA" &&
        item.mimeType.startsWith("image/"),
    );
    if (!file) return new Response(null, { status: 404 });
    const credentials = await getDriveCredentials();
    if (!hasDriveContentScope(credentials.account.scope))
      return new Response(null, { status: 403 });
    const client = await verifiedDriveClient(
      credentials.token,
      credentials.account.providerAccountId,
    );
    const image = await client.image(file.externalId);
    return new Response(contentStream(image.bytes), {
      headers: {
        "Content-Type": image.type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
