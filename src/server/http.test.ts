// @vitest-environment node
import { expect, it } from "vitest";
import { requireSameOrigin } from "./http";
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
