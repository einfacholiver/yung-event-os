import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eventTabs } from "@/modules/events/config";
import { requireEvent } from "@/modules/events/server/workspace";
import { getDocuments } from "@/modules/documents/server/queries";
import { EventFinances } from "@/modules/events/components/event-finances";
import { EventTickets } from "@/modules/tickets/components/event-tickets";
import { getDriveConnection } from "@/modules/drive/server/context";
import { hasDriveContentScope } from "@/modules/drive/config";
import { enableDrivePreviews } from "@/modules/drive/actions";
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
  const previewEnabled = hasDriveContentScope(
    (await getDriveConnection()).account.scope,
  );
  const { category, mediaType: requestedMediaType } = await searchParams;
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
      <p className="text-sm text-stone-600">
        Gespeicherter Drive-Stand für dieses Event. Neue Dateien erscheinen nach
        „Drive synchronisieren“ in den Einstellungen.
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
              className={`rounded border px-4 py-2 ${(category ?? "") === value ? "bg-stone-900 text-white" : ""}`}
              href={`/events/${id}/documents${value ? `?category=${value}` : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
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
              className={`rounded border px-4 py-2 ${mediaType === value ? "bg-stone-900 text-white" : ""}`}
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
            className="block rounded-lg p-4 hover:bg-stone-100"
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
            <p className="mt-1 text-xs break-all text-stone-500">{file.path}</p>
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
