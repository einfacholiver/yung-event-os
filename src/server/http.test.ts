// @vitest-environment node
import { expect, it } from "vitest";
import { requireSameOrigin, mutationError } from "./http";
import { DriveError } from "@/modules/drive/errors";
it("returns a useful missing-record error without exposing internals or caching it", async () => {
  const response = mutationError(new DriveError("NOT_FOUND", 404));
  expect(response.status).toBe(404);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({
    error: "Datensatz oder Dokument nicht gefunden.",
  });
});
it("blocks missing, null and foreign origins for mutations", () => {
  for (const origin of [null, "null", "https://evil.example"]) {
    const headers = origin ? { origin } : undefined;
    expect(() =>
      requireSameOrigin(
        new Request("http://localhost:3000/api/tasks", {
          method: "POST",
          headers,
        }),
      ),
    ).toThrow();
  }
  expect(() =>
    requireSameOrigin(
      new Request("http://localhost:3000/api/tasks", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      }),
    ),
  ).not.toThrow();
});
