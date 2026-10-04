import "server-only";
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";

// Lazy initialization keeps builds independent of runtime secrets and PostgreSQL.
// Configure a provider deliberately when the login requirements are defined.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getServerEnv();
  return {
    adapter: PrismaAdapter(getDb()),
    secret: env.AUTH_SECRET,
    session: { strategy: "database" },
    providers: [],
  };
});
