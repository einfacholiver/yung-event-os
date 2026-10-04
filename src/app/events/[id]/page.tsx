import { notFound } from "next/navigation";
import { getEvent } from "@/modules/events/server/queries";
import { formatEventDate } from "@/modules/events/config";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const event = await getEvent((await params).id);
  return { title: event?.name ?? "Event nicht gefunden" };
}
export default async function EventOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const event = await getEvent((await params).id);
  if (!event) notFound();
  const details = [
    ["Beginn", formatEventDate(event.startsAt, event.timezone)],
    ["Ende", formatEventDate(event.endsAt, event.timezone)],
    ["Zeitzone", event.timezone],
    ["Ort", event.location || "Noch nicht festgelegt"],
  ];
  return (
    <section
      aria-labelledby="overview-heading"
      className="grid gap-6 lg:grid-cols-3"
    >
      <div className="bg-card rounded-xl border p-6 lg:col-span-2">
        <h2 id="overview-heading" className="text-xl font-semibold">
          Overview
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Die wichtigsten Informationen zu deinem Event.
        </p>
        <dl className="mt-8 grid gap-8 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground text-sm">{label}</dt>
              <dd className="mt-2 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-xl font-semibold">Beschreibung</h2>
        <p className="text-muted-foreground mt-4 text-sm leading-7 whitespace-pre-wrap">
          {event.description ||
            "Für dieses Event ist noch keine Beschreibung hinterlegt."}
        </p>
      </div>
    </section>
  );
}
