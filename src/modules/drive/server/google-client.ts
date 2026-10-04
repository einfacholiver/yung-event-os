import "server-only";
import { DRIVE_FOLDER_MIME, isAllowedGoogleIdentity } from "../config";
import { DriveError } from "../errors";
import {
  browseInputSchema,
  driveFileSchema,
  driveListSchema,
  folderIdSchema,
  type BrowseResult,
} from "../schemas";

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
      "id,name,mimeType,parents,trashed,modifiedTime",
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

  return {
    folderPath,
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
