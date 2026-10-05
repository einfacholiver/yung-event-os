"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/server/auth";
import {
  DRIVE_SETTINGS_PATH,
  DRIVE_CONTENT_SCOPE,
  DRIVE_METADATA_SCOPE,
  DRIVE_WRITE_SCOPE,
} from "./config";
import { requireDriveUser } from "./server/context";
import { driveErrorMessage } from "./errors";
import { saveDriveFolder, disconnectDrive, syncDrive } from "./server/service";

export async function connectGoogleDrive() {
  await requireDriveUser();
  await signIn("google", { redirectTo: DRIVE_SETTINGS_PATH });
}
export async function enableEventFolderCreation() {
  await requireDriveUser();
  await signIn(
    "google",
    { redirectTo: "/events/new" },
    {
      scope: `openid email profile ${DRIVE_WRITE_SCOPE}`,
      prompt: "consent select_account",
      access_type: "offline",
    },
  );
}

export async function enableDocumentUploads(
  eventId: string,
  section: "documents" | "media" | "permissions" = "documents",
) {
  const { requireEvent } = await import("@/modules/events/server/workspace");
  await requireEvent(eventId);
  if (!["documents", "media", "permissions"].includes(section))
    throw new Error("Invalid upload section");
  await signIn(
    "google",
    { redirectTo: `/events/${encodeURIComponent(eventId)}/${section}` },
    {
      scope: `openid email profile ${DRIVE_WRITE_SCOPE}`,
      prompt: "consent select_account",
      access_type: "offline",
    },
  );
}

export async function enableDrivePreviews() {
  await requireDriveUser();
  await signIn(
    "google",
    { redirectTo: "/events" },
    {
      scope: `openid email profile ${DRIVE_METADATA_SCOPE} ${DRIVE_CONTENT_SCOPE}`,
      prompt: "consent",
      access_type: "offline",
    },
  );
}

export async function logoutGoogleDrive() {
  await signOut({ redirectTo: "/login" });
}

export async function selectDriveFolder(folderId: string) {
  try {
    const folder = await saveDriveFolder(folderId);
    revalidatePath(DRIVE_SETTINGS_PATH);
    return { success: true as const, folder };
  } catch (error) {
    return { success: false as const, error: driveErrorMessage(error) };
  }
}

export async function disconnectGoogleDrive() {
  try {
    await disconnectDrive();
  } catch {
    redirect(`${DRIVE_SETTINGS_PATH}?notice=disconnect-failed`);
  }
  revalidatePath(DRIVE_SETTINGS_PATH);
  redirect(DRIVE_SETTINGS_PATH);
}

export async function syncGoogleDrive() {
  try {
    const result = await syncDrive();
    revalidatePath(DRIVE_SETTINGS_PATH);
    return { success: true as const, result };
  } catch (error) {
    return { success: false as const, error: driveErrorMessage(error) };
  }
}
