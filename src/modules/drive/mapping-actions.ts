"use server";
import { revalidatePath } from "next/cache";
import { getDriveMappings, saveDriveMapping } from "./server/mapping";
import { driveErrorMessage } from "./errors";

export async function saveMappingAction(formData: FormData) {
  try {
    await saveDriveMapping({
      eventId: String(formData.get("eventId") ?? ""),
      purpose: String(formData.get("purpose") ?? ""),
      driveItemId: String(formData.get("driveItemId") ?? ""),
    });
    revalidatePath("/settings/integrations/google-drive/mapping");
  } catch (error) {
    const message = driveErrorMessage(error);
    revalidatePath(
      `/settings/integrations/google-drive/mapping?error=${encodeURIComponent(message)}`,
    );
  }
}

export { getDriveMappings };
