import { z } from "zod";
export const DOCUMENT_UPLOAD_LIMIT = 20_000_000;
export const MEDIA_UPLOAD_LIMIT = 100_000_000;
export const uploadInputSchema = z.object({
  purpose: z.enum(["INCOME", "EXPENSES", "MEDIA", "PERMISSIONS"]),
  requestId: z.string().uuid(),
});
export const documentMimeTypes: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
};
const mediaMimeTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  tif: "image/tiff",
  tiff: "image/tiff",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  webm: "video/webm",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
};
export function uploadLimit(purpose: string) {
  return purpose === "MEDIA" ? MEDIA_UPLOAD_LIMIT : DOCUMENT_UPLOAD_LIMIT;
}
export function uploadAccept(purpose: string) {
  return Object.keys(purpose === "MEDIA" ? mediaMimeTypes : documentMimeTypes)
    .map((extension) => `.${extension}`)
    .join(",");
}
export const uploadLabels: Record<string, string> = {
  INCOME: "Einnahmerechnungen",
  EXPENSES: "Ausgabenrechnungen",
  MEDIA: "Media",
  PERMISSIONS: "Genehmigungen",
};
export class DocumentUploadError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function validateDocumentFile(
  file: Pick<File, "name" | "size">,
  purpose = "EXPENSES",
) {
  if (!file.size || file.size > uploadLimit(purpose))
    throw new DocumentUploadError(
      `Bitte eine Datei mit Inhalt bis ${uploadLimit(purpose) / 1_000_000} MB auswählen.`,
    );
  if (
    !file.name.trim() ||
    file.name.length > 200 ||
    /[\\/\x00-\x1f\x7f]/.test(file.name)
  )
    throw new DocumentUploadError(
      "Bitte einen gültigen Dateinamen ohne Pfad verwenden.",
    );
  const mimeType = (purpose === "MEDIA" ? mediaMimeTypes : documentMimeTypes)[
    file.name.split(".").pop()?.toLowerCase() ?? ""
  ];
  if (!mimeType)
    throw new DocumentUploadError(
      purpose === "MEDIA"
        ? "Bitte ein unterstütztes Bild oder Video auswählen, z. B. JPG, PNG, WebP, HEIC, MP4 oder MOV."
        : "Erlaubt sind PDF, JPG, PNG, WebP, Word, Excel, CSV und Textdateien.",
    );
  return mimeType;
}
