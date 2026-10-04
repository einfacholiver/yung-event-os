import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { seedCoreData } from "../../prisma/seed-core";
import { seedEvents } from "../../prisma/seed-data";

// Only run against a dedicated disposable test database.
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test")) {
  throw new Error(
    "TEST_DATABASE_URL must reference a dedicated database whose name ends in _test.",
  );
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

test("seed is repeatable and preserves existing event edits", async () => {
  try {
    const organization = await seedCoreData(prisma);
    const first = await prisma.event.findMany({
      where: { organizationId: organization.id },
      orderBy: { slug: "asc" },
    });
    assert.deepEqual(
      first.map((event) => event.slug).sort(),
      seedEvents.map((event) => event.slug).sort(),
    );
    assert.equal(first.length, 5);
    assert.ok(
      first.every(
        (event) => event.status === "DRAFT" && event.startsAt === null,
      ),
    );
    await prisma.event.update({
      where: { id: first[0].id },
      data: { description: "Keep this edit", status: "PLANNED" },
    });
    await seedCoreData(prisma);
    const second = await prisma.event.findMany({
      where: { organizationId: organization.id },
      orderBy: { slug: "asc" },
    });
    assert.deepEqual(
      second.map((event) => event.id),
      first.map((event) => event.id),
    );
    assert.equal(second[0].description, "Keep this edit");
    assert.equal(second[0].status, "PLANNED");
    assert.equal(
      await prisma.organization.count({ where: { slug: "yung" } }),
      1,
    );
    // Restore the draft record, making this verification itself repeatable.
    await prisma.event.update({
      where: { id: first[0].id },
      data: { description: first[0].description, status: first[0].status },
    });
  } finally {
    await prisma.$disconnect();
  }
});
