export const DRIVE_ACCOUNT_EMAIL = "lightsignal.dj@gmail.com";
export const DRIVE_METADATA_SCOPE =
  "https://www.googleapis.com/auth/drive.metadata.readonly";
export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";
export const DRIVE_SETTINGS_PATH = "/settings/integrations/google-drive";

export function isAllowedGoogleIdentity(
  profile: unknown,
): profile is { email: string; email_verified: true; sub: string } {
  if (!profile || typeof profile !== "object") return false;
  const value = profile as Record<string, unknown>;
  return (
    value.email === DRIVE_ACCOUNT_EMAIL &&
    value.email_verified === true &&
    typeof value.sub === "string" &&
    value.sub.length > 0
  );
}

export function hasDriveScope(scope: string | null | undefined) {
  return scope?.split(/\s+/).includes(DRIVE_METADATA_SCOPE) ?? false;
}
