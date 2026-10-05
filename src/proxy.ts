import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
  type NextMiddleware,
} from "next/server";
import { auth } from "@/server/auth";
import { AccessError, verifyAdminSession } from "@/server/auth/access";
import { isPublicPath, LOGIN_PATH } from "@/server/auth/policy";

const protectRequest = auth(async (request) => {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();
  try {
    await verifyAdminSession(request.auth);
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 503;
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error:
            status === 503
              ? "Dienst momentan nicht verfügbar."
              : "Anmeldung erforderlich oder Zugriff verweigert.",
        },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (status === 503)
      return new NextResponse("Dienst momentan nicht verfügbar.", {
        status,
        headers: { "Cache-Control": "no-store" },
      });
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }
});

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();
  // The installed Auth.js lazy configuration resolves wrappers asynchronously.
  const handler = (await protectRequest) as unknown as NextMiddleware;
  return handler(request, event);
}

export const config = {
  matcher: ["/((?!_next/static/).*)"],
};
