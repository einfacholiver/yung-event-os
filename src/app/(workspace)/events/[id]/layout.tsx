import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getEvent } from "@/modules/events/server/queries";
import { EventNavigation } from "@/modules/events/components/event-navigation";
import { StatusBadge } from "@/modules/events/components/status-badge";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  return (
    <div className="space-y-8">
      <Link
        href="/events"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Alle Events
      </Link>
      <header className="space-y-4">
        <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
          {event.organization.name} / Event
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">
            {event.name}
          </h1>
          <StatusBadge status={event.status} />
        </div>
      </header>
      <EventNavigation eventId={event.id} />
      {children}
    </div>
  );
}
