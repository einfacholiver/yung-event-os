"use client";
import { useState } from "react";

type Folder = { id: string; path: string };

export function MappingForm({
  eventId,
  purpose,
  label,
  current,
  folders,
}: {
  eventId: string;
  purpose: string;
  label: string;
  current: string;
  folders: Folder[];
}) {
  const [value, setValue] = useState(current);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/integrations/google-drive/mapping", {
        method: "POST",
        body: form,
        cache: "no-store",
      });
      const result = (await response.json()) as { error?: string };
      setStatus(
        response.ok
          ? "Gespeichert"
          : (result.error ?? "Speichern fehlgeschlagen"),
      );
    } catch {
      setStatus("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="purpose" value={purpose} />
      <label className="text-sm font-medium" htmlFor={`${eventId}-${purpose}`}>
        {label}
      </label>
      <div className="flex gap-2">
        <select
          id={`${eventId}-${purpose}`}
          name="driveItemId"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="border-input bg-background min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Nicht zugeordnet</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.path}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving || !value}
          className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm disabled:opacity-50"
        >
          {saving ? "Speichern …" : "Speichern"}
        </button>
      </div>
      {status && (
        <p role="status" className="text-muted-foreground text-xs">
          {status}
        </p>
      )}
    </form>
  );
}
