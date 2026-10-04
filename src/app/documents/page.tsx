import Link from "next/link";
import { getDocuments } from "@/modules/documents/server/queries";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const params = await searchParams;
  let data: Awaited<ReturnType<typeof getDocuments>> | null = null;
  try {
    data = await getDocuments(params.event);
  } catch {
    data = null;
  }
  if (!data)
    return (
      <main className="p-10">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="mt-3">
          Bitte zuerst Google Drive verbinden und synchronisieren.
        </p>
      </main>
    );
  const { events, documents } = data;
  return (
    <main className="min-h-screen">
      <header className="bg-card border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-xl font-black tracking-tight">
            YUNG{" "}
            <span className="text-muted-foreground text-xs font-medium tracking-widest">
              EVENT OS
            </span>
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/events">Events</Link>
            <Link href="/settings">Settings</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10 lg:px-10">
        <div>
          <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
            Workspace
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-3">
            Synchronisierte Drive-Dateien mit ihrem vollständigen Ordnerpfad.
          </p>
        </div>
        <form className="bg-card flex flex-wrap items-end gap-3 rounded-xl border p-5">
          <label className="text-sm font-medium">
            Event
            <select
              name="event"
              defaultValue={params.event ?? ""}
              className="border-input bg-background mt-2 block rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Alle Events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm"
            type="submit"
          >
            Filtern
          </button>
        </form>
        <section className="bg-card rounded-xl border">
          {documents.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center text-sm">
              Keine synchronisierten Dokumente gefunden.
            </p>
          ) : (
            <ul className="divide-y">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0">
                    <a
                      href={
                        document.webViewUrl ??
                        `https://drive.google.com/file/d/${encodeURIComponent(document.externalId)}/view`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      {document.name}
                    </a>
                    <p className="text-muted-foreground mt-1 text-xs break-all">
                      {document.path}
                    </p>
                    {document.event && (
                      <p className="mt-1 text-xs">
                        Event: {document.event.name}
                      </p>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {document.mimeType}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
