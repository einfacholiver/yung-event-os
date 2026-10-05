import { md5 } from "hash-wasm";

type Progress = {
  offset: number;
  complete: boolean;
  chunkSize?: number;
  name: string;
  path: string;
};

export async function uploadInChunks(
  file: File,
  eventId: string,
  purpose: string,
  requestId: string,
  progress: (percent: number) => void,
  request: typeof fetch = fetch,
) {
  const bytes = await file.arrayBuffer();
  const [checksum, sha256] = await Promise.all([
    md5(new Uint8Array(bytes)),
    crypto.subtle
      .digest("SHA-256", bytes)
      .then((value) =>
        Array.from(new Uint8Array(value), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join(""),
      ),
  ]);
  const url = `/api/events/${encodeURIComponent(eventId)}/documents/upload`;
  async function result(response: Response): Promise<Progress> {
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(
        "Der Server konnte den Upload nicht verarbeiten. Bitte erneut versuchen.",
      );
    }
    if (!response.ok)
      throw new Error(
        body.error ?? "Upload fehlgeschlagen. Bitte erneut versuchen.",
      );
    return body;
  }
  let status = await result(
    await request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose,
        requestId,
        name: file.name,
        size: file.size,
        sha256,
        md5: checksum,
      }),
    }),
  );
  const chunkSize = status.chunkSize;
  if (
    !Number.isSafeInteger(status.offset) ||
    status.offset < 0 ||
    status.offset > file.size ||
    !chunkSize ||
    !Number.isSafeInteger(chunkSize) ||
    chunkSize < 262_144 ||
    chunkSize % 262_144 !== 0 ||
    chunkSize > 2_097_152
  )
    throw new Error("Ungültiger Upload-Fortschritt.");
  progress(Math.round((status.offset / file.size) * 100));
  while (!status.complete) {
    const offset = status.offset;
    const end = Math.min(offset + chunkSize, file.size);
    status = await result(
      await request(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Upload-Id": requestId,
          "X-Upload-Offset": String(offset),
        },
        body: file.slice(offset, end),
      }),
    );
    if (
      status.offset !== end ||
      (status.complete && end !== file.size) ||
      (!status.complete && status.offset === file.size)
    )
      throw new Error(
        "Upload-Fortschritt konnte nicht bestätigt werden. Bitte erneut versuchen.",
      );
    progress(Math.round((status.offset / file.size) * 100));
  }
  return status;
}
