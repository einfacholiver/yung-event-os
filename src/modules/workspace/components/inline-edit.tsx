"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function InlineEdit({
  type,
  id,
  initial,
  events = [],
}: {
  type: "invoice" | "task";
  id?: string;
  initial: {
    title?: string;
    counterparty?: string;
    amount?: string;
    status: string;
    priority?: string;
  };
  events?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [eventId, setEventId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const endpoint = `/api/${type === "invoice" ? "invoices" : "tasks"}${id ? `/${id}` : ""}`;
      const body =
        type === "invoice"
          ? {
              counterparty: value.counterparty,
              totalAmount: value.amount,
              status: value.status,
              eventId,
            }
          : {
              title: value.title,
              status: value.status,
              priority: value.priority,
              eventId,
            };
      const response = await fetch(endpoint, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setMessage(id ? "Gespeichert" : "Angelegt");
      if (!id) setValue(initial);
      router.refresh();
    } catch {
      setMessage("Server nicht erreichbar. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }
  const statuses =
    type === "invoice"
      ? ["DRAFT", "OPEN", "PAID", "CANCELLED"]
      : ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"];
  return (
    <form onSubmit={save} className="mt-3 flex flex-wrap gap-3 text-sm">
      {!id && (
        <label>
          Event
          <select
            required
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="mt-1 block rounded border px-2 py-2"
          >
            <option value="">Event auswählen</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        {type === "invoice" ? "Lieferant" : "Titel"}
        <input
          required
          maxLength={type === "invoice" ? 200 : 300}
          value={
            type === "invoice"
              ? (value.counterparty ?? "")
              : (value.title ?? "")
          }
          onChange={(e) =>
            setValue({
              ...value,
              [type === "invoice" ? "counterparty" : "title"]: e.target.value,
            })
          }
          className="mt-1 block rounded border px-2 py-2"
        />
      </label>
      {type === "invoice" && (
        <label>
          Betrag (EUR)
          <input
            required
            min="0"
            max="999999999999.99"
            type="number"
            step="0.01"
            value={value.amount ?? ""}
            onChange={(e) => setValue({ ...value, amount: e.target.value })}
            className="mt-1 block w-36 rounded border px-2 py-2"
          />
        </label>
      )}
      <label>
        Status
        <select
          value={value.status}
          onChange={(e) => setValue({ ...value, status: e.target.value })}
          className="mt-1 block rounded border px-2 py-2"
        >
          {statuses.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </label>
      {type === "task" && (
        <label>
          Priorität
          <select
            value={value.priority}
            onChange={(e) => setValue({ ...value, priority: e.target.value })}
            className="mt-1 block rounded border px-2 py-2"
          >
            {["LOW", "MEDIUM", "HIGH"].map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </label>
      )}
      <button
        type="submit"
        disabled={saving}
        className="bg-primary text-primary-foreground self-end rounded px-4 py-2 disabled:opacity-50"
      >
        {saving ? "Speichert …" : id ? "Speichern" : "Anlegen"}
      </button>
      {message && (
        <p role="status" className="w-full">
          {message}
        </p>
      )}
    </form>
  );
}
