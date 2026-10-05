"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  uploadAccept,
  uploadLimit,
  uploadLabels,
  validateDocumentFile,
} from "../upload";
export function DocumentUpload({
  eventId,
  targets,
  initialPurpose,
}: {
  eventId: string;
  targets: { purpose: string; name: string }[];
  initialPurpose?: string;
}) {
  const router = useRouter();
  const [purpose, setPurpose] = useState(
    initialPurpose ?? targets[0]?.purpose ?? "",
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [started, setStarted] = useState(false);
  const requestId = useRef<string | null>(null);
  const selectedFile = useRef<File | null>(null);
  return (
    <form
      className="space-y-3 rounded-xl border bg-white p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const body = new FormData(form);
        const file = selectedFile.current ?? body.get("file");
        if (!(file instanceof File)) return;
        try {
          validateDocumentFile(file, purpose);
        } catch (error) {
          setMessage((error as Error).message);
          return;
        }
        requestId.current ??= crypto.randomUUID();
        selectedFile.current = file;
        body.set("file", file);
        body.set("requestId", requestId.current);
        body.set("purpose", purpose);
        setPending(true);
        setStarted(true);
        setMessage("");
        try {
          const response = await fetch(`/api/events/${eventId}/documents`, {
            method: "POST",
            body,
          });
          const result = await response.json();
          if (!response.ok) {
            setMessage(
              result.error ??
                "Upload fehlgeschlagen. Bitte mit derselben Datei erneut versuchen.",
            );
            if (response.status === 400) {
              requestId.current = null;
              selectedFile.current = null;
              setStarted(false);
            }
            return;
          }
          setMessage(`„${result.name}“ in ${result.path} hochgeladen.`);
          form.reset();
          requestId.current = null;
          selectedFile.current = null;
          setStarted(false);
          router.refresh();
        } catch {
          setMessage(
            "Verbindung unterbrochen. Bitte mit derselben Datei erneut versuchen; derselbe Upload erzeugt keine zweite Drive-Datei.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <h3 className="font-semibold">
        {purpose === "MEDIA"
          ? "Media hinzufügen"
          : purpose === "PERMISSIONS"
            ? "Genehmigung hinzufügen"
            : "Dokument hinzufügen"}
      </h3>
      <label className="block">
        Ablage
        <select
          className="mt-1 block w-full rounded border p-2"
          value={purpose}
          disabled={pending || started}
          onChange={(event) => setPurpose(event.target.value)}
        >
          {targets.map((target) => (
            <option value={target.purpose} key={target.purpose}>
              {uploadLabels[target.purpose]} → {target.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Datei
        <input
          className="mt-1 block w-full rounded border p-2"
          type="file"
          name="file"
          accept={uploadAccept(purpose)}
          required
          disabled={pending || started}
          onChange={(event) => {
            selectedFile.current = event.target.files?.[0] ?? null;
          }}
        />
      </label>
      <p className="text-sm text-stone-600">
        Bis {uploadLimit(purpose) / 1_000_000} MB:{" "}
        {purpose === "MEDIA"
          ? "Bilder und Videos, z. B. JPG, PNG, WebP, HEIC, MP4 oder MOV."
          : "PDF, JPG, PNG, WebP, Word, Excel, CSV oder Text."}{" "}
        Die Datei wird im ausgewählten Drive-Ordner gespeichert und anschließend
        hier angezeigt. Es wird keine Finanzbuchung angelegt.
      </p>
      <button
        type="submit"
        disabled={pending || !targets.length}
        className="rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {pending
          ? "Lädt hoch …"
          : started
            ? "Upload erneut versuchen"
            : "In Drive hochladen"}
      </button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
