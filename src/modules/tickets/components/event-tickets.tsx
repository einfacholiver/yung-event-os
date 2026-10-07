import { getDb } from "@/server/db/client";
import { TicketImport } from "./ticket-import";
import { TicketSalesSummary } from "./ticket-sales-summary";
export async function EventTickets({
  id,
  organizationId,
}: {
  id: string;
  organizationId: string;
}) {
  const [salesItems, orders] = await Promise.all([
    getDb().ticketSalesItem.findMany({
      where: { eventId: id, organizationId },
      orderBy: { position: "asc" },
    }),
    getDb().ticketOrder.findMany({
      where: { eventId: id, organizationId },
      orderBy: { orderNumber: "asc" },
    }),
  ]);
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Tickets</h2>
      <TicketSalesSummary
        items={salesItems.map((item) => ({
          ...item,
          unitPrice: item.unitPrice.toString(),
          grossRevenue: item.grossRevenue.toString(),
        }))}
      />
      <TicketImport eventId={id} />
      <p>
        {orders.length} Bestellungen gespeichert. Bestellungen sind keine
        gezählten Besucher. Die Werte werden nicht automatisch in Finanzen
        gebucht.
      </p>
      <div className="overflow-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Bestellung",
                "Status",
                "Tickets",
                "Tische",
                "Lounges",
                "Bestellwert",
                "Erstattet",
              ].map((label) => (
                <th className="p-3" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr className="border-t" key={order.id}>
                <td className="p-3">{order.orderNumber}</td>
                <td>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${order.cancelled ? "status-error" : ["paid", "bezahlt"].includes(order.paymentStatus.toLowerCase()) ? "status-success" : "status-info"}`}
                  >
                    {order.cancelled ? "Storniert" : order.paymentStatus}
                  </span>
                </td>
                <td>{order.tickets ?? "Unbekannt"}</td>
                <td>{order.tables ?? "Unbekannt"}</td>
                <td>{order.lounges ?? "Unbekannt"}</td>
                <td>
                  {order.total.toString()} {order.currency}
                </td>
                <td>
                  {order.refunded.toString()} {order.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
