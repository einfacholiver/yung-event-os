import "server-only";
import { requireDriveUser } from "@/modules/drive/server/context";
import { getDb } from "@/server/db/client";
import { notFound, redirect } from "next/navigation";
import { DriveError } from "@/modules/drive/errors";

export async function requireEvent(id: string) {
  const user = await requireDriveUser().catch((error: unknown) => {
    if (error instanceof DriveError && error.status === 401) redirect("/login");
    throw error;
  });
  const event = await getDb().event.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!event) notFound();
  return { user, event };
}
