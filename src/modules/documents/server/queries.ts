import "server-only";
import { getDb } from "@/server/db/client";
import { getDriveConnection } from "@/modules/drive/server/context";

function normalize(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, "")
    .replace(/[^a-z0-9äöüß]+/g, "")
    .replace(/^yung/, "")
    .replace(/^chapter/, "");
}

export async function getDocuments(eventId?: string) {
  const context = await getDriveConnection();
  if (!context.connection.rootFolderId) return { events: [], documents: [] };
  const db = getDb();
  const [events, items] = await Promise.all([
    db.event.findMany({
      where: { organizationId: context.organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    db.driveItem.findMany({
      where: {
        organizationId: context.organizationId,
        connectionId: context.connection.id,
        kind: "FILE",
        trashed: false,
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        externalId: true,
        parentExternalId: true,
        name: true,
        mimeType: true,
        modifiedAt: true,
        webViewUrl: true,
      },
    }),
  ]);
  const folders = await db.driveItem.findMany({
    where: {
      organizationId: context.organizationId,
      connectionId: context.connection.id,
      kind: "FOLDER",
      trashed: false,
    },
    select: {
      externalId: true,
      parentExternalId: true,
      name: true,
      folderMappings: {
        where: { organizationId: context.organizationId },
        select: { eventId: true },
      },
    },
  });
  const byExternalId = new Map(
    [...folders, ...items].map((item) => [item.externalId, item]),
  );
  const eventRoots = folders.filter(
    (folder) => folder.parentExternalId === context.connection.rootFolderId,
  );
  const eventFor = (item: (typeof items)[number]) => {
    let current = item.parentExternalId;
    const visited = new Set<string>();
    while (current && !visited.has(current)) {
      visited.add(current);
      const folder = byExternalId.get(current);
      if (!folder) break;
      const explicit =
        folders.find((candidate) => candidate.externalId === current)
          ?.folderMappings ?? [];
      const eventIds = new Set(explicit.map((mapping) => mapping.eventId));
      if (eventIds.size > 1) return undefined;
      if (eventIds.size === 1)
        return events.find((event) => event.id === explicit[0].eventId);
      if (folder.parentExternalId === context.connection.rootFolderId)
        return events.find(
          (event) => normalize(event.name) === normalize(folder.name),
        );
      current = folder.parentExternalId;
    }
    return undefined;
  };
  const pathFor = (item: (typeof items)[number]) => {
    const parts = [item.name];
    let current = item.parentExternalId;
    const visited = new Set<string>();
    while (current && !visited.has(current)) {
      visited.add(current);
      const parent = byExternalId.get(current);
      if (!parent) break;
      parts.unshift(parent.name);
      current = parent.parentExternalId;
    }
    if (parts[0] !== (context.connection.rootFolderName ?? "Veranstaltungen"))
      parts.unshift(context.connection.rootFolderName ?? "Veranstaltungen");
    return parts.join(" / ");
  };
  const documents = items
    .map((item) => ({ ...item, path: pathFor(item), event: eventFor(item) }))
    .filter((item) => !eventId || item.event?.id === eventId);
  return { events, documents, eventRoots };
}
