import Link from "next/link";
import { getDb } from "@/server/db/client";
import { requireDriveUser } from "@/modules/drive/server/context";
import { InlineEdit } from "@/modules/workspace/components/inline-edit";
export const dynamic = "force-dynamic";
export default async function InvoicesPage() {
  let invoices: Awaited<ReturnType<typeof load>> = [];
  let events: { id: string; name: string }[] = [];
  try {
    invoices = await load();
    const { organizationId } = await requireDriveUser();
    events = await getDb().event.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return (
      <main className="p-10">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="mt-3">Bitte anmelden und Google Drive verbinden.</p>
      </main>
    );
  }
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <nav className="flex gap-4 text-sm">
          <Link href="/events">Events</Link>
          <Link href="/documents">Documents</Link>
          <Link href="/finances">Finanzen</Link>
        </nav>
        <div>
          <h1 className="text-4xl font-semibold">Invoices</h1>
          <p className="text-muted-foreground mt-3">
            Manuell bearbeitbare Rechnungen mit optionalem Drive-Dokument.
          </p>
        </div>
        <section className="bg-card rounded-xl border">
          <div className="border-b p-5">
            <h2 className="text-xl font-semibold">Eingangsrechnung anlegen</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Rechnungen buchen noch keine Transaktionen. Zahlungen separat
              unter Finanzen erfassen.
            </p>
            <InlineEdit
              type="invoice"
              events={events}
              initial={{ counterparty: "", amount: "", status: "DRAFT" }}
            />
          </div>
          <ul className="divide-y">
            {invoices.length ? (
              invoices.map((invoice) => (
                <li key={invoice.id} className="p-5">
                  <div>
                    <p className="font-medium">{invoice.counterparty}</p>
                    <p className="text-muted-foreground text-sm">
                      {invoice.event?.name ?? "Kein Event"} · {invoice.status}
                    </p>
                  </div>
                  <strong>
                    {Number(invoice.totalAmount).toFixed(2)} {invoice.currency}
                  </strong>
                  <InlineEdit
                    type="invoice"
                    id={invoice.id}
                    initial={{
                      counterparty: invoice.counterparty,
                      amount: String(invoice.totalAmount),
                      status: invoice.status,
                    }}
                  />
                </li>
              ))
            ) : (
              <li className="text-muted-foreground p-8 text-center">
                Noch keine Rechnungen erfasst.
              </li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
async function load() {
  const { organizationId } = await requireDriveUser();
  return getDb().invoice.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      counterparty: true,
      totalAmount: true,
      currency: true,
      status: true,
      event: { select: { name: true } },
    },
  });
}
