"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/server/auth";
import { DRIVE_SETTINGS_PATH } from "./config";
import { driveErrorMessage } from "./errors";
import { saveDriveFolder, disconnectDrive, syncDrive } from "./server/service";

export async function connectGoogleDrive() {
  await signIn("google", { redirectTo: DRIVE_SETTINGS_PATH });
}

export async function logoutGoogleDrive() {
  await signOut({ redirectTo: DRIVE_SETTINGS_PATH });
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
