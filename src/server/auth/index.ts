import "server-only";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { getDb } from "@/server/db/client";
import { googleEnvSchema } from "@/config/env";
import { encryptToken } from "./token-cipher";
import {
  DRIVE_ACCOUNT_EMAIL,
  DRIVE_METADATA_SCOPE,
  DRIVE_SETTINGS_PATH,
  hasDriveScope,
  isAllowedGoogleIdentity,
} from "@/modules/drive/config";

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = googleEnvSchema.parse(process.env);
  const db = getDb();
  const adapter = PrismaAdapter(db);
  return {
    adapter: {
      ...adapter,
      async linkAccount(account) {
        await adapter.linkAccount!({
          ...account,
          access_token: account.access_token
            ? encryptToken(account.access_token)
            : undefined,
          refresh_token: account.refresh_token
            ? encryptToken(account.refresh_token)
            : undefined,
          // ID tokens are validated by Auth.js and are not needed in storage.
          id_token: undefined,
        });
      },
    },
    secret: env.AUTH_SECRET,
    session: { strategy: "database" },
    pages: { signIn: DRIVE_SETTINGS_PATH, error: DRIVE_SETTINGS_PATH },
    providers: [
      Google({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        authorization: {
          params: {
            scope: `openid email profile ${DRIVE_METADATA_SCOPE}`,
            access_type: "offline",
            prompt: "consent select_account",
            login_hint: DRIVE_ACCOUNT_EMAIL,
          },
        },
        checks: ["pkce", "state", "nonce"],
      }),
    ],
    callbacks: {
      async signIn({ account, profile }) {
        return (
          account?.provider === "google" &&
          isAllowedGoogleIdentity(profile) &&
          hasDriveScope(account.scope)
        );
      },
      async session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
    },
    events: {
      async signIn({ user, account, profile }) {
        if (
          !user.id ||
          !account ||
          account.provider !== "google" ||
          !isAllowedGoogleIdentity(profile) ||
          !hasDriveScope(account.scope)
        )
          throw new Error("Google identity rejected.");
        await db.$transaction(async (tx) => {
          const organization = await tx.organization.findUniqueOrThrow({
            where: { slug: "yung" },
          });
          const existing = await tx.user.findUniqueOrThrow({
            where: { id: user.id },
          });
          if (
            existing.organizationId &&
            existing.organizationId !== organization.id
          )
            throw new Error("Organization mismatch.");
          await tx.user.update({
            where: { id: user.id },
            data: { organizationId: organization.id },
          });
          const saved = await tx.account.update({
            where: {
              provider_providerAccountId: {
                provider: "google",
                providerAccountId: account.providerAccountId,
              },
            },
            data: {
              access_token: account.access_token
                ? encryptToken(account.access_token)
                : undefined,
              refresh_token: account.refresh_token
                ? encryptToken(account.refresh_token)
                : undefined,
              expires_at: account.expires_at,
              scope: account.scope,
              id_token: null,
            },
          });
          await tx.driveConnection.upsert({
            where: {
              organizationId_accountEmail: {
                organizationId: organization.id,
                accountEmail: DRIVE_ACCOUNT_EMAIL,
              },
            },
            create: {
              organizationId: organization.id,
              accountEmail: DRIVE_ACCOUNT_EMAIL,
              googleAccountId: saved.id,
              status: "CONNECTED",
            },
            update: { googleAccountId: saved.id, status: "CONNECTED" },
          });
        });
      },
    },
    // Never log provider responses or token-bearing error metadata.
    logger: {
      error() {
        console.error(
          "Authentication failed; reconnect from Google Drive settings.",
        );
      },
      warn(code) {
        console.warn("Authentication warning:", code);
      },
      debug() {},
    },
  };
});
