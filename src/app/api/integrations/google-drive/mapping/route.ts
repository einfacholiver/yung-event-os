import { NextResponse } from "next/server";
import { DriveError } from "@/modules/drive/errors";
import { saveDriveMapping } from "@/modules/drive/server/mapping";
import { requireDriveUser } from "@/modules/drive/server/context";
import { requireSameOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await requireDriveUser();
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
        error: "Zuordnung konnte nicht gespeichert werden.",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
