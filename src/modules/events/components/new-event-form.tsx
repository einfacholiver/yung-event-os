"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { newEventFolders } from "../create-schema";
export function NewEventForm({ rootName }: { rootName: string }) {
  const [name, setName] = useState("Chapter Five");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const folderName = `YUNG ${name.trim().replace(/^yung\s+/i, "")}`;
  return (
    <form
      className="space-y-5 rounded-xl border bg-white p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        try {
          const response = await fetch("/api/events", {
            method: "POST",
            body: new FormData(e.currentTarget),
          });
          const result = await response.json();
          if (!response.ok) {
            setError(result.error ?? "Event konnte nicht angelegt werden.");
            return;
          }
          router.push(`/events/${result.id}`);
          router.refresh();
        } catch {
          setError(
            "Server nicht erreichbar. Bitte mit demselben Namen erneut versuchen.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="block font-medium">
        Eventname
        <input
          className="mt-2 block w-full rounded border p-3"
          name="name"
          required
          minLength={2}
          maxLength={100}
          disabled={pending}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <p className="text-sm">
        YUNG wird automatisch vorangestellt. Nach dem Anlegen kannst du Datum,
        Uhrzeiten und Ort im Overview ergänzen.
      </p>
      <div className="rounded bg-stone-100 p-4">
        <p>
          {rootName} / <strong>{folderName}</strong>
        </p>
        <ul className="mt-2 space-y-1 pl-5">
          {newEventFolders.map((folder) => (
            <li key={folder.purpose}>└ {folder.name}</li>
          ))}
        </ul>
      </div>
      <p className="text-sm">
        Der Button erstellt dieses Event und genau diese fünf neuen Ordner in
        Drive. Die Eventzuordnungen werden automatisch gespeichert.
      </p>
      <button
        disabled={pending}
        className="rounded bg-stone-900 px-5 py-3 text-white"
      >
        {pending
          ? "Event und Ordner werden angelegt …"
          : "Event und Drive-Ordner anlegen"}
      </button>
      <p role="status" className="text-sm text-red-800">
        {error}
      </p>
    </form>
  );
}
