import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Local secrets override .env; existing process variables retain priority.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: {
    url:
      process.env.DIRECT_DATABASE_URL?.trim() ||
      process.env.DATABASE_URL ||
      "postgresql://yung:yung_local@localhost:5432/yung_event_os?schema=public",
  },
});
