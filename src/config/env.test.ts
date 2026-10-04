import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

const valid = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  AUTH_SECRET: "x".repeat(32),
};

describe("server environment", () => {
  it("accepts valid PostgreSQL settings", () => {
    expect(parseServerEnv(valid)).toEqual(valid);
  });
  it.each([
    {},
    { ...valid, AUTH_SECRET: "short" },
    { ...valid, DATABASE_URL: "https://example.com" },
    { ...valid, AUTH_URL: "invalid" },
  ])("rejects invalid configuration", (input) => {
    expect(() => parseServerEnv(input)).toThrow();
  });
});
