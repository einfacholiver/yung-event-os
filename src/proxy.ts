import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath, LOGIN_PATH } from "@/server/auth/policy";

// Keep Proxy free of Auth.js/Prisma/pg: Netlify bundles it as an Edge Function.
// Cookie presence is only a routing hint, never authorization. WorkspaceLayout
// and business services validate the actual DB session in the Node runtime.
export function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();
  const hasSessionCookie = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
  ].some((name) => !!request.cookies.get(name)?.value);
  if (!hasSessionCookie) {
    if (request.nextUrl.pathname.startsWith("/api/"))
      return NextResponse.json(
        { error: "Anmeldung erforderlich." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    const response = NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static/).*)"],
};
