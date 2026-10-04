import type { PrismaClient } from "../src/generated/prisma/client";
import { seedEvents, seedOrganization } from "./seed-data";

// One transaction, stable natural keys, no changes to existing records.
export async function seedCoreData(prisma: PrismaClient) {
  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.upsert({
      where: { slug: seedOrganization.slug },
      create: seedOrganization,
      update: {},
    });

    for (const event of seedEvents) {
      await tx.event.upsert({
        where: {
          organizationId_slug: {
            organizationId: organization.id,
            slug: event.slug,
          },
        },
        create: { ...event, organizationId: organization.id },
        update: {},
      });
    }
    return organization;
  });
}
