// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { decryptToken, encryptToken } from "./token-cipher";
beforeEach(() => vi.stubEnv("AUTH_SECRET", "test-secret-".repeat(4)));
afterEach(() => vi.unstubAllEnvs());

it("encrypts randomly and decrypts without exposing plaintext in storage", () => {
  const first = encryptToken("test-google-token");
  expect(first).not.toContain("test-google-token");
  expect(encryptToken("test-google-token")).not.toBe(first);
  expect(decryptToken(first)).toBe("test-google-token");
});
it("rejects modified ciphertext, plaintext and a different key", () => {
  const token = encryptToken("test-google-token");
  const parts = token.split(".");
  parts[2] = "AAAAAAAAAAAAAAAAAAAAAA";
  expect(() => decryptToken(parts.join("."))).toThrow();
  expect(() => decryptToken("unencrypted-token")).toThrow();
  vi.stubEnv("AUTH_SECRET", "different-secret-".repeat(4));
  expect(() => decryptToken(token)).toThrow();
});
