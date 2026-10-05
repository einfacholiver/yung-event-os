import Link from "next/link";
import { redirect } from "next/navigation";
import { getDriveConnection } from "@/modules/drive/server/context";
import { DriveError } from "@/modules/drive/errors";
import { hasDriveWriteScope } from "@/modules/drive/config";
import { enableEventFolderCreation } from "@/modules/drive/actions";
import { NewEventForm } from "@/modules/events/components/new-event-form";
export const dynamic = "force-dynamic";
export default async function NewEventPage() {
  const context = await getDriveConnection().catch((error: unknown) => {
    if (error instanceof DriveError && error.status === 401)
      redirect("/settings/integrations/google-drive");
    throw error;
  });
  return (
    <section className="max-w-3xl space-y-6">
      <Link href="/events" className="text-sm underline">
        ← Events
      </Link>
      <h1 className="text-3xl font-semibold">Neues Event</h1>
      {!context.connection.rootFolderId ? (
        <p>
          Bitte zuerst{" "}
          <Link
            href="/settings/integrations/google-drive"
            className="underline"
          >
            Veranstaltungen als Ausgangsordner auswählen
          </Link>
          .
        </p>
      ) : !hasDriveWriteScope(context.account.scope) ? (
        <form
          action={enableEventFolderCreation}
          className="space-y-4 rounded-xl border p-6"
        >
          <h2 className="font-semibold">Drive-Ordner anlegen freigeben</h2>
          <p>
            Bisher ist Drive nur zum Lesen verbunden. Für neue Eventordner fragt
            Google jetzt nach einer zusätzlichen Freigabe zum Bearbeiten von
            Drive.
          </p>
          <p className="text-sm">
            Google bietet dafür eine umfassende Drive-Berechtigung an. Dieser
            Ablauf verwendet sie ausschließlich zum Erstellen der neuen
            Eventordner unter „
            {context.connection.rootFolderName ?? "Veranstaltungen"}“.
            Vorhandene Unterlagen werden nicht verändert.
          </p>
          <button className="rounded bg-stone-900 px-4 py-2 text-white">
            Über Google freigeben
          </button>
        </form>
      ) : (
        <NewEventForm
          rootName={context.connection.rootFolderName ?? "Veranstaltungen"}
        />
      )}
    </section>
  );
}
