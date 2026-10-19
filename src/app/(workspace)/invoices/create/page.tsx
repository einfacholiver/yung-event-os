import { requireDriveUser } from "@/modules/drive/server/context";
import { getDb } from "@/server/db/client";
import { hasDriveWriteScope } from "@/modules/drive/config";
import { enableInvoiceCreation } from "@/modules/drive/actions";
import { Button } from "@/components/ui/button";
import { DEFAULT_SENDER } from "@/modules/invoice-creation/schema";
import {
  InvoiceComposer,
  DriveRetry,
} from "@/modules/invoice-creation/composer";
export const dynamic = "force-dynamic";
export default async function CreateInvoicePage() {
  const { organizationId } = await requireDriveUser();
  const db = getDb();
  const [events, connection, documents] = await Promise.all([
    db.event.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        driveFolderMappings: {
          where: { purpose: "INCOME", driveItem: { trashed: false } },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.driveConnection.findUnique({
      where: {
        organizationId_accountEmail: {
          organizationId,
          accountEmail: "lightsignal.dj@gmail.com",
        },
      },
      select: { status: true, googleAccount: { select: { scope: true } } },
    }),
    db.invoiceDocument.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        number: true,
        uploadedAt: true,
        createdAt: true,
        externalId: true,
        invoice: {
          select: {
            counterparty: true,
            totalAmount: true,
            status: true,
            event: { select: { name: true } },
          },
        },
      },
    }),
  ]);
  const canWrite =
    connection?.status === "CONNECTED" &&
    hasDriveWriteScope(connection.googleAccount?.scope);
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-10">
      <div>
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Rechnungen erstellen
        </h1>
        <p className="text-muted-foreground mt-3">
          LIGHTSIGNAL GBR · PDF nach deiner Vorlage · automatische
          Monatsnummerierung
        </p>
      </div>
      {!canWrite && (
        <section className="bg-warning/10 space-y-3 rounded-xl border p-5">
          <p>
            Zum Erstellen und Ablegen bitte Google Drive für Uploads freigeben.
            Es wird ausschließlich lightsignal.dj@gmail.com verwendet.
          </p>
          <form action={enableInvoiceCreation}>
            <Button>Google-Drive-Schreibfreigabe aktivieren</Button>
          </form>
        </section>
      )}
      <InvoiceComposer
        defaultSender={DEFAULT_SENDER}
        canWrite={canWrite}
        events={events.map((event) => ({
          id: event.id,
          name: event.name,
          mapped: event.driveFolderMappings.length > 0,
        }))}
      />
      <section className="bg-card rounded-xl border">
        <div className="border-b p-5">
          <h2 className="text-xl font-semibold">Erstellte Rechnungen</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Die letzten 50 Rechnungen. Fertige PDFs bleiben unverändert;
            fehlgeschlagene Drive-Ablagen können erneut versucht werden.
          </p>
        </div>
        <ul className="divide-y">
          {documents.length ? (
            documents.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-4 p-5"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {row.number} · {row.invoice.counterparty}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {row.invoice.event?.name ?? "DJ Gigs · 2026"} ·{" "}
                    {row.createdAt.toLocaleDateString("de-DE", {
                      timeZone: "Europe/Berlin",
                    })}{" "}
                    · {row.invoice.status === "PAID" ? "Bezahlt" : "Offen"}
                  </p>
                  <p className="mt-2 font-medium">
                    {new Intl.NumberFormat("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    }).format(Number(row.invoice.totalAmount))}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    className="text-primary underline"
                    href={`/api/invoice-documents/${row.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    PDF ansehen
                  </a>
                  <a
                    className="text-primary underline"
                    href={`/api/invoice-documents/${row.id}/pdf?download=1`}
                  >
                    Download
                  </a>
                  {row.uploadedAt ? (
                    <a
                      className="text-primary underline"
                      href={`https://drive.google.com/file/d/${encodeURIComponent(row.externalId)}/view`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      In Drive öffnen ↗
                    </a>
                  ) : (
                    <DriveRetry id={row.id} />
                  )}
                </div>
              </li>
            ))
          ) : (
            <li className="text-muted-foreground p-6">
              Noch keine Rechnungen über diese Funktion erstellt.
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
