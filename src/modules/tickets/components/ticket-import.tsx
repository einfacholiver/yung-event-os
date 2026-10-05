"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { parseTicketCsv } from "@/modules/tickets/csv";
export function TicketImport({ eventId }: { eventId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ReturnType<typeof parseTicketCsv> | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function submit(confirm: boolean) {
    if (!file) return;
    setPending(true);
    setMessage("");
    const data = new FormData();
    data.set("file", file);
    if (confirm) data.set("confirm", "yes");
    try {
      const response = await fetch(`/api/events/${eventId}/tickets`, {
        method: "POST",
        body: data,
      });
      const result = await response.json();
      if (!response.ok) {
        setRows(null);
        setMessage(result.error);
        return;
      }
      if (confirm) {
        setRows(null);
        setMessage(`${result.count} Bestellungen gespeichert.`);
        router.refresh();
      } else setRows(result.rows);
    } catch {
      setMessage("Server nicht erreichbar.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-4 rounded-xl border p-5">
      <h3 className="font-semibold">One.com-Export importieren</h3>
      <p className="text-sm">
        Semikolon-CSV wie deine Beispieldatei. Gespeichert werden
        Bestellnummern, Mengen, Zahlungsstatus und Beträge; keine Namen,
        Adressen oder E-Mails. Erneuter Import aktualisiert dieselben
        Bestellnummern in diesem Event.
      </p>
      <input
        aria-label="Ticket-CSV"
        type="file"
        accept=".csv,text/csv"
        disabled={pending}
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setRows(null);
          setMessage("");
        }}
      />
      <button
        className="rounded border px-4 py-2"
        disabled={!file || pending}
        onClick={() => submit(false)}
      >
        Vorschau prüfen
      </button>
      {rows && (
        <div className="space-y-3">
          <p>
            {rows.length} Bestellungen erkannt.{" "}
            {
              rows.filter(
                (row) => row.paymentStatus === "PAID" && !row.cancelled,
              ).length
            }{" "}
            bezahlt und nicht storniert. Fehlende Mengen bleiben „Unbekannt“.
          </p>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Bestellung</th>
                  <th>Status</th>
                  <th>Tickets</th>
                  <th>Tische</th>
                  <th>Lounges</th>
                  <th>Wert</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.orderNumber}>
                    <td>{row.orderNumber}</td>
                    <td>{row.cancelled ? "Storniert" : row.paymentStatus}</td>
                    <td>{row.tickets ?? "Unbekannt"}</td>
                    <td>{row.tables ?? "Unbekannt"}</td>
                    <td>{row.lounges ?? "Unbekannt"}</td>
                    <td>
                      {row.total} {row.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            disabled={pending}
            className="rounded bg-stone-900 px-4 py-2 text-white"
            onClick={() => submit(true)}
          >
            In dieses Event importieren
          </button>
          <p className="text-sm">
            Vorher Eventnamen oben prüfen. Fehlende Bestellungen werden bei
            einem erneuten Import nicht gelöscht.
          </p>
        </div>
      )}
      <p role="status">{pending ? "Wird verarbeitet …" : message}</p>
    </div>
  );
}
