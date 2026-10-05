import "server-only";
import { cache } from "react";
import { getDb } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/access";

export const getEvents = cache(async () => {
  const { organizationId } = await requireAdmin();
  return getDb().event.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: "asc" }, { slug: "asc" }],
    select: {
      id: true,
      name: true,
      status: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      location: true,
      description: true,
    },
  });
});

export const getEvent = cache(async (id: string) => {
  const { organizationId } = await requireAdmin();
  return getDb().event.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      location: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      organization: { select: { name: true } },
    },
  });
});
