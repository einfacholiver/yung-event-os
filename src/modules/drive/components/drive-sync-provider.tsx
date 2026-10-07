"use client";

import { createContext, useContext, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, AlertCircle } from "lucide-react";
import { syncGoogleDrive } from "../actions";

type Folder = { id: string; name: string };
type SyncState = {
  status: "running" | "complete" | "error";
  folder: Folder;
  total: number;
  folders: number;
  files: number;
  error?: string;
};
const SyncContext = createContext<{
  syncing: boolean;
  startSync: (folder: Folder, restart?: boolean) => Promise<void>;
} | null>(null);

export function useDriveSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error("DriveSyncProvider is required.");
  return context;
}

export function DriveSyncProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SyncState | null>(null);
  const active = useRef(false);
  async function startSync(folder: Folder, restart = false) {
    if (active.current) return;
    active.current = true;
    let progress: SyncState = {
      status: "running",
      folder,
      total: 0,
      folders: 0,
      files: 0,
    };
    setState(progress);
    const key = `yung-drive-sync:${folder.id}`;
    try {
      // The checkpoint lives on the server. Storage is only a resume hint.
      let stored: string | null = null;
      try {
        stored = restart ? null : sessionStorage.getItem(key);
      } catch {}
      const runId = stored ?? crypto.randomUUID();
      try {
        sessionStorage.setItem(key, runId);
      } catch {}
      while (true) {
        const result = await syncGoogleDrive(runId);
        if (!result.success) throw new Error(result.error);
        progress = {
          ...progress,
          total: result.result.total,
          folders: result.result.folders,
          files: result.result.files,
          status: result.result.complete ? "complete" : "running",
        };
        setState(progress);
        if (result.result.complete) {
          try {
            sessionStorage.removeItem(key);
          } catch {}
          break;
        }
      }
    } catch (error) {
      setState({
        ...progress,
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Sync konnte nicht abgeschlossen werden. Bitte erneut versuchen.",
      });
    } finally {
      active.current = false;
    }
  }
  const running = state?.status === "running";
  return (
    <SyncContext.Provider value={{ syncing: running, startSync }}>
      {children}
      {state && (
        <aside
          aria-label="Google Drive Sync"
          className="bg-card text-foreground fixed right-4 bottom-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-2xl border p-4 shadow-2xl sm:right-6 sm:bottom-6"
        >
          <div
            role={state.status === "error" ? "alert" : "status"}
            aria-live={state.status === "error" ? "assertive" : "polite"}
            aria-atomic="true"
          >
            <div className="flex items-center gap-2 font-semibold">
              {running ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="text-primary size-5 motion-safe:animate-spin"
                />
              ) : state.status === "complete" ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="text-success size-5"
                />
              ) : (
                <AlertCircle
                  aria-hidden="true"
                  className="text-destructive size-5"
                />
              )}
              <span>
                {running
                  ? "Drive wird synchronisiert …"
                  : state.status === "complete"
                    ? "Drive-Sync abgeschlossen"
                    : "Drive-Sync unterbrochen"}
              </span>
            </div>
            <p className="text-muted-foreground mt-2 text-sm break-words">
              {state.folder.name}
            </p>
            <p className="mt-2 text-sm">
              {state.total} Metadaten · {state.folders} Ordner · {state.files}{" "}
              Dateien
            </p>
            {state.error && (
              <p className="mt-2 text-sm text-red-300">{state.error}</p>
            )}
          </div>
          {running ? (
            <>
              <progress
                aria-label="Drive-Synchronisierung läuft"
                className="mt-3 h-2 w-full accent-[var(--primary)]"
              />
              <p className="text-muted-foreground mt-2 text-xs">
                Du kannst innerhalb der App weiterarbeiten. Bei Neuladen den
                Sync erneut starten, um fortzusetzen.
              </p>
            </>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {state.status === "error" && (
                <button
                  type="button"
                  className="bg-primary text-primary-foreground rounded px-3 py-2 text-sm"
                  onClick={() => void startSync(state.folder)}
                >
                  Fortsetzen
                </button>
              )}
              {state.status === "error" && (
                <button
                  type="button"
                  className="rounded border px-3 py-2 text-sm"
                  onClick={() => void startSync(state.folder, true)}
                >
                  Neu starten
                </button>
              )}
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm"
                onClick={() => setState(null)}
              >
                Meldung schließen
              </button>
            </div>
          )}
        </aside>
      )}
    </SyncContext.Provider>
  );
}
