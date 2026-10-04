import Link from "next/link";
import { auth } from "@/server/auth";
import { googleEnvSchema } from "@/config/env";
import { Button } from "@/components/ui/button";
import { DRIVE_ACCOUNT_EMAIL } from "@/modules/drive/config";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  logoutGoogleDrive,
} from "@/modules/drive/actions";
import { DriveBrowser } from "@/modules/drive/components/drive-browser";
import { requireDriveUser } from "@/modules/drive/server/context";
import { getDb } from "@/server/db/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Google Drive | YUNG Event OS" };

export default async function GoogleDriveSettings({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const configured = googleEnvSchema.safeParse(process.env).success;
  const session = configured ? await auth() : null;
  let connection = null;
  let denied = false;
  if (session?.user) {
    try {
      const context = await requireDriveUser();
      connection = await getDb().driveConnection.findUnique({
        where: {
          organizationId_accountEmail: {
            organizationId: context.organizationId,
            accountEmail: DRIVE_ACCOUNT_EMAIL,
          },
        },
        select: {
          status: true,
          accountEmail: true,
          rootFolderId: true,
          rootFolderName: true,
          lastSyncedAt: true,
        },
      });
    } catch {
      denied = true;
    }
  }
  const connected = connection?.status === "CONNECTED";
  return (
    <>
      <Link
        href="/settings/integrations"
        className="text-muted-foreground text-sm"
      >
        ← Integrations
      </Link>
      <div>
        <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
          Settings / Integrations
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Google Drive</h1>
        <p className="text-muted-foreground mt-3">
          Verbinde dein Konto und wähle den Ordner für deine Veranstaltungen.
        </p>
      </div>
      {(params.error || denied) && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          Die Anmeldung konnte nicht abgeschlossen werden. Verwende{" "}
          {DRIVE_ACCOUNT_EMAIL} und erlaube den lesenden Zugriff auf
          Drive-Metadaten. Du kannst die Verbindung erneut starten.
        </p>
      )}
      {params.notice === "disconnect-failed" && (
        <p role="alert" className="text-sm text-red-800">
          Die Verbindung konnte nicht getrennt werden. Bitte versuche es erneut.
        </p>
      )}
      {!configured && (
        <p role="alert" className="rounded-lg border bg-amber-50 p-4 text-sm">
          Die Google-Verbindung ist noch nicht konfiguriert. Client-ID,
          Client-Secret, AUTH_SECRET und Datenbankverbindung müssen serverseitig
          hinterlegt sein.
        </p>
      )}
      <section
        className="bg-card space-y-4 rounded-xl border p-6"
        aria-label="Verbindungsstatus"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">
            {connected ? "Verbunden" : "Nicht verbunden"}
          </h2>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs">
            Nur Metadaten lesen
          </span>
        </div>
        <p className="text-sm">
          Erlaubtes Konto: <strong>{DRIVE_ACCOUNT_EMAIL}</strong>
        </p>
        <p className="text-muted-foreground text-sm">
          Die Freigabe erlaubt das Lesen von Namen und Ordnerstrukturen in
          deinem Drive. Die App ändert keine Dateien und startet keinen
          automatischen Sync.
        </p>
        <div className="flex flex-wrap gap-3">
          <form action={connectGoogleDrive}>
            <Button disabled={!configured}>
              {connected ? "Erneut verbinden" : "Connect"}
            </Button>
          </form>
          {connected && (
            <form action={disconnectGoogleDrive}>
              <Button variant="outline">Disconnect</Button>
            </form>
          )}
          {session?.user && (
            <form action={logoutGoogleDrive}>
              <Button variant="ghost">Abmelden</Button>
            </form>
          )}
        </div>
      </section>
      {connected && (
        <Link
          href="/settings/integrations/google-drive/mapping"
          className="bg-card block rounded-xl border p-5 hover:shadow-sm"
        >
          <h2 className="font-semibold">Drive Mapping öffnen</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Event- und Kategorieordner prüfen und manuell korrigieren.
          </p>
        </Link>
      )}
      {connected && (
        <Link
          href="/documents"
          className="bg-card block rounded-xl border p-5 hover:shadow-sm"
        >
          <h2 className="font-semibold">Documents öffnen</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Synchronisierte Drive-Dateien durchsuchen.
          </p>
        </Link>
      )}
      {connected && (
        <DriveBrowser
          selectedFolder={
            connection?.rootFolderId && connection.rootFolderName
              ? { id: connection.rootFolderId, name: connection.rootFolderName }
              : null
          }
          lastSyncedAt={connection?.lastSyncedAt?.toISOString() ?? null}
        />
      )}
    </>
  );
}
