"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadInChunks } from "../upload-client";
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
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const requestId = useRef<string | null>(null);
  const selectedFile = useRef<File | null>(null);
  return (
    <form
      className="bg-card space-y-3 rounded-xl border p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const body = new FormData(form);
        const file = selectedFile.current ?? body.get("file");
        if (!(file instanceof File)) return;
        try {
          validateDocumentFile(file, purpose);
        } catch (error) {
          setFailed(true);
          setMessage((error as Error).message);
          return;
        }
        requestId.current ??= crypto.randomUUID();
        selectedFile.current = file;
        setPending(true);
        setStarted(true);
        setMessage("");
        setFailed(false);
        try {
          const result = await uploadInChunks(
            file,
            eventId,
            purpose,
            requestId.current,
            setProgress,
          );
          setMessage(`„${result.name}“ in ${result.path} hochgeladen.`);
          form.reset();
          requestId.current = null;
          selectedFile.current = null;
          setStarted(false);
          router.refresh();
        } catch (error) {
          setFailed(true);
          setMessage(
            `${error instanceof Error ? error.message : "Verbindung unterbrochen."} Bitte mit derselben Datei erneut versuchen.`,
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
      <p className="text-muted-foreground text-sm">
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
        className="bg-primary text-primary-foreground rounded px-4 py-2 disabled:opacity-50"
      >
        {pending
          ? `Lädt hoch … ${progress} %`
          : started
            ? "Upload erneut versuchen"
            : "In Drive hochladen"}
      </button>
      {started && !pending && (
        <button
          type="button"
          className="ml-3 rounded border px-4 py-2 text-sm"
          onClick={() => {
            requestId.current = null;
            selectedFile.current = null;
            setStarted(false);
            setProgress(0);
            setMessage("");
          }}
        >
          Andere Datei auswählen
        </button>
      )}
      {message && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${failed ? "status-error" : "status-success"}`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
