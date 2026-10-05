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
  it("probes and resumes Google's confirmed byte range without exposing the access token", async () => {
    const request = requestWith(identity);
    request.mockResolvedValueOnce(
      new Response(null, {
        status: 308,
        headers: { Range: "bytes=0-2097151" },
      }),
    );
    request.mockResolvedValueOnce(Response.json({ id: "done" }));
    const client = await verifiedDriveClient("token", identity.sub, request);
    const location =
      "https://www.googleapis.com/upload/drive/v3/files?upload_id=session";
    expect(await client.resumablePart(location, 2_097_160)).toEqual({
      offset: 2_097_152,
      complete: false,
    });
    expect(
      await client.resumablePart(
        location,
        2_097_160,
        2_097_152,
        new Uint8Array(8),
      ),
    ).toEqual({ offset: 2_097_160, complete: true });
    expect(request.mock.calls[1][1]?.headers).toMatchObject({
      "Content-Range": "bytes */2097160",
    });
    expect(request.mock.calls[2][1]?.headers).toMatchObject({
      "Content-Range": "bytes 2097152-2097159/2097160",
    });
  });
  it("rejects foreign upload URLs and oversized or unaligned non-final chunks before sending credentials", async () => {
    const request = requestWith(identity);
    const client = await verifiedDriveClient("token", identity.sub, request);
    await expect(
      client.resumablePart(
        "https://other.example/upload",
        4_000_000,
        0,
        new Uint8Array(262_144),
      ),
    ).rejects.toBeDefined();
    const location =
      "https://www.googleapis.com/upload/drive/v3/files?upload_id=session";
    await expect(
      client.resumablePart(location, 4_000_000, 0, new Uint8Array(2_097_153)),
    ).rejects.toBeDefined();
    await expect(
      client.resumablePart(location, 4_000_000, 0, new Uint8Array(10)),
    ).rejects.toBeDefined();
    expect(request).toHaveBeenCalledOnce();
  });
  it("uses Google's upload session for files over 5 MB and refuses a foreign session URL", async () => {
    const uploaded = {
      id: "video-id",
      name: "clip.mp4",
      mimeType: "video/mp4",
      parents: ["media"],
      md5Checksum: "checksum",
    };
    const request = requestWith(identity);
    request
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: {
            location:
              "https://www.googleapis.com/upload/drive/v3/files?upload_id=session",
          },
        }),
      )
      .mockResolvedValueOnce(Response.json(uploaded));
    const client = await verifiedDriveClient("token", identity.sub, request);
    const input = {
      id: "video-id",
      parentId: "media",
      name: "clip.mp4",
      mimeType: "video/mp4",
      bytes: new Uint8Array(5_000_001),
      md5Checksum: "checksum",
    };
    expect(await client.uploadFile(input)).toEqual(uploaded);
    expect(request.mock.calls[1][1]?.method).toBe("POST");
    expect(String(request.mock.calls[1][0])).toContain("uploadType=resumable");
    expect(request.mock.calls[2][1]?.method).toBe("PUT");
    request.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: { location: "https://other.example/upload" },
      }),
    );
    await expect(client.uploadFile(input)).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
    expect(request).toHaveBeenCalledTimes(4);
  });
  it("uploads exact bytes under the requested parent and validates the returned checksum", async () => {
    const uploaded = {
      id: "file-id",
      name: "invoice.pdf",
      mimeType: "application/pdf",
      parents: ["expenses"],
      md5Checksum: "checksum",
    };
    const request = requestWith(identity, uploaded);
    const client = await verifiedDriveClient("token", identity.sub, request);
    const bytes = new TextEncoder().encode("%PDF-test");
    expect(
      await client.uploadFile({
        id: "file-id",
        parentId: "expenses",
        name: "invoice.pdf",
        mimeType: "application/pdf",
        bytes,
        md5Checksum: "checksum",
      }),
    ).toEqual(uploaded);
    const init = request.mock.calls[1][1];
    expect(init?.method).toBe("POST");
    expect(String(request.mock.calls[1][0])).toContain("uploadType=multipart");
    const body = await (init!.body as Blob).text();
    expect(body).toContain('"parents":["expenses"]');
    expect(body).toContain("%PDF-test");
  });
  it("recovers an already created upload ID but refuses a different parent or content", async () => {
    const request = requestWith(identity);
    const uploaded = {
      id: "file-id",
      name: "invoice.pdf",
      mimeType: "application/pdf",
      parents: ["expenses"],
      md5Checksum: "checksum",
    };
    const client = await verifiedDriveClient("token", identity.sub, request);
    const input = {
      id: "file-id",
      parentId: "expenses",
      name: "invoice.pdf",
      mimeType: "application/pdf",
      bytes: new TextEncoder().encode("%PDF-test"),
      md5Checksum: "checksum",
    };
    request
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(Response.json(uploaded));
    expect(await client.uploadFile(input)).toEqual(uploaded);
    request
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(
        Response.json({ ...uploaded, md5Checksum: "different-content" }),
      );
    await expect(client.uploadFile(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("creates only the requested folder with a stable ID and explicit parent", async () => {
    const created = {
      id: "new-folder-id",
      name: "YUNG Chapter Five",
      mimeType: DRIVE_FOLDER_MIME,
      parents: ["events-root"],
    };
    const request = requestWith(identity, created);
    const client = await verifiedDriveClient("token", identity.sub, request);
    expect(
      await client.createFolder(created.id, "events-root", created.name),
    ).toEqual(created);
    const init = request.mock.calls[1][1];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(created);
    expect(String(request.mock.calls[0][0])).toContain("/userinfo");
  });
  it("reuses a known ID after a timeout and refuses a conflicting parent", async () => {
    const folder = {
      id: "new-folder-id",
      name: "YUNG Chapter Five",
      mimeType: DRIVE_FOLDER_MIME,
      parents: ["events-root"],
    };
    const request = requestWith(identity);
    request.mockResolvedValueOnce(new Response(null, { status: 409 }));
    request.mockResolvedValueOnce(Response.json(folder));
    const client = await verifiedDriveClient("token", identity.sub, request);
    expect(
      await client.createFolder(folder.id, "events-root", folder.name),
    ).toEqual(folder);
    request.mockResolvedValueOnce(new Response(null, { status: 409 }));
    request.mockResolvedValueOnce(
      Response.json({ ...folder, parents: ["another-root"] }),
    );
    await expect(
      client.createFolder(folder.id, "events-root", folder.name),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("reads a PDF only after identity verification and matching MIME metadata", async () => {
    const request = requestWith(identity, {
      id: "invoice-id",
      name: "invoice.pdf",
      mimeType: "application/pdf",
    });
    request.mockResolvedValueOnce(
      new Response("%PDF-1.7\nexample", {
        headers: { "content-type": "application/pdf" },
      }),
    );
    const client = await verifiedDriveClient("token", identity.sub, request);
    const pdf = await client.pdf("invoice-id");
    expect(pdf.type).toBe("application/pdf");
    expect(new TextDecoder().decode(pdf.bytes)).toContain("%PDF-");
    expect(String(request.mock.calls[0][0])).toContain("/userinfo");
    expect(String(request.mock.calls[2][0])).toContain("alt=media");
  });
  it("rejects non-PDF metadata before reading contents", async () => {
    const request = requestWith(identity, {
      id: "invoice-id",
      name: "wrong.html",
      mimeType: "text/html",
    });
    const client = await verifiedDriveClient("token", identity.sub, request);
    await expect(client.pdf("invoice-id")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(request).toHaveBeenCalledTimes(2);
  });
  it.each(["not a PDF", "%PDF-1.7".padEnd(20_000_001, "x")])(
    "rejects malformed or oversized PDF contents",
    async (body) => {
      const request = requestWith(identity, {
        id: "invoice-id",
        name: "invoice.pdf",
        mimeType: "application/pdf",
      });
      request.mockResolvedValueOnce(
        new Response(body, { headers: { "content-type": "application/pdf" } }),
      );
      const client = await verifiedDriveClient("token", identity.sub, request);
      await expect(client.pdf("invoice-id")).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
    },
  );
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
