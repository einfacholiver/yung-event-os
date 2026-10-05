import { z } from "zod";

export const folderIdSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/);
export const browseInputSchema = z.object({
  folderId: folderIdSchema.default("root"),
  pageToken: z.string().min(1).max(4096).optional(),
});
export const driveFileSchema = z.object({
  id: folderIdSchema,
  name: z.string(),
  mimeType: z.string(),
  parents: z.array(folderIdSchema).optional(),
  trashed: z.boolean().optional(),
  modifiedTime: z.string().optional(),
  md5Checksum: z.string().optional(),
});
export const driveListSchema = z.object({
  files: z.array(driveFileSchema).default([]),
  nextPageToken: z.string().optional(),
});
export type DriveFile = z.infer<typeof driveFileSchema>;
export type BrowseResult = {
  folder: DriveFile;
  breadcrumbs: Array<{ id: string; name: string }>;
  files: DriveFile[];
  nextPageToken?: string;
};
