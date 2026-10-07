import "server-only";
import { cache } from "react";
import { AccessError, requireAdmin } from "@/server/auth/access";
import { getDb } from "@/server/db/client";
import { DRIVE_ACCOUNT_EMAIL } from "../config";
import { DriveError } from "../errors";

export async function requireDriveUser() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AccessError)
      throw new DriveError(
        error.status === 401 ? "SIGN_IN" : "FORBIDDEN",
        error.status,
      );
    throw error;
  }
}

export const getDriveConnection = cache(async () => {
  const context = await requireDriveUser();
  const connection = await getDb().driveConnection.findUnique({
    where: {
      organizationId_accountEmail: {
        organizationId: context.organizationId,
        accountEmail: DRIVE_ACCOUNT_EMAIL,
      },
    },
    include: { googleAccount: true },
  });
  if (
    !connection ||
    connection.status !== "CONNECTED" ||
    !connection.googleAccount ||
    connection.googleAccount.userId !== context.userId ||
    connection.googleAccount.provider !== "google"
  )
    throw new DriveError("RECONNECT", 401);
  return { ...context, connection, account: connection.googleAccount };
});
