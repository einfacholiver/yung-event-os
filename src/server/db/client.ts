import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnvSchema } from "@/config/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb() {
  if (!globalForPrisma.prisma) {
    const { DATABASE_URL } = serverEnvSchema
      .pick({ DATABASE_URL: true })
      .parse(process.env);
    globalForPrisma.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: DATABASE_URL }),
    });
  }
  return globalForPrisma.prisma;
}
