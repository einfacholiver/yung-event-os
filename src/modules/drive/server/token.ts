import "server-only";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { googleEnvSchema } from "@/config/env";
import { decryptToken, encryptToken } from "@/server/auth/token-cipher";
import { hasDriveScope } from "../config";
import { DriveError } from "../errors";
import { getDriveConnection } from "./context";

const refreshSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

export async function getDriveCredentials() {
  const context = await getDriveConnection();
  const { account, connection } = context;
  if (!hasDriveScope(account.scope) || !account.access_token)
    throw new DriveError("RECONNECT", 401);
  try {
    if (
      account.expires_at &&
      account.expires_at > Math.floor(Date.now() / 1000) + 60
    ) {
      return { ...context, token: decryptToken(account.access_token) };
    }
    if (!account.refresh_token) throw new DriveError("RECONNECT", 401);
    const env = googleEnvSchema.parse(process.env);
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: decryptToken(account.refresh_token),
      }),
    });
    if (!response.ok)
      throw new DriveError(
        response.status === 400 || response.status === 401
          ? "RECONNECT"
          : "UNAVAILABLE",
        response.status === 400 || response.status === 401 ? 401 : 503,
      );
    const parsed = refreshSchema.safeParse(await response.json());
    if (!parsed.success) throw new DriveError("RECONNECT", 401);
    const tokens = parsed.data;
    if (tokens.scope && !hasDriveScope(tokens.scope))
      throw new DriveError("RECONNECT", 401);
    // Compare-and-swap prevents a late refresh from undoing Disconnect/reconnect.
    const saved = await getDb().account.updateMany({
      where: {
        id: account.id,
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        driveConnections: { some: { id: connection.id, status: "CONNECTED" } },
      },
      data: {
        access_token: encryptToken(tokens.access_token),
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
        refresh_token: tokens.refresh_token
          ? encryptToken(tokens.refresh_token)
          : undefined,
        scope: tokens.scope ?? account.scope,
      },
    });
    if (saved.count !== 1) throw new DriveError("RECONNECT", 401);
    return { ...context, token: tokens.access_token };
  } catch (error) {
    if (error instanceof DriveError) throw error;
    throw new DriveError("RECONNECT", 401);
  }
}
