import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eventTabs } from "@/modules/events/config";
import { requireEvent } from "@/modules/events/server/workspace";
import { getDocuments } from "@/modules/documents/server/queries";
import { EventFinances } from "@/modules/events/components/event-finances";
import { EventTickets } from "@/modules/tickets/components/event-tickets";
import { getDriveConnection } from "@/modules/drive/server/context";
import {
  hasDriveContentScope,
  hasDriveWriteScope,
} from "@/modules/drive/config";
import {
  enableDrivePreviews,
  enableDocumentUploads,
} from "@/modules/drive/actions";
import { getDb } from "@/server/db/client";
import { DocumentUpload } from "@/modules/documents/components/document-upload";
import { MediaPreview } from "@/modules/events/components/media-preview";
import { PdfPreview } from "@/modules/documents/components/pdf-preview";
export const dynamic = "force-dynamic";
export default async function EventSection({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; tab: string }>;
  searchParams: Promise<{ category?: string; mediaType?: string | string[] }>;
}) {
  const { id, tab: slug } = await params;
  if (slug === "invoices") redirect(`/events/${id}/documents`);
  const tab = eventTabs.find(
    (item) => item.slug === slug && item.slug !== "overview",
  );
  if (!tab) notFound();
  const { user } = await requireEvent(id);
  if (slug === "tickets")
    return <EventTickets id={id} organizationId={user.organizationId} />;
  if (slug === "finances" || slug === "analytics")
    return (
      <EventFinances
        id={id}
        organizationId={user.organizationId}
        analytics={slug === "analytics"}
      />
    );
  const { documents } = await getDocuments(id);
  const driveContext = await getDriveConnection();
  const previewEnabled = hasDriveContentScope(driveContext.account.scope);
  const { category, mediaType: requestedMediaType } = await searchParams;
  const uploadSection =
    slug === "documents" || slug === "media" || slug === "permissions"
      ? slug
      : null;
  const uploadPurposes: ("INCOME" | "EXPENSES" | "MEDIA" | "PERMISSIONS")[] =
    slug === "media"
      ? ["MEDIA"]
      : slug === "permissions"
        ? ["PERMISSIONS"]
        : category === "INCOME" || category === "EXPENSES"
          ? [category]
          : ["INCOME", "EXPENSES"];
  const uploadMappings = uploadSection
    ? await getDb().driveFolderMapping.findMany({
        where: {
          eventId: id,
          organizationId: user.organizationId,
          purpose: { in: uploadPurposes },
          driveItem: {
            connectionId: driveContext.connection.id,
            trashed: false,
          },
        },
        include: { driveItem: { select: { name: true, externalId: true } } },
        orderBy: { purpose: "asc" },
      })
    : [];
  const cachedFolders = uploadMappings.length
    ? await getDb().driveItem.findMany({
        where: {
          organizationId: user.organizationId,
          connectionId: driveContext.connection.id,
          kind: "FOLDER",
          trashed: false,
        },
        select: { externalId: true, parentExternalId: true, name: true },
      })
    : [];
  const foldersById = new Map(
    cachedFolders.map((folder) => [folder.externalId, folder]),
  );
  const uploadTargetName = (folderId: string, fallback: string) => {
    const parts: string[] = [];
    const visited = new Set<string>();
    let current: string | null = folderId;
    while (
      current &&
      current !== driveContext.connection.rootFolderId &&
      !visited.has(current)
    ) {
      visited.add(current);
      const folder = foldersById.get(current);
      if (!folder) break;
      parts.unshift(folder.name);
      current = folder.parentExternalId;
    }
    if (!parts.length) parts.push(fallback);
    parts.unshift(driveContext.connection.rootFolderName ?? "Veranstaltungen");
    return parts.join(" / ");
  };
  const mediaType =
    requestedMediaType === "images" || requestedMediaType === "videos"
      ? requestedMediaType
      : "";
  const mediaFiles = documents.filter((file) => file.category === "MEDIA");
  const filtered = documents.filter((file) =>
    slug === "permissions"
      ? file.category === "PERMISSIONS"
      : slug === "media"
        ? file.category === "MEDIA" &&
          (!mediaType ||
            file.mimeType.startsWith(
              mediaType === "images" ? "image/" : "video/",
            ))
        : category === "INCOME" || category === "EXPENSES"
          ? file.category === category
          : true,
  );
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">{tab.label}</h2>
      <p className="text-muted-foreground text-sm">
        Gespeicherter Drive-Stand für dieses Event. Extern hinzugefügte Dateien
        erscheinen nach „Drive synchronisieren“ in den Einstellungen; hier
        hochgeladene Dateien erscheinen direkt.
      </p>
      {slug === "documents" && (
        <nav aria-label="Dokumentarten" className="flex flex-wrap gap-3">
          {[
            ["", "Alle Dokumente"],
            ["INCOME", "Einnahmerechnungen"],
            ["EXPENSES", "Ausgabenrechnungen"],
          ].map(([value, label]) => (
            <Link
              key={value}
              aria-current={(category ?? "") === value ? "page" : undefined}
              className={`rounded border px-4 py-2 ${(category ?? "") === value ? "bg-primary text-primary-foreground" : ""}`}
              href={`/events/${id}/documents${value ? `?category=${value}` : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
      {uploadSection &&
        (!uploadMappings.length ? (
          <p className="rounded-xl border p-5">
            Für Uploads bitte zuerst den Zielordner dieses Bereichs über
            „Drive-Zuordnung prüfen“ zuweisen.
          </p>
        ) : !hasDriveWriteScope(driveContext.account.scope) ? (
          <form
            action={enableDocumentUploads.bind(null, id, uploadSection)}
            className="space-y-3 rounded-xl border p-5"
          >
            <p>
              Zum Hochladen in eure bestehenden Event-Ordner ist
              Google-Schreibzugriff erforderlich. Verwende
              lightsignal.dj@gmail.com. Die App legt neue Dateien ausschließlich
              im zugewiesenen Ordner des aktuellen Event-Bereichs ab.
            </p>
            <button className="rounded border px-4 py-2">
              Datei-Upload über Google freigeben
            </button>
          </form>
        ) : (
          <DocumentUpload
            key={`${uploadSection}:${category ?? "all"}`}
            eventId={id}
            initialPurpose={
              uploadMappings.some((mapping) => mapping.purpose === category)
                ? category
                : undefined
            }
            targets={uploadMappings.map((mapping) => ({
              purpose: mapping.purpose,
              name: uploadTargetName(
                mapping.driveItem.externalId,
                mapping.driveItem.name,
              ),
            }))}
          />
        ))}
      {slug === "media" && (
        <nav aria-label="Medienart filtern" className="flex flex-wrap gap-3">
          {[
            ["", "Alle", mediaFiles.length],
            [
              "images",
              "Bilder",
              mediaFiles.filter((file) => file.mimeType.startsWith("image/"))
                .length,
            ],
            [
              "videos",
              "Videos",
              mediaFiles.filter((file) => file.mimeType.startsWith("video/"))
                .length,
            ],
          ].map(([value, label, count]) => (
            <Link
              key={value}
              aria-current={mediaType === value ? "page" : undefined}
              className={`rounded border px-4 py-2 ${mediaType === value ? "bg-primary text-primary-foreground" : ""}`}
              href={`/events/${id}/media${value ? `?mediaType=${value}` : ""}`}
            >
              {label} ({count})
            </Link>
          ))}
        </nav>
      )}
      {!previewEnabled && (
        <form action={enableDrivePreviews} className="space-y-3">
          <p>
            Für Bild- und PDF-Vorschauen benötigt die App eine zusätzliche
            Google-Freigabe zum Lesen von Dateiinhalten. Es werden keine
            Drive-Dateien verändert.
          </p>
          <button className="rounded border px-4 py-2">
            Dokumentvorschauen freigeben
          </button>
        </form>
      )}
      <div
        className={
          slug === "media"
            ? "grid gap-4 sm:grid-cols-3"
            : "divide-y rounded-xl border"
        }
      >
        {filtered.map((file) => (
          <div
            className="hover:bg-secondary block rounded-lg p-4"
            key={file.id}
          >
            {slug === "media" &&
              previewEnabled &&
              file.mimeType.startsWith("image/") && (
                <MediaPreview
                  src={`/api/events/${id}/media/${file.id}`}
                  name={file.name}
                />
              )}
            <a
              className="font-medium hover:underline"
              href={`https://drive.google.com/file/d/${encodeURIComponent(file.externalId)}/view`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {file.name} ↗
            </a>
            <p className="text-muted-foreground mt-1 text-xs break-all">
              {file.path}
            </p>
            <p className="mt-2 text-xs">
              {file.mimeType.startsWith("image/")
                ? "Bild"
                : file.mimeType.startsWith("video/")
                  ? "Video"
                  : file.mimeType === "application/vnd.google-apps.spreadsheet"
                    ? "Google Sheets"
                    : file.mimeType}
            </p>
            {previewEnabled && file.mimeType === "application/pdf" && (
              <PdfPreview
                src={`/api/events/${id}/documents/${file.id}/preview`}
                name={file.name}
              />
            )}
          </div>
        ))}
      </div>
      {!filtered.length && (
        <p className="rounded-xl border border-dashed p-8">
          {slug === "media" && mediaType && mediaFiles.length
            ? `Keine ${mediaType === "images" ? "Bilder" : "Videos"} im gespeicherten Media-Stand. Wähle „Alle“, um die übrigen Dateien anzuzeigen.`
            : "Noch keine Dateien in diesem Bereich. Prüfe die Ordnerzuordnung und synchronisiere Drive."}
        </p>
      )}
      <Link
        className="text-sm underline"
        href="/settings/integrations/google-drive/mapping"
      >
        Drive-Zuordnung prüfen
      </Link>
    </section>
  );
}
