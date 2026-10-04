import "server-only";
import { getDb } from "@/server/db/client";
import { getDriveConnection, requireDriveUser } from "./context";
import { DriveError } from "../errors";
import { folderIdSchema } from "../schemas";

const purposeLabels = {
  EXPENSES: ["ausgaben", "expenses"],
  INCOME: ["einnahmen", "income"],
  PERMISSIONS: ["genehmigungen", "permissions"],
  MEDIA: ["media"],
} as const;

function normalizeName(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, "")
    .replace(/[^a-z0-9äöüß]+/g, "")
    .replace(/^yung/, "")
    .replace(/^chapter/, "");
}

export async function getDriveMappings() {
  const context = await getDriveConnection();
  if (!context.connection.rootFolderId)
    throw new DriveError("INVALID_INPUT", 400);
  const db = getDb();
  const [events, folders, mappings] = await Promise.all([
    db.event.findMany({
      where: { organizationId: context.organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    db.driveItem.findMany({
      where: {
        organizationId: context.organizationId,
        connectionId: context.connection.id,
        kind: "FOLDER",
        trashed: false,
      },
      orderBy: [{ parentExternalId: "asc" }, { name: "asc" }],
      select: {
        id: true,
        externalId: true,
        parentExternalId: true,
        name: true,
      },
    }),
    db.driveFolderMapping.findMany({
      where: { organizationId: context.organizationId },
      select: { eventId: true, purpose: true, driveItemId: true },
    }),
  ]);
  const byExternalId = new Map(
    folders.map((folder) => [folder.externalId, folder]),
  );
  const pathCache = new Map<string, string>();
  const pathFor = (
    folder: (typeof folders)[number],
    visited = new Set<string>(),
  ): string => {
    const cached = pathCache.get(folder.id);
    if (cached) return cached;
    if (visited.has(folder.externalId)) return folder.name;
    visited.add(folder.externalId);
    const parent = folder.parentExternalId
      ? byExternalId.get(folder.parentExternalId)
      : undefined;
    const path = parent
      ? `${pathFor(parent, visited)} / ${folder.name}`
      : folder.externalId === context.connection.rootFolderId
        ? folder.name
        : `[Pfad unvollständig] / ${folder.name}`;
    pathCache.set(folder.id, path);
    return path;
  };
  const foldersWithPath = folders.map((folder) => ({
    ...folder,
    path: pathFor(folder),
  }));
  const eventRoots = foldersWithPath.filter(
    (folder) => folder.parentExternalId === context.connection.rootFolderId,
  );
  const suggestions = events.map((event) => {
    const root = eventRoots.find(
      (folder) => normalizeName(folder.name) === normalizeName(event.name),
    );
    const children = root
      ? foldersWithPath.filter(
          (folder) => folder.parentExternalId === root.externalId,
        )
      : [];
    const categories = Object.fromEntries(
      Object.entries(purposeLabels).map(([purpose, names]) => [
        purpose,
        children.find((folder) =>
          names.some((name) => normalizeName(folder.name) === name),
        ) ?? null,
      ]),
    );
    return { event, root, categories };
  });
  return { events, folders: foldersWithPath, mappings, suggestions };
}

export async function saveDriveMapping(input: {
  eventId: string;
  purpose: string;
  driveItemId: string;
}) {
  const user = await requireDriveUser();
  const purpose = input.purpose as keyof typeof purposeLabels;
  if (!Object.hasOwn(purposeLabels, purpose))
    throw new DriveError("INVALID_INPUT", 400);
  const itemId = folderIdSchema.parse(input.driveItemId);
  const db = getDb();
  const item = await db.driveItem.findFirst({
    where: {
      id: itemId,
      organizationId: user.organizationId,
      kind: "FOLDER",
      trashed: false,
    },
  });
  if (!item) throw new DriveError("INVALID_INPUT", 400);
  const event = await db.event.findFirst({
    where: { id: input.eventId, organizationId: user.organizationId },
    select: { id: true },
  });
  if (!event) throw new DriveError("INVALID_INPUT", 400);
  return db.driveFolderMapping.upsert({
    where: { eventId_purpose: { eventId: event.id, purpose } },
    create: {
      organizationId: user.organizationId,
      eventId: event.id,
      driveItemId: item.id,
      purpose,
    },
    update: { driveItemId: item.id },
  });
}
