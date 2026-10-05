import { getEvents } from "@/modules/events/server/queries";
import { EventList } from "@/modules/events/components/event-list";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function EventsPage() {
  const events = await getEvents();
  return (
    <div className="space-y-8">
      <div>
        <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
          YUNG / Workspace
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Events</h1>
        <p className="text-muted-foreground mt-3">
          Alle Kapitel an einem Ort. Wähle ein Event, um die Details zu öffnen.
        </p>
      </div>
      <Link
        href="/events/new"
        className="inline-block rounded bg-stone-900 px-5 py-3 text-white"
      >
        Neues Event
      </Link>
      <EventList events={events} />
    </div>
  );
}
