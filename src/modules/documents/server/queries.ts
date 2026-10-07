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
  if (!context.connection.rootFolderId)
    return { events: [], documents: [], folders: [] };
  const db = getDb();
  const [events, items, folders] = await Promise.all([
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
    db.driveItem.findMany({
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
          select: { eventId: true, purpose: true },
        },
      },
    }),
  ]);
  const foldersById = new Map(
    folders.map((folder) => [folder.externalId, folder]),
  );
  const eventsById = new Map(events.map((event) => [event.id, event]));
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
      const explicit = foldersById.get(current)?.folderMappings ?? [];
      const eventIds = new Set(explicit.map((mapping) => mapping.eventId));
      if (eventIds.size > 1) return undefined;
      if (eventIds.size === 1) return eventsById.get(explicit[0].eventId);
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
    .map((item) => {
      const event = eventFor(item);
      let category: string | undefined;
      let current = item.parentExternalId;
      const visited = new Set<string>();
      while (current && !visited.has(current)) {
        visited.add(current);
        const folder = foldersById.get(current);
        if (!folder) break;
        const mappings = folder.folderMappings.filter(
          (mapping) => mapping.eventId === event?.id,
        );
        if (mappings.length) {
          const purposes = new Set(mappings.map((mapping) => mapping.purpose));
          if (purposes.size === 1) category = mappings[0].purpose;
          break;
        }
        current = folder.parentExternalId;
      }
      return { ...item, path: pathFor(item), event, category };
    })
    .filter((item) => !eventId || item.event?.id === eventId);
  return { events, documents, eventRoots, folders };
}
