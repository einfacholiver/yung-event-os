import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // Avoid simultaneous worker cold starts overwhelming a Windows/network drive.
    maxWorkers: 4,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/database/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/config/**/*.ts",
        "src/lib/**/*.ts",
        "src/components/**/*.tsx",
      ],
    },
  },
});
