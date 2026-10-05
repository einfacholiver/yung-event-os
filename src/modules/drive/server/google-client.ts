import "server-only";
import { z } from "zod";
import { DRIVE_FOLDER_MIME, isAllowedGoogleIdentity } from "../config";
import { DriveError } from "../errors";
import {
  browseInputSchema,
  driveFileSchema,
  driveListSchema,
  folderIdSchema,
  type BrowseResult,
} from "../schemas";

export function validateUploadSession(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.googleapis.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/upload/drive/v3/files" ||
    !url.searchParams.get("upload_id")
  )
    throw new DriveError("UNAVAILABLE", 503);
  return url;
}

export async function googleJson(
  url: URL | string,
  token: string,
  request: typeof fetch = fetch,
) {
  let response: Response;
  try {
    response = await request(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new DriveError("UNAVAILABLE", 503);
  }
  if (!response.ok) {
    if (response.status === 401) throw new DriveError("RECONNECT", 401);
    if (response.status === 403) throw new DriveError("FORBIDDEN", 403);
    if (response.status === 404) throw new DriveError("NOT_FOUND", 404);
    if (response.status === 429) throw new DriveError("RATE_LIMIT", 429);
    throw new DriveError("UNAVAILABLE", 503);
  }
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new DriveError("UNAVAILABLE", 503);
  }
}

