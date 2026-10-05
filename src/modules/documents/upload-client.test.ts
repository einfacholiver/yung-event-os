// @vitest-environment node
import { expect, it, vi } from "vitest";
import { uploadInChunks } from "./upload-client";

it("resumes confirmed bytes and sends only bounded chunks to the app", async () => {
  const file = new File([new Uint8Array(5_000_000)], "video.mp4");
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({
        offset: 2_097_152,
        complete: false,
        chunkSize: 2_097_152,
      }),
    )
    .mockResolvedValueOnce(
      Response.json({ offset: 4_194_304, complete: false }),
    )
    .mockResolvedValueOnce(
      Response.json({
        offset: file.size,
        complete: true,
        name: file.name,
        path: "Media",
      }),
    );
  const progress = vi.fn();
  const result = await uploadInChunks(
    file,
    "event",
    "MEDIA",
    "request-id",
    progress,
    request,
  );
  expect(result.complete).toBe(true);
  expect(request).toHaveBeenCalledTimes(3);
  const descriptor = JSON.parse(String(request.mock.calls[0][1]?.body));
  expect(descriptor.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(descriptor.md5).toMatch(/^[a-f0-9]{32}$/);
  expect(request.mock.calls[1][1]?.headers).toMatchObject({
    "X-Upload-Offset": "2097152",
  });
  for (const [url, init] of request.mock.calls.slice(1)) {
    expect(url).toBe("/api/events/event/documents/upload");
    expect((init?.body as Blob).size).toBeLessThanOrEqual(2_097_152);
  }
  expect(progress).toHaveBeenLastCalledWith(100);
});

it("does not send an endless zero-byte chunk if completion is unconfirmed", async () => {
  const file = new File(["bytes"], "file.txt");
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({ offset: 0, complete: false, chunkSize: 2_097_152 }),
    )
    .mockResolvedValueOnce(
      Response.json({ offset: file.size, complete: false }),
    );
  await expect(
    uploadInChunks(file, "event", "INCOME", "id", vi.fn(), request),
  ).rejects.toThrow(/bestätigt/);
  expect(request).toHaveBeenCalledTimes(2);
});

it("finishes a recovered completed upload without uploading a second file", async () => {
  const file = new File(["bytes"], "file.txt");
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({
        offset: file.size,
        complete: true,
        chunkSize: 2_097_152,
      }),
    );
  await uploadInChunks(file, "event", "INCOME", "id", vi.fn(), request);
  expect(request).toHaveBeenCalledOnce();
});
