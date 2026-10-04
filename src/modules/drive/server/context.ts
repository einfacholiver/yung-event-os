import "server-only";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { DRIVE_ACCOUNT_EMAIL } from "../config";
import { DriveError } from "../errors";

export async function requireDriveUser() {
  const session = await auth();
  if (!session?.user?.id) throw new DriveError("SIGN_IN", 401);
  const user = await getDb().user.findUnique({
    where: { id: session.user.id },
    include: { organization: true },
  });
  if (
    !user ||
    user.email !== DRIVE_ACCOUNT_EMAIL ||
    !user.organizationId ||
    user.organization?.slug !== "yung"
  )
    throw new DriveError("FORBIDDEN", 403);
  return { userId: user.id, organizationId: user.organizationId };
}

export async function getDriveConnection() {
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
}