// The verified factory is the only way to obtain a client. No Drive request is
// made until Google's current identity matches the stored account subject.
export async function verifiedDriveClient(
  token: string,
  expectedSubject: string,
  request: typeof fetch = fetch,
) {
  const identity = await googleJson(
    "https://openidconnect.googleapis.com/v1/userinfo",
    token,
    request,
  );
  if (!isAllowedGoogleIdentity(identity) || identity.sub !== expectedSubject)
    throw new DriveError("FORBIDDEN", 403);

  async function getFile(id: string) {
    const parsed = folderIdSchema.safeParse(id);
    if (!parsed.success) throw new DriveError("INVALID_INPUT", 400);
    const url = new URL(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(parsed.data)}`,
    );
    url.searchParams.set(
      "fields",
      "id,name,mimeType,parents,trashed,modifiedTime,md5Checksum",
    );
    const result = driveFileSchema.safeParse(
      await googleJson(url, token, request),
    );
    if (!result.success) throw new DriveError("UNAVAILABLE", 503);
    if (result.data.trashed) throw new DriveError("NOT_FOUND", 404);
    return result.data;
  }

  async function folderPath(id: string) {
    const root = await getFile("root");
    const folder = id === "root" || id === root.id ? root : await getFile(id);
    if (folder.mimeType !== DRIVE_FOLDER_MIME)
      throw new DriveError("INVALID_INPUT", 400);
    const breadcrumbs: Array<{ id: string; name: string }> = [];
    let current = folder;
    const visited = new Set<string>();
    while (current.id !== root.id) {
      if (
        visited.has(current.id) ||
        visited.size >= 50 ||
        !current.parents?.[0]
      )
        throw new DriveError("INVALID_INPUT", 400);
      visited.add(current.id);
      if (current.mimeType !== DRIVE_FOLDER_MIME)
        throw new DriveError("INVALID_INPUT", 400);
      breadcrumbs.unshift({ id: current.id, name: current.name });
      current =
        current.parents[0] === root.id
          ? root
          : await getFile(current.parents[0]);
    }
    breadcrumbs.unshift({ id: root.id, name: "Meine Ablage" });
    return {
      folder: {
        ...folder,
        name: folder.id === root.id ? "Meine Ablage" : folder.name,
      },
      breadcrumbs,
      rootId: root.id,
    };
  }

  async function readContent(id: string, allowed: string[], limit: number) {
    const file = await getFile(id);
    if (!allowed.includes(file.mimeType))
      throw new DriveError("INVALID_INPUT", 400);
    const response = await request(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok || !response.body)
      throw new DriveError("UNAVAILABLE", 503);
    const type = response.headers.get("content-type")?.split(";")[0];
    if (!type || !allowed.includes(type))
      throw new DriveError("INVALID_INPUT", 400);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > limit) {
          await reader.cancel();
          throw new DriveError("INVALID_INPUT", 400);
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return { bytes, type };
  }

  return {
    folderPath,
    file: getFile,
    async beginResumable(input: {
      id: string;
      parentId: string;
      name: string;
      mimeType: string;
      size: number;
    }) {
      folderIdSchema.parse(input.id);
      folderIdSchema.parse(input.parentId);
      const response = await request(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Upload-Content-Type": input.mimeType,
            "X-Upload-Content-Length": String(input.size),
          },
          body: JSON.stringify({
            id: input.id,
            name: input.name,
            mimeType: input.mimeType,
            parents: [input.parentId],
          }),
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!response.ok) throw new DriveError("UNAVAILABLE", 503);
      const location = response.headers.get("location");
      if (!location) throw new DriveError("UNAVAILABLE", 503);
      return validateUploadSession(location).href;
    },
    async resumablePart(
      location: string,
      total: number,
      start?: number,
      bytes?: Uint8Array<ArrayBuffer>,
    ) {
      const url = validateUploadSession(location);
      if (
        !Number.isSafeInteger(total) ||
        total < 1 ||
        total > 100_000_000 ||
        (bytes &&
          (start === undefined ||
            !Number.isSafeInteger(start) ||
            start < 0 ||
            bytes.length < 1 ||
            bytes.length > 2_097_152 ||
            start + bytes.length > total ||
            (start + bytes.length < total && bytes.length % 262_144 !== 0)))
      )
        throw new DriveError("INVALID_INPUT", 400);
      const response = await request(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "Content-Range": bytes
            ? `bytes ${start}-${start! + bytes.length - 1}/${total}`
            : `bytes */${total}`,
        },
        body: bytes ? new Blob([bytes]) : new Uint8Array(),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 308) {
        const range = response.headers.get("range");
        if (range && !/^bytes=0-\d+$/.test(range))
          throw new DriveError("UNAVAILABLE", 503);
        const offset = range ? Number(range.slice(8)) + 1 : 0;
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > total)
          throw new DriveError("UNAVAILABLE", 503);
        return { offset, complete: false };
      }
      if (response.ok) return { offset: total, complete: true };
      throw new DriveError(
        response.status === 404 || response.status === 410
          ? "NOT_FOUND"
          : "UNAVAILABLE",
        response.status === 404 || response.status === 410 ? 404 : 503,
      );
    },
    async generateFileId() {
      const result = z
        .object({ ids: z.array(folderIdSchema).length(1) })
        .safeParse(
          await googleJson(
            "https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files",
            token,
            request,
          ),
        );
      if (!result.success) throw new DriveError("UNAVAILABLE", 503);
      return result.data.ids[0];
    },
    async uploadFile(input: {
      id: string;
      parentId: string;
      name: string;
      mimeType: string;
      bytes: Uint8Array<ArrayBuffer>;
      md5Checksum: string;
    }) {
      folderIdSchema.parse(input.id);
      folderIdSchema.parse(input.parentId);
      if (
        !input.name.trim() ||
        input.name.length > 200 ||
        !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(input.mimeType) ||
        input.bytes.length > 100_000_000
      )
        throw new DriveError("INVALID_INPUT", 400);
      const boundary = `yung_${crypto.randomUUID()}`;
      const metadata = {
        id: input.id,
        name: input.name,
        mimeType: input.mimeType,
        parents: [input.parentId],
      };
      const body = new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`,
        input.bytes,
        `\r\n--${boundary}--\r\n`,
      ]);
      let response: Response;
      try {
        if (input.bytes.length > 5_000_000) {
          response = await request(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,parents,modifiedTime,md5Checksum",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": input.mimeType,
                "X-Upload-Content-Length": String(input.bytes.length),
              },
              body: JSON.stringify(metadata),
              cache: "no-store",
              redirect: "error",
              signal: AbortSignal.timeout(15_000),
            },
          );
          if (response.ok) {
            const location = response.headers.get("location");
            if (!location) throw new DriveError("UNAVAILABLE", 503);
            const url = new URL(location);
            if (
              url.protocol !== "https:" ||
              url.hostname !== "www.googleapis.com" ||
              url.username ||
              url.password ||
              !url.pathname.startsWith("/upload/drive/v3/files")
            )
              throw new DriveError("UNAVAILABLE", 503);
            response = await request(url, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": input.mimeType,
              },
              body: new Blob([input.bytes]),
              cache: "no-store",
              redirect: "error",
              signal: AbortSignal.timeout(120_000),
            });
          }
        } else {
          response = await request(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,parents,modifiedTime,md5Checksum",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": `multipart/related; boundary=${boundary}`,
              },
              body,
              cache: "no-store",
              redirect: "error",
              signal: AbortSignal.timeout(60_000),
            },
          );
        }
      } catch {
        throw new DriveError("UNAVAILABLE", 503);
      }
      if (!response.ok && response.status !== 409)
        throw new DriveError(
          response.status === 401
            ? "RECONNECT"
            : response.status === 403
              ? "FORBIDDEN"
              : response.status === 429
                ? "RATE_LIMIT"
                : "UNAVAILABLE",
          response.status === 401
            ? 401
            : response.status === 403
              ? 403
              : response.status === 429
                ? 429
                : 503,
        );
      const file =
        response.status === 409
          ? await getFile(input.id)
          : driveFileSchema.parse(await response.json());
      if (
        file.id !== input.id ||
        file.name !== input.name ||
        file.mimeType !== input.mimeType ||
        file.parents?.[0] !== input.parentId ||
        file.md5Checksum !== input.md5Checksum ||
        file.trashed
      )
        throw new DriveError("FORBIDDEN", 403);
      return file;
    },
    async generateFolderIds() {
      const result = z
        .object({ ids: z.array(folderIdSchema).length(5) })
        .safeParse(
          await googleJson(
            "https://www.googleapis.com/drive/v3/files/generateIds?count=5&space=drive&type=files",
            token,
            request,
          ),
        );
      if (!result.success) throw new DriveError("UNAVAILABLE", 503);
      return result.data.ids;
    },
    async createFolder(id: string, parentId: string, name: string) {
      folderIdSchema.parse(id);
      folderIdSchema.parse(parentId);
      if (!name.trim() || name.length > 200)
        throw new DriveError("INVALID_INPUT", 400);
      let response: Response;
      try {
        response = await request(
          "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,parents",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id,
              name,
              mimeType: DRIVE_FOLDER_MIME,
              parents: [parentId],
            }),
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(15000),
          },
        );
      } catch {
        throw new DriveError("UNAVAILABLE", 503);
      }
      if (response.status === 409) {
        const existing = await getFile(id);
        if (
          existing.mimeType !== DRIVE_FOLDER_MIME ||
          existing.name !== name ||
          existing.parents?.[0] !== parentId
        )
          throw new DriveError("FORBIDDEN", 403);
        return existing;
      }
      if (!response.ok)
        throw new DriveError(
          response.status === 403
            ? "FORBIDDEN"
            : response.status === 401
              ? "RECONNECT"
              : "UNAVAILABLE",
          response.status === 403 ? 403 : response.status === 401 ? 401 : 503,
        );
      const folder = driveFileSchema.safeParse(await response.json());
      if (
        !folder.success ||
        folder.data.id !== id ||
        folder.data.mimeType !== DRIVE_FOLDER_MIME ||
        folder.data.parents?.[0] !== parentId ||
        folder.data.name !== name
      )
        throw new DriveError("UNAVAILABLE", 503);
      return folder.data;
    },
    async image(id: string) {
      return readContent(
        id,
        ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
        10_000_000,
      );
    },
    async pdf(id: string) {
      const result = await readContent(id, ["application/pdf"], 20_000_000);
      if (new TextDecoder().decode(result.bytes.slice(0, 5)) !== "%PDF-")
        throw new DriveError("INVALID_INPUT", 400);
      return result;
    },
    async browse(input: unknown): Promise<BrowseResult> {
      const parsed = browseInputSchema.safeParse(input);
      if (!parsed.success) throw new DriveError("INVALID_INPUT", 400);
      const { folder, breadcrumbs } = await folderPath(parsed.data.folderId);
      const url = new URL("https://www.googleapis.com/drive/v3/files");
      url.searchParams.set(
        "q",
        `'${folder.id}' in parents and trashed = false`,
      );
      url.searchParams.set(
        "fields",
        "nextPageToken,files(id,name,mimeType,parents,modifiedTime)",
      );
      url.searchParams.set("spaces", "drive");
      url.searchParams.set("corpora", "user");
      url.searchParams.set("pageSize", "100");
      url.searchParams.set("orderBy", "folder,name_natural");
      if (parsed.data.pageToken)
        url.searchParams.set("pageToken", parsed.data.pageToken);
      const list = driveListSchema.safeParse(
        await googleJson(url, token, request),
      );
      if (!list.success) throw new DriveError("UNAVAILABLE", 503);
      return { folder, breadcrumbs, ...list.data };
    },
  };
}
