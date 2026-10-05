import { expect, it } from "vitest";
import { validateDocumentFile } from "./upload";
it("restricts videos to Media and enforces category-specific limits", () => {
  const video = new File(["content"], "clip.MOV", { type: "video/quicktime" });
  expect(validateDocumentFile(video, "MEDIA")).toBe("video/quicktime");
  expect(() => validateDocumentFile(video, "PERMISSIONS")).toThrow(/Erlaubt/);
  expect(() =>
    validateDocumentFile(
      { name: "image.png", size: 100_000_001 } as File,
      "MEDIA",
    ),
  ).toThrow(/100 MB/);
  expect(() =>
    validateDocumentFile(
      { name: "invoice.pdf", size: 20_000_001 } as File,
      "INCOME",
    ),
  ).toThrow(/20 MB/);
});
