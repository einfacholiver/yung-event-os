import "server-only";
import { cache } from "react";
import { getDb } from "@/server/db/client";

// Single-organization preview until authenticated organization selection exists.
// Never accept the organization from URL parameters or the browser.
const organizationSlug = "yung";

export const getEvents = cache(async () => {
  return getDb().event.findMany({
    where: { organization: { slug: organizationSlug } },
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
  return getDb().event.findFirst({
    where: { id, organization: { slug: organizationSlug } },
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
