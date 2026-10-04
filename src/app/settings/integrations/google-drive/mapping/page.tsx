import Link from "next/link";
import { getDriveMappings } from "@/modules/drive/server/mapping";
import { MappingForm } from "@/modules/drive/components/mapping-form";

const purposes = [
  ["EXPENSES", "Expenses / Ausgaben"],
  ["INCOME", "Income / Einnahmen"],
  ["PERMISSIONS", "Permissions / Genehmigungen"],
  ["MEDIA", "Media"],
] as const;

export const dynamic = "force-dynamic";
export default async function DriveMappingPage() {
  const data = await getDriveMappings();
  const mapped = new Map(
    data.mappings.map((item) => [
      `${item.eventId}:${item.purpose}`,
      item.driveItemId,
    ]),
  );
  const folders = data.folders.filter((folder) => folder.parentExternalId);
  return (
    <>
      <Link
        href="/settings/integrations/google-drive"
        className="text-muted-foreground text-sm"
      >
        ← Google Drive
      </Link>
      <div>
        <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
          Settings / Integrations / Google Drive
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Drive Mapping</h1>
        <p className="text-muted-foreground mt-3">
          Automatische Vorschläge prüfen und jederzeit manuell korrigieren.
        </p>
      </div>
      <div className="space-y-6">
        {data.suggestions.map(({ event, root, categories }) => (
          <section key={event.id} className="bg-card rounded-xl border p-6">
            <h2 className="text-xl font-semibold">{event.name}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Event Root: {root?.path ?? "Kein passender Ordner gefunden"}
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {purposes.map(([purpose, label]) => {
                const suggested =
                  categories[purpose as keyof typeof categories];
                const current =
                  mapped.get(`${event.id}:${purpose}`) ?? suggested?.id ?? "";
                return (
                  <MappingForm
                    key={purpose}
                    eventId={event.id}
                    purpose={purpose}
                    label={label}
                    current={current}
                    folders={folders}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
