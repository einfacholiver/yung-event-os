import { z } from "zod";

export const serverEnvSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine(
      (value) => /^postgres(ql)?:\/\//.test(value),
      "Must be a PostgreSQL URL",
    ),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.url().optional(),
});

export function parseServerEnv(input: Record<string, unknown>) {
  return serverEnvSchema.parse(input);
}

export const googleEnvSchema = serverEnvSchema.extend({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});
