// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/modules/drive/server/context", () => ({
  requireDriveUser: mocks.requireUser,
}));
vi.mock("@/modules/drive/server/mapping", () => ({
  saveDriveMapping: mocks.save,
}));
import { POST } from "./route";

beforeEach(() => vi.clearAllMocks());

it.each([
  undefined,
  "null",
  "https://attacker.invalid",
  "http://event.example",
  "not-a-url",
])(
  "rejects unsafe Origin %s before authorization, parsing or mapping writes",
  async (origin) => {
    const response = await POST(
      new Request(
        "https://event.example/api/integrations/google-drive/mapping",
        {
          method: "POST",
          headers: { host: "event.example", ...(origin ? { origin } : {}) },
          body: "invalid form must never be parsed",
        },
      ),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  },
);

it("allows a same-origin mapping through the existing authorization and service", async () => {
  const body = new FormData();
  body.set("eventId", "event");
  body.set("purpose", "EXPENSES");
  body.set("driveItemId", "folder");
  const response = await POST(
    new Request("https://event.example/api/integrations/google-drive/mapping", {
      method: "POST",
      headers: { origin: "https://event.example" },
      body,
    }),
  );
  expect(response.status).toBe(200);
  expect(mocks.requireUser).toHaveBeenCalledOnce();
  expect(mocks.save).toHaveBeenCalledWith({
    eventId: "event",
    purpose: "EXPENSES",
    driveItemId: "folder",
  });
});
