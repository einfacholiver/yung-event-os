// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { verifiedDriveClient } from "./google-client";
import { DRIVE_ACCOUNT_EMAIL, DRIVE_FOLDER_MIME } from "../config";

const identity = {
  email: DRIVE_ACCOUNT_EMAIL,
  email_verified: true,
  sub: "subject-1",
};
const root = {
  id: "my-root-id",
  name: "My Drive",
  mimeType: DRIVE_FOLDER_MIME,
};
const folder = {
  id: "events-folder-id",
  name: "Veranstaltungen",
  mimeType: DRIVE_FOLDER_MIME,
  parents: [root.id],
};
function requestWith(...bodies: unknown[]) {
  const request = vi.fn<typeof fetch>();
  for (const body of bodies) request.mockResolvedValueOnce(Response.json(body));
  return request;
}

describe("verified Drive browser", () => {
  it.each([
    { ...identity, email: "other@gmail.com" },
    { ...identity, email_verified: false },
    { ...identity, sub: "other-subject" },
  ])("never accesses Drive for a mismatched identity", async (profile) => {
    const request = requestWith(profile);
    await expect(
      verifiedDriveClient("token", identity.sub, request),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(request).toHaveBeenCalledTimes(1);
    expect(String(request.mock.calls[0][0])).toContain("/userinfo");
  });
  it("browses by parent ID, includes files, and preserves pagination", async () => {
    const request = requestWith(identity, root, folder, {
      files: [
        { id: "invoice-id", name: "Rechnung.pdf", mimeType: "application/pdf" },
      ],
      nextPageToken: "page-two",
    });
    const client = await verifiedDriveClient("token", identity.sub, request);
    const result = await client.browse({
      folderId: folder.id,
      pageToken: "page-one",
    });
    expect(result.breadcrumbs).toEqual([
      { id: root.id, name: "Meine Ablage" },
      { id: folder.id, name: folder.name },
    ]);
    expect(result.files[0].name).toBe("Rechnung.pdf");
    expect(result.nextPageToken).toBe("page-two");
    const url = new URL(String(request.mock.calls.at(-1)![0]));
    expect(url.searchParams.get("q")).toBe(
      "'events-folder-id' in parents and trashed = false",
    );
    expect(url.searchParams.get("pageToken")).toBe("page-one");
    expect(request.mock.calls.at(-1)![1]?.cache).toBe("no-store");
  });
  it("shows an empty folder without inventing data", async () => {
    const request = requestWith(identity, root, { files: [] });
    const client = await verifiedDriveClient("token", identity.sub, request);
    expect((await client.browse({ folderId: "root" })).files).toEqual([]);
  });
  it("rejects query injection before a Drive request", async () => {
    const request = requestWith(identity);
    const client = await verifiedDriveClient("token", identity.sub, request);
    await expect(
      client.browse({ folderId: "x' or trashed=true" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...folder, mimeType: "application/pdf" },
    { ...folder, mimeType: "application/vnd.google-apps.shortcut" },
    { ...folder, parents: [] },
  ])(
    "rejects files, shortcuts and folders outside My Drive",
    async (invalid) => {
      const request = requestWith(identity, root, invalid);
      const client = await verifiedDriveClient("token", identity.sub, request);
      await expect(client.folderPath(folder.id)).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
    },
  );
  it.each([
    [401, "RECONNECT"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [429, "RATE_LIMIT"],
    [500, "UNAVAILABLE"],
  ])(
    "maps API status %s without exposing the response",
    async (status, code) => {
      const request = requestWith(identity);
      request.mockResolvedValueOnce(
        new Response("sensitive provider response", { status: Number(status) }),
      );
      const client = await verifiedDriveClient("token", identity.sub, request);
      await expect(client.folderPath("root")).rejects.toMatchObject({
        code,
        message: code,
      });
    },
  );
});
