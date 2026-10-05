"use client";
import { useEffect, useRef, useState } from "react";
import { Folder, File, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DRIVE_FOLDER_MIME } from "../config";
import type { BrowseResult } from "../schemas";
import { selectDriveFolder, syncGoogleDrive } from "../actions";

type Selection = { id: string; name: string } | null;

export function DriveBrowser({
  selectedFolder,
  lastSyncedAt,
}: {
  selectedFolder: Selection;
  lastSyncedAt?: string | null;
}) {
  const [data, setData] = useState<BrowseResult | null>(null);
  const [selection, setSelection] = useState(selectedFolder);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const controller = useRef<AbortController | null>(null);

  async function browse(folderId: string, pageToken?: string) {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const params = new URLSearchParams({ folderId });
      if (pageToken) params.set("pageToken", pageToken);
      const response = await fetch(
        `/api/integrations/google-drive/browse?${params}`,
        { cache: "no-store", signal: request.signal },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Ordner konnte nicht geladen werden.",
        );
      if (request.signal.aborted) return;
      const next = result as BrowseResult;
      setData((previous) =>
        pageToken && previous?.folder.id === next.folder.id
          ? {
              ...next,
              files: [
                ...new Map(
                  [...previous.files, ...next.files].map((file) => [
                    file.id,
                    file,
                  ]),
                ).values(),
              ],
            }
          : next,
      );
    } catch (cause) {
      if (!request.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Ordner konnte nicht geladen werden.",
        );
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => () => controller.current?.abort(), []);

  async function selectCurrentFolder() {
    if (!data || loading) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await selectDriveFolder(data.folder.id);
      if (result.success) {
        setSelection(result.folder);
        setNotice("Ordner gespeichert. Es wurde noch kein Sync gestartet.");
      } else setError(result.error);
    } catch {
      setError(
        "Ordner konnte nicht gespeichert werden. Bitte erneut versuchen.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const result = await syncGoogleDrive();
      if (!result.success) setError(result.error);
      else
        setNotice(
          `Sync abgeschlossen: ${result.result.total} Metadaten (${result.result.folders} Ordner, ${result.result.files} Dateien).`,
        );
    } catch {
      setError(
        "Sync konnte nicht abgeschlossen werden. Bitte erneut versuchen.",
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="space-y-6" aria-labelledby="drive-browser-heading">
      <div className="bg-card rounded-xl border p-6">
        <h2 id="drive-browser-heading" className="text-xl font-semibold">
          Drive-Browser
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Öffne Meine Ablage, navigiere zu Veranstaltungen und speichere diesen
          Ordner als Ausgangspunkt. Du kannst vorher alle Unterordner prüfen.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            onClick={() => void browse("root")}
            disabled={loading || saving}
          >
            Meine Ablage öffnen
          </Button>
          {selection && (
            <Button
              variant="outline"
              onClick={() => void browse(selection.id)}
              disabled={loading || saving}
            >
              Gespeicherten Ordner öffnen
            </Button>
          )}
          {selection && (
            <Button
              variant="outline"
              onClick={() => void sync()}
              disabled={loading || saving || syncing}
            >
              {syncing ? "Sync läuft …" : "Drive synchronisieren"}
            </Button>
          )}
        </div>
        {selection && (
          <div>
            <div className="bg-background mt-5 rounded-lg p-4 text-sm">
              <p>
                Gespeicherter Ordner: <strong>{selection.name}</strong>
              </p>
              <p className="text-muted-foreground mt-1 break-all">
                Google Folder ID: <code>{selection.id}</code>
              </p>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              {lastSyncedAt
                ? `Letzter Sync: ${new Date(lastSyncedAt).toLocaleString("de-DE")}`
                : "Noch kein Sync durchgeführt."}
            </p>
          </div>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-foreground rounded-lg border p-4 text-sm"
        >
          {error}
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="bg-success/10 text-foreground rounded-lg p-4 text-sm"
        >
          {notice}
        </p>
      )}
      {loading && (
        <p role="status" className="text-muted-foreground text-sm">
          Ordnerinhalt wird geladen …
        </p>
      )}
      {data && (
        <div
          className="bg-card rounded-xl border"
          aria-busy={loading || saving}
        >
          <div className="space-y-4 border-b p-5">
            <nav
              aria-label="Drive-Ordnerpfad"
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              {data.breadcrumbs.map((crumb, index) => (
                <span key={crumb.id} className="inline-flex items-center gap-2">
                  {index > 0 && (
                    <span aria-hidden="true" className="text-muted-foreground">
                      /
                    </span>
                  )}
                  <button
                    className="underline-offset-4 hover:underline disabled:opacity-50"
                    disabled={loading || saving}
                    onClick={() => void browse(crumb.id)}
                    aria-current={
                      crumb.id === data.folder.id ? "location" : undefined
                    }
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </nav>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{data.folder.name}</h3>
                <p className="text-muted-foreground text-xs">
                  {data.files.length} Einträge geladen
                  {data.nextPageToken ? " · weitere verfügbar" : ""}
                </p>
              </div>
              <Button
                disabled={loading || saving || data.breadcrumbs.length === 1}
                onClick={() => void selectCurrentFolder()}
              >
                {saving ? "Wird gespeichert …" : "Diesen Ordner auswählen"}
              </Button>
            </div>
          </div>
          {data.files.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center text-sm">
              Dieser Ordner ist leer.
            </p>
          ) : (
            <ul className="divide-y">
              {data.files.map((file) => (
                <li key={file.id} className="flex items-center gap-3 px-5 py-4">
                  {file.mimeType === DRIVE_FOLDER_MIME ? (
                    <>
                      <Folder
                        aria-hidden="true"
                        className="text-warning size-5 shrink-0"
                      />
                      <button
                        disabled={loading || saving}
                        onClick={() => void browse(file.id)}
                        className="min-w-0 flex-1 text-left font-medium break-words hover:underline disabled:opacity-50"
                      >
                        {file.name}
                      </button>
                      <span className="text-muted-foreground text-xs">
                        Ordner
                      </span>
                    </>
                  ) : (
                    <>
                      <File
                        aria-hidden="true"
                        className="text-muted-foreground size-5 shrink-0"
                      />
                      <a
                        href={`https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 break-words hover:underline"
                      >
                        {file.name}
                        <span className="sr-only">
                          {" "}
                          – in Google Drive öffnen
                        </span>
                      </a>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="text-muted-foreground size-4 shrink-0"
                      />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {data.nextPageToken && (
            <div className="border-t p-4">
              <Button
                variant="outline"
                disabled={loading || saving}
                onClick={() => void browse(data.folder.id, data.nextPageToken)}
              >
                Weitere laden
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
