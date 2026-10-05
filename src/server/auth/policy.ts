export const ADMIN_EMAIL = "lightsignal.dj@gmail.com";
export const LOGIN_PATH = "/login";

export function isAdminIdentity(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return false;
  const value = profile as Record<string, unknown>;
  return (
    value.email === ADMIN_EMAIL &&
    value.email_verified === true &&
    typeof value.sub === "string" &&
    value.sub.length > 0
  );
}

// Explicit public allowlist. Never exempt arbitrary extensions or all /api paths.
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === LOGIN_PATH ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/static/") ||
    pathname === "/_next/image" ||
    [
      "/favicon.ico",
      "/icon.png",
      "/apple-icon.png",
      "/brand/yung-logo.png",
    ].includes(pathname)
  );
}
