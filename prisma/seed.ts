import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { serverEnvSchema } from "../src/config/env";
import { seedCoreData } from "./seed-core";

// Local secrets override .env; existing process variables retain priority.
config({ path: [".env.local", ".env"], quiet: true });

const { DATABASE_URL } = serverEnvSchema
  .pick({ DATABASE_URL: true })
  .parse(process.env);
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

try {
  await seedCoreData(prisma);
  console.info("YUNG organization and five draft events are present.");
} finally {
  await prisma.$disconnect();
}
