import { notFound } from "next/navigation";
import { eventTabs } from "@/modules/events/config";

export const dynamic = "force-dynamic";
export default async function EventSection({
  params,
}: {
  params: Promise<{ id: string; tab: string }>;
}) {
  const { tab: slug } = await params;
  const tab = eventTabs.find(
    (item) => item.slug === slug && item.slug !== "overview",
  );
  if (!tab) notFound();
  return (
    <section
      className="bg-card rounded-xl border border-dashed px-6 py-14 text-center"
      aria-labelledby="section-heading"
    >
      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
        In Vorbereitung
      </span>
      <h2 id="section-heading" className="mt-5 text-2xl font-semibold">
        {tab.label}
      </h2>
      <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm leading-6">
        Dieser Bereich wird in einem nächsten Schritt umgesetzt. Hier stehen
        noch keine Funktionen zur Verfügung.
      </p>
    </section>
  );
}
