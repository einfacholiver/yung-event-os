import { cents, euro } from "@/modules/events/finance";

export function TicketSalesSummary({
  items,
}: {
  items: {
    id: string;
    description: string;
    category: string;
    quantity: number;
    unitPrice: string;
    grossRevenue: string;
  }[];
}) {
  if (!items.length) return null;
  const revenue = (category?: string) =>
    items
      .filter((item) => !category || item.category === category)
      .reduce((sum, item) => sum + cents(item.grossRevenue), 0n);
  return (
    <div className="bg-card space-y-4 rounded-xl border p-5">
      <h3 className="text-xl font-semibold">Artikel-Verkaufsübersicht</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Tickets – Bruttoumsatz", revenue("TICKET")],
          ["Upgrades – Bruttoumsatz", revenue("UPGRADE")],
          ["Bruttoumsatz gesamt", revenue()],
        ].map(([label, total]) => (
          <div key={String(label)}>
            <p className="text-muted-foreground text-sm">{String(label)}</p>
            <p className="text-2xl font-semibold">{euro(total as bigint)}</p>
          </div>
        ))}
      </div>
      <div className="overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary">
            <tr>
              {[
                "Artikelbeschreibung",
                "Verkaufte Menge",
                "Einzelpreis",
                "Bruttoumsatz",
              ].map((label) => (
                <th scope="col" className="p-3" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr className="border-t" key={item.id}>
                <td className="p-3">{item.description}</td>
                <td className="p-3">{item.quantity}</td>
                <td className="p-3 whitespace-nowrap">
                  {euro(cents(item.unitPrice))}
                </td>
                <td className="p-3 whitespace-nowrap">
                  {euro(cents(item.grossRevenue))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <th scope="row" colSpan={3} className="p-3">
                Gesamt
              </th>
              <td className="p-3 whitespace-nowrap">{euro(revenue())}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-muted-foreground text-sm">
        Vom Nutzer bereitgestellte Artikelübersicht. Gruppen-Tickets zählen hier
        als verkaufte Pakete; Upgrades sind keine zusätzlichen Eintrittstickets.
        Die Mengen sind keine gezählten Besucher. Diese Übersicht wird weder mit
        Bestellumsätzen addiert noch automatisch in Finanzen gebucht;
        Erstattungen und Gebühren sind hier nicht berücksichtigt.
      </p>
    </div>
  );
}
