import "server-only";
import { parseServerEnv } from "@/config/env";

export function getServerEnv() {
  return parseServerEnv(process.env);
}
