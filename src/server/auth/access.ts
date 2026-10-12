import "server-only";
import type { Session } from "next-auth";
import { cache } from "react";
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
  // Let PostgreSQL check the relationships with EXISTS in one query instead
  // of loading organization/account records in separate round trips.
  const user = await getDb().user.findFirst({
    where: {
      id: session.user.id,
      email: ADMIN_EMAIL,
      organization: { slug: "yung" },
      accounts: {
        some: { provider: "google", providerAccountId: { not: "" } },
      },
    },
    select: { id: true, organizationId: true },
  });
  if (!user || !user.organizationId) {
    throw new AccessError(403);
  }
  return { userId: user.id, organizationId: user.organizationId };
}

// React memoizes only within a server render, never across users or requests.
export const requireAdmin = cache(async () => {
  return verifyAdminSession(await auth());
});

export async function requireAdminPage() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AccessError) redirect(LOGIN_PATH);
    throw error;
  }
}
