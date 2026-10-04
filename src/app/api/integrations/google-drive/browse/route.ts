import { browseDrive } from "@/modules/drive/server/service";
import { DriveError, driveErrorMessage } from "@/modules/drive/errors";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const result = await browseDrive({
      folderId: params.get("folderId") ?? "root",
      pageToken: params.get("pageToken") ?? undefined,
    });
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: driveErrorMessage(error) },
      {
        status: error instanceof DriveError ? error.status : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
