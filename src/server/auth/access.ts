import "server-only";
import type { Session } from "next-auth";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { redirect } from "next/navigation";
import { ADMIN_EMAIL, LOGIN_PATH } from "./policy";

export class AccessError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? "SIGN_IN" : "FORBIDDEN");
  }
}

export async function verifyAdminSession(session: Session | null) {
  if (!session?.user?.id) throw new AccessError(401);
  const user = await getDb().user.findUnique({
    where: { id: session.user.id },
    include: {
      organization: true,
      accounts: { select: { provider: true, providerAccountId: true } },
    },
  });
  if (
    !user ||
    user.email !== ADMIN_EMAIL ||
    !user.organizationId ||
    user.organization?.slug !== "yung" ||
    !user.accounts.some(
      (account) => account.provider === "google" && !!account.providerAccountId,
    )
  ) {
    throw new AccessError(403);
  }
  return { userId: user.id, organizationId: user.organizationId };
}

export async function requireAdmin() {
  return verifyAdminSession(await auth());
}

export async function requireAdminPage() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AccessError) redirect(LOGIN_PATH);
    throw error;
  }
}
