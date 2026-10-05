"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { statusLabels } from "@/modules/events/config";
function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function EventEdit({
  event,
}: {
  event: {
    id: string;
    startsAt: string | null;
    endsAt: string | null;
    location: string | null;
    description: string | null;
    status: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  if (!open)
    return (
      <button
        className="rounded border px-4 py-2"
        onClick={() => setOpen(true)}
      >
        Event bearbeiten
      </button>
    );
  return (
    <form
      className="space-y-4 rounded-xl border p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setMessage("");
        const data = new FormData(e.currentTarget);
        for (const key of ["startsAt", "endsAt"]) {
          const value = String(data.get(key));
          data.set(key, value ? new Date(value).toISOString() : "");
        }
        try {
          const response = await fetch(`/api/events/${event.id}`, {
            method: "PATCH",
            body: data,
          });
          const result = await response.json();
          if (!response.ok) {
            setMessage(result.error);
            return;
          }
          setMessage("Gespeichert");
          router.refresh();
        } catch {
          setMessage("Speichern fehlgeschlagen.");
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="font-semibold">Event bearbeiten</h2>
      <p className="text-sm">
        Uhrzeiten in deiner Browser-Zeitzone:{" "}
        {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </p>
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <label>
          Beginn
          <input
            className="block w-full rounded border p-2"
            type="datetime-local"
            name="startsAt"
            defaultValue={localDate(event.startsAt)}
          />
        </label>
        <label>
          Ende
          <input
            className="block w-full rounded border p-2"
            type="datetime-local"
            name="endsAt"
            defaultValue={localDate(event.endsAt)}
          />
        </label>
        <label>
          Ort
          <input
            className="block w-full rounded border p-2"
            name="location"
            defaultValue={event.location ?? ""}
            maxLength={300}
          />
        </label>
        <label>
          Status
          <select
            className="block w-full rounded border p-2"
            name="status"
            defaultValue={event.status}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          Beschreibung
          <textarea
            className="block w-full rounded border p-2"
            name="description"
            defaultValue={event.description ?? ""}
            maxLength={10000}
          />
        </label>
        <button className="bg-primary text-primary-foreground rounded px-4 py-2">
          {pending ? "Speichert …" : "Speichern"}
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Schließen
        </button>
      </fieldset>
      <p role="status">{message}</p>
    </form>
  );
}
