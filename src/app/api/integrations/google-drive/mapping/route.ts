import { NextResponse } from "next/server";
import { DriveError } from "@/modules/drive/errors";
import { saveDriveMapping } from "@/modules/drive/server/mapping";

export const dynamic = "force-dynamic";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === request.headers.get("host");
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  try {
    const form = await request.formData();
    await saveDriveMapping({
      eventId: String(form.get("eventId") ?? ""),
      purpose: String(form.get("purpose") ?? ""),
      driveItemId: String(form.get("driveItemId") ?? ""),
    });
    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof DriveError ? error.status : 500;
    return NextResponse.json(
      {
        error:
          error instanceof DriveError
            ? "Zuordnung konnte nicht gespeichert werden."
            : "Zuordnung konnte nicht gespeichert werden.",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
