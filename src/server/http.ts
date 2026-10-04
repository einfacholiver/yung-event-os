import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DriveError } from "@/modules/drive/errors";

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new DriveError("FORBIDDEN", 403);
}

export function mutationError(error: unknown) {
  const status =
    error instanceof DriveError
      ? error.status
      : error instanceof ZodError
        ? 400
        : 500;
  const message =
    status === 401
      ? "Bitte erneut anmelden."
      : status === 403
        ? "Kein Zugriff auf diese Anfrage."
        : status === 400
          ? "Bitte Eingaben prüfen."
          : "Speichern fehlgeschlagen. Bitte erneut versuchen.";
  return NextResponse.json({ error: message }, { status });
}
