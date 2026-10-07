import "server-only";
import { requireDriveUser } from "@/modules/drive/server/context";
import { notFound, redirect } from "next/navigation";
import { DriveError } from "@/modules/drive/errors";
import { getEvent } from "./queries";

export async function requireEvent(id: string) {
  const user = await requireDriveUser().catch((error: unknown) => {
    if (error instanceof DriveError && error.status === 401) redirect("/login");
    throw error;
  });
  const event = await getEvent(id);
  if (!event) notFound();
  return { user, event };
}
